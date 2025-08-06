import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Calculator, CheckCircle, Clock, DollarSign, FileText, Play, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { calculateBulkPayroll, processPayrollRun } from '@/lib/payroll-calculator';
import { useToast } from '@/hooks/use-toast';
import { logPayrollEvent } from '@/lib/audit-logger';

interface Staff {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  position: string;
  grade_level: number;
  step: number;
  department_id: string;
  departments?: {
    name: string;
  };
}

interface PayrollRun {
  id: string;
  period: string;
  department_id: string | null;
  status: string;
  total_staff: number | null;
  gross_amount: number | null;
  total_deductions: number | null;
  net_amount: number | null;
  created_at: string;
}

export default function PayrollProcessing() {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Load staff
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select(`
          *,
          departments!staff_department_id_fkey (
            name
          )
        `)
        .eq('status', 'active')
        .order('first_name');
      
      if (staffError) throw staffError;
      setStaff(staffData || []);

      // Load recent payroll runs
      const { data: payrollData, error: payrollError } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (payrollError) throw payrollError;
      setPayrollRuns(payrollData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processPayroll = async () => {
    if (!selectedPeriod) {
      toast({
        title: "Error",
        description: "Please select a payroll period.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      // Filter staff by department if selected
      const filteredStaff = selectedDepartment === 'all' 
        ? staff 
        : staff.filter(s => s.department_id === selectedDepartment);

      if (filteredStaff.length === 0) {
        toast({
          title: "Error",
          description: "No staff found for the selected criteria.",
          variant: "destructive",
        });
        return;
      }

      // Create payroll run
      const { data: payrollRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          period: selectedPeriod,
          department_id: selectedDepartment === 'all' ? null : selectedDepartment,
          status: 'draft',
          total_staff: filteredStaff.length,
        })
        .select()
        .single();

      if (runError) throw runError;

      // Log payroll run creation
      await logPayrollEvent('created', payrollRun.id, null, {
        period: selectedPeriod,
        department_id: selectedDepartment === 'all' ? null : selectedDepartment,
        total_staff: filteredStaff.length,
      });

      // Prepare payroll inputs for calculation
      const payrollInputs = filteredStaff.map(staffMember => ({
        staffId: staffMember.id,
        gradeLevel: staffMember.grade_level,
        step: staffMember.step,
        position: staffMember.position,
        arrears: 0,
        overtime: 0,
        bonus: 0,
        loans: 0,
        cooperatives: 0,
      }));

      // Calculate payroll and create payslips
      await processPayrollRun(payrollRun.id, selectedPeriod, payrollInputs);

      // Create notifications for relevant users
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'account_admin', 'payroll_admin']);

      if (adminUsers?.length) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          title: 'Payroll Run Completed',
          message: `Payroll for ${selectedPeriod} has been processed for ${filteredStaff.length} staff members and is ready for review.`,
          type: 'success',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }

      toast({
        title: "Success",
        description: `Payroll processed successfully for ${filteredStaff.length} staff members.`,
      });

      // Reload data to show the new payroll run
      loadData();
      
      // Reset form
      setSelectedPeriod('');
      setSelectedDepartment('all');

    } catch (error) {
      console.error('Error processing payroll:', error);
      toast({
        title: "Error",
        description: "Failed to process payroll. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, icon: FileText },
      processing: { variant: 'default' as const, icon: Clock },
      completed: { variant: 'default' as const, icon: CheckCircle },
      approved: { variant: 'default' as const, icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Loading payroll data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Payroll Processing</h1>
        <p className="text-muted-foreground">
          Process payroll for staff members by period and department
        </p>
      </div>

      {/* Processing Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            New Payroll Run
          </CardTitle>
          <CardDescription>
            Select the period and department to process payroll
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Payroll Period</Label>
              <Input
                id="period"
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                placeholder="Select period"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>
                  {selectedDepartment === 'all' 
                    ? staff.length 
                    : staff.filter(s => s.department_id === selectedDepartment).length
                  } staff members
                </span>
              </div>
            </div>
            <Button 
              onClick={processPayroll} 
              disabled={isProcessing || !selectedPeriod}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Process Payroll
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payroll Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Recent Payroll Runs
          </CardTitle>
          <CardDescription>
            View and manage recent payroll processing runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payrollRuns.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No payroll runs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Staff Count</TableHead>
                  <TableHead>Gross Amount</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.period}</TableCell>
                    <TableCell>
                      {run.department_id 
                        ? departments.find(d => d.id === run.department_id)?.name || 'Unknown'
                        : 'All Departments'
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell>{run.total_staff || 0}</TableCell>
                    <TableCell>
                      {run.gross_amount 
                        ? formatDisplayCurrency(run.gross_amount)
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {run.net_amount 
                        ? formatDisplayCurrency(run.net_amount)
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(run.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
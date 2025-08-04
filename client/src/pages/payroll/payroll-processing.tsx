import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { calculateStaffPayroll, processPayrollRun, type PayrollInputs } from '@/lib/payroll-calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, Calculator, Users, DollarSign, FileText, Settings, Eye, Loader2 } from 'lucide-react';

export default function PayrollProcessing() {
  const [selectedPeriod, setSelectedPeriod] = useState('2025-02');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [payrollPreview, setPayrollPreview] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, { arrears: number; overtime: number; bonus: number; loans: number; cooperatives: number }>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch staff for payroll calculation
  const { data: staffForPayroll, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-for-payroll', selectedDepartment],
    queryFn: async () => {
      let staffQuery = supabase
        .from('staff')
        .select(`
          id,
          staff_id,
          first_name,
          last_name,
          position,
          grade_level,
          step,
          departments (
            name
          )
        `)
        .eq('status', 'active');

      if (selectedDepartment !== 'all') {
        staffQuery = staffQuery.eq('department_id', selectedDepartment);
      }

      const { data, error } = await staffQuery.order('staff_id');
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate payroll preview
  const calculatePayrollPreview = async () => {
    if (!staffForPayroll?.length) return;

    try {
      const payrollInputs: PayrollInputs[] = staffForPayroll.map(staff => ({
        staffId: staff.id,
        gradeLevel: staff.grade_level,
        step: staff.step,
        position: staff.position,
        arrears: adjustments[staff.id]?.arrears || 0,
        overtime: adjustments[staff.id]?.overtime || 0,
        bonus: adjustments[staff.id]?.bonus || 0,
        loans: adjustments[staff.id]?.loans || 0,
        cooperatives: adjustments[staff.id]?.cooperatives || 0,
      }));

      const results = [];
      for (const input of payrollInputs) {
        const result = await calculateStaffPayroll(input);
        const staff = staffForPayroll.find(s => s.id === input.staffId);
        results.push({
          ...result,
          staff,
        });
      }

      setPayrollPreview(results);
      setShowPreview(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to calculate payroll preview',
        variant: 'destructive',
      });
    }
  };

  // Start payroll run mutation
  const startPayrollMutation = useMutation({
    mutationFn: async () => {
      if (!staffForPayroll?.length) throw new Error('No staff data available');

      // Create payroll run first
      const { data: payrollRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          period: selectedPeriod,
          department_id: selectedDepartment === 'all' ? null : selectedDepartment,
          status: 'draft',
        })
        .select()
        .single();

      if (runError) throw runError;

      // Prepare payroll inputs
      const payrollInputs: PayrollInputs[] = staffForPayroll.map(staff => ({
        staffId: staff.id,
        gradeLevel: staff.grade_level,
        step: staff.step,
        position: staff.position,
        arrears: adjustments[staff.id]?.arrears || 0,
        overtime: adjustments[staff.id]?.overtime || 0,
        bonus: adjustments[staff.id]?.bonus || 0,
        loans: adjustments[staff.id]?.loans || 0,
        cooperatives: adjustments[staff.id]?.cooperatives || 0,
      }));

      // Process the payroll run
      await processPayrollRun(payrollRun.id, selectedPeriod, payrollInputs);

      return payrollRun;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payroll run processed successfully and is pending review',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      setPayrollPreview([]);
      setAdjustments({});
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process payroll run',
        variant: 'destructive',
      });
    },
  });

  // Update adjustment for a staff member
  const updateAdjustment = (staffId: string, field: string, value: number) => {
    setAdjustments(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: value,
      },
    }));
  };

  // Calculate totals from preview
  const totals = React.useMemo(() => {
    if (!payrollPreview.length) return { totalStaff: 0, grossAmount: 0, totalDeductions: 0, netAmount: 0 };
    
    return {
      totalStaff: payrollPreview.length,
      grossAmount: payrollPreview.reduce((sum, p) => sum + p.grossPay, 0),
      totalDeductions: payrollPreview.reduce((sum, p) => sum + p.totalDeductions, 0),
      netAmount: payrollPreview.reduce((sum, p) => sum + p.netPay, 0),
    };
  }, [payrollPreview]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Generate period options
  const generatePeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    
    return options;
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payroll Processing</h1>
            <p className="text-gray-600">Process monthly payroll for departments</p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowAdjustments(true)}
              disabled={!staffForPayroll?.length}
            >
              <Settings className="mr-2 h-4 w-4" />
              Adjustments
            </Button>
            <Button
              variant="outline"
              onClick={calculatePayrollPreview}
              disabled={!staffForPayroll?.length}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Template
            </Button>
            <Button
              onClick={() => startPayrollMutation.mutate()}
              disabled={startPayrollMutation.isPending || !staffForPayroll?.length}
              className="bg-nigeria-green hover:bg-green-700"
            >
              {startPayrollMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Process Payroll
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Period
                </label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generatePeriodOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Staff Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Staff Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Staff:</span>
                    <span className="font-medium">{staffForPayroll?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium">
                      {selectedDepartment === 'all' 
                        ? 'All Departments' 
                        : departments?.find(d => d.id === selectedDepartment)?.name || 'Unknown'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Period:</span>
                    <span className="font-medium">
                      {generatePeriodOptions().find(p => p.value === selectedPeriod)?.label}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payroll Preview/Summary */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {payrollPreview.length > 0 ? 'Payroll Preview' : 'Payroll Summary'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payrollPreview.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <p className="text-sm text-blue-600 font-medium">Total Staff</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-900">
                        {totals.totalStaff.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-nigeria-green" />
                        <p className="text-sm text-nigeria-green font-medium">Gross Amount</p>
                      </div>
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(totals.grossAmount)}
                      </p>
                    </div>
                    
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Calculator className="h-5 w-5 text-orange-600" />
                        <p className="text-sm text-orange-600 font-medium">Total Deductions</p>
                      </div>
                      <p className="text-2xl font-bold text-orange-900">
                        {formatCurrency(totals.totalDeductions)}
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-purple-600" />
                        <p className="text-sm text-purple-600 font-medium">Net Amount</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-900">
                        {formatCurrency(totals.netAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Staff Preview Table */}
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Basic Salary</TableHead>
                          <TableHead>Gross Pay</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Net Pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollPreview.map((preview) => (
                          <TableRow key={preview.staffId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {preview.staff?.first_name} {preview.staff?.last_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {preview.staff?.staff_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              GL {preview.staff?.grade_level} Step {preview.staff?.step}
                            </TableCell>
                            <TableCell>{formatCurrency(preview.basicSalary)}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(preview.grossPay)}
                            </TableCell>
                            <TableCell className="text-red-600">
                              -{formatCurrency(preview.totalDeductions)}
                            </TableCell>
                            <TableCell className="font-bold text-green-600">
                              {formatCurrency(preview.netPay)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : staffForPayroll?.length ? (
                <div className="text-center py-8">
                  <Calculator className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">Ready to Calculate Payroll</p>
                  <p className="text-sm text-gray-400 mb-4">
                    {staffForPayroll.length} staff members selected for {generatePeriodOptions().find(p => p.value === selectedPeriod)?.label}
                  </p>
                  <Button onClick={calculatePayrollPreview} className="bg-nigeria-green hover:bg-green-700">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate Preview
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No staff data available</p>
                  <p className="text-sm">Select filters to view payroll summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Adjustments Modal */}
      <Dialog open={showAdjustments} onOpenChange={setShowAdjustments}>
        <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payroll Adjustments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Add arrears, overtime, bonuses, or additional deductions for individual staff members.
            </p>
            
            {staffForPayroll && staffForPayroll.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Arrears</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Loans</TableHead>
                    <TableHead>Cooperatives</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffForPayroll.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {staff.first_name} {staff.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {staff.staff_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={adjustments[staff.id]?.arrears || ''}
                          onChange={(e) => updateAdjustment(staff.id, 'arrears', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={adjustments[staff.id]?.overtime || ''}
                          onChange={(e) => updateAdjustment(staff.id, 'overtime', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={adjustments[staff.id]?.bonus || ''}
                          onChange={(e) => updateAdjustment(staff.id, 'bonus', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={adjustments[staff.id]?.loans || ''}
                          onChange={(e) => updateAdjustment(staff.id, 'loans', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={adjustments[staff.id]?.cooperatives || ''}
                          onChange={(e) => updateAdjustment(staff.id, 'cooperatives', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No staff members available for adjustments</p>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAdjustments(false)}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowAdjustments(false);
                  calculatePayrollPreview();
                }}
                className="bg-nigeria-green hover:bg-green-700"
              >
                Apply & Preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payroll Preview - {generatePeriodOptions().find(p => p.value === selectedPeriod)?.label}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="details">Staff Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-blue-600 font-medium">Total Staff</p>
                  <p className="text-2xl font-bold text-blue-900">{totals.totalStaff}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-nigeria-green font-medium">Gross Amount</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(totals.grossAmount)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-orange-600 font-medium">Deductions</p>
                  <p className="text-xl font-bold text-orange-900">{formatCurrency(totals.totalDeductions)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-purple-600 font-medium">Net Amount</p>
                  <p className="text-xl font-bold text-purple-900">{formatCurrency(totals.netAmount)}</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="details">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Basic</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Extras</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollPreview.map((preview) => (
                      <TableRow key={preview.staffId}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">
                              {preview.staff?.first_name} {preview.staff?.last_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {preview.staff?.staff_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(preview.basicSalary)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(preview.totalAllowances)}</TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(preview.arrears + preview.overtime + preview.bonus)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatCurrency(preview.grossPay)}
                        </TableCell>
                        <TableCell className="text-sm text-red-600">
                          -{formatCurrency(preview.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-sm font-bold text-green-600">
                          {formatCurrency(preview.netPay)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowPreview(false);
                startPayrollMutation.mutate();
              }}
              disabled={startPayrollMutation.isPending}
              className="bg-nigeria-green hover:bg-green-700"
            >
              {startPayrollMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Process Payroll'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No payroll data available</p>
                  <p className="text-sm">Select filters to view payroll summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

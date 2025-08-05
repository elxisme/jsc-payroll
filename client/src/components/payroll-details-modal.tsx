import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency, formatDetailCurrency } from '@/lib/currency-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Building, 
  Users, 
  DollarSign, 
  FileText,
  User,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface PayrollDetailsModalProps {
  open: boolean;
  onClose: () => void;
  payrollRun: any;
}

export function PayrollDetailsModal({ open, onClose, payrollRun }: PayrollDetailsModalProps) {
  // Fetch detailed payroll data including payslips
  const { data: payrollDetails, isLoading } = useQuery({
    queryKey: ['payroll-details', payrollRun?.id],
    queryFn: async () => {
      if (!payrollRun?.id) return null;

      // Fetch payslips for this payroll run
      const { data: payslips, error: payslipsError } = await supabase
        .from('payslips')
        .select(`
          *,
          staff (
            staff_id,
            first_name,
            last_name,
            position,
            departments!staff_department_id_fkey (
              name
            )
          )
        `)
        .eq('payroll_run_id', payrollRun.id)
        .order('net_pay', { ascending: false });

      if (payslipsError) throw payslipsError;

      // Calculate summary statistics
      const totalStaff = payslips?.length || 0;
      const totalGross = payslips?.reduce((sum, p) => sum + parseFloat(p.gross_pay || '0'), 0) || 0;
      const totalDeductions = payslips?.reduce((sum, p) => sum + parseFloat(p.total_deductions || '0'), 0) || 0;
      const totalNet = payslips?.reduce((sum, p) => sum + parseFloat(p.net_pay || '0'), 0) || 0;

      // Department breakdown
      const departmentBreakdown = payslips?.reduce((acc, payslip) => {
        const deptName = payslip.staff?.departments?.name || 'Unassigned';
        if (!acc[deptName]) {
          acc[deptName] = {
            name: deptName,
            count: 0,
            grossAmount: 0,
            netAmount: 0,
          };
        }
        acc[deptName].count += 1;
        acc[deptName].grossAmount += parseFloat(payslip.gross_pay || '0');
        acc[deptName].netAmount += parseFloat(payslip.net_pay || '0');
        return acc;
      }, {} as Record<string, any>) || {};

      return {
        payslips: payslips || [],
        summary: {
          totalStaff,
          totalGross,
          totalDeductions,
          totalNet,
        },
        departmentBreakdown: Object.values(departmentBreakdown),
      };
    },
    enabled: !!payrollRun?.id && open,
  });

  if (!payrollRun) return null;

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'pending_review':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending_review':
        return 'bg-orange-100 text-orange-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Payroll Run Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Period</p>
                    <p className="font-medium">{formatPeriod(payrollRun.period)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="font-medium">{payrollRun.departments?.name || 'All Departments'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Total Staff</p>
                    <p className="font-medium">{payrollRun.total_staff || 0}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getStatusIcon(payrollRun.status)}
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={getStatusColor(payrollRun.status)}>
                      {payrollRun.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Gross Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDisplayCurrency(payrollDetails?.summary?.totalGross || payrollRun.gross_amount || 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-nigeria-green" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatDisplayCurrency(payrollDetails?.summary?.totalDeductions || payrollRun.total_deductions || 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-red-600" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Net Amount</p>
                    <p className="text-2xl font-bold text-nigeria-green">
                      {formatDisplayCurrency(payrollDetails?.summary?.totalNet || payrollRun.net_amount || 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-nigeria-green" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Breakdown */}
          {payrollDetails?.departmentBreakdown && payrollDetails.departmentBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Department Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payrollDetails.departmentBreakdown.map((dept: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Building className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{dept.name}</p>
                          <p className="text-sm text-gray-600">{dept.count} staff members</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatDisplayCurrency(dept.netAmount)}</p>
                        <p className="text-sm text-gray-600">Net Amount</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payroll Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-sm text-gray-600">
                      {new Date(payrollRun.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      By: {payrollRun.created_by_user?.email || 'System'}
                    </p>
                  </div>
                </div>

                {payrollRun.approved_by && (
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Approved</p>
                      <p className="text-xs text-gray-500">
                        By: {payrollRun.approved_by_user?.email || 'Unknown'}
                      </p>
                    </div>
                  </div>
                )}

                {payrollRun.processed_at && (
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Processed</p>
                      <p className="text-sm text-gray-600">
                        {new Date(payrollRun.processed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nigeria-green mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading payroll details...</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLoanRepaymentSchedule } from '@/lib/individual-payroll-utils';
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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Building, 
  User,
  CheckCircle,
  Clock,
  TrendingUp,
  FileText
} from 'lucide-react';

interface LoanDetailsModalProps {
  open: boolean;
  onClose: () => void;
  loan: any;
}

export function LoanDetailsModal({ open, onClose, loan }: LoanDetailsModalProps) {
  // Fetch repayment schedule
  const { data: repaymentSchedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['loan-repayment-schedule', loan?.id],
    queryFn: () => getLoanRepaymentSchedule(loan.id),
    enabled: !!loan?.id && open,
  });

  if (!loan) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'paid_off':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'defaulted':
        return <Clock className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'cancelled':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'paid_off':
        return 'bg-green-100 text-green-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLoanType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const calculateProgress = () => {
    if (!loan.total_loan_amount || loan.total_loan_amount === 0) return 0;
    const paid = parseFloat(loan.total_loan_amount) - parseFloat(loan.remaining_balance || '0');
    return (paid / parseFloat(loan.total_loan_amount)) * 100;
  };

  const calculateTotalPaid = () => {
    return parseFloat(loan.total_loan_amount || '0') - parseFloat(loan.remaining_balance || '0');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Loan Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Staff Member</p>
                    <p className="font-medium">
                      {loan.staff?.first_name} {loan.staff?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{loan.staff?.staff_id}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Cooperative</p>
                    <p className="font-medium">
                      {loan.cooperative_organizations?.name || 'Direct Loan'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Loan Type</p>
                    <Badge variant="outline">
                      {formatLoanType(loan.loan_type)}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getStatusIcon(loan.status)}
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={getStatusColor(loan.status)}>
                      {loan.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Loan Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDisplayCurrency(loan.total_loan_amount || 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-blue-600" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Amount Paid</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatDisplayCurrency(calculateTotalPaid())}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-green-600" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Remaining Balance</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatDisplayCurrency(loan.remaining_balance || 0)}
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
                    <p className="text-sm font-medium text-gray-600">Monthly Payment</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatDisplayCurrency(loan.monthly_total_deduction || 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="text-purple-600" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress and Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loan Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Repayment Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Installments: {loan.installments_paid}/{loan.number_of_installments}</span>
                    <span>{calculateProgress().toFixed(1)}% Complete</span>
                  </div>
                  <Progress value={calculateProgress()} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Interest Rate</p>
                    <p className="font-medium">{loan.interest_rate}% per annum</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Calculation Method</p>
                    <p className="font-medium capitalize">
                      {loan.interest_calculation_method.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Start Date</p>
                    <p className="font-medium">{formatDate(loan.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">End Date</p>
                    <p className="font-medium">{formatDate(loan.end_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loan Details */}
            <Card>
              <CardHeader>
                <CardTitle>Loan Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Interest</p>
                    <p className="font-medium">{formatDetailCurrency(loan.total_interest_charged || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Monthly Principal</p>
                    <p className="font-medium">{formatDetailCurrency(loan.monthly_principal_amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Monthly Interest</p>
                    <p className="font-medium">{formatDetailCurrency(loan.monthly_interest_amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Created By</p>
                    <p className="font-medium">{loan.created_by_user?.email || 'System'}</p>
                  </div>
                  {loan.approved_by_user && (
                    <>
                      <div>
                        <p className="text-gray-600">Approved By</p>
                        <p className="font-medium">{loan.approved_by_user.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Approved At</p>
                        <p className="font-medium">{formatDate(loan.approved_at)}</p>
                      </div>
                    </>
                  )}
                </div>

                {loan.notes && (
                  <div>
                    <p className="text-gray-600 text-sm">Notes</p>
                    <p className="font-medium text-sm bg-gray-50 p-3 rounded-lg">{loan.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Repayment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Repayment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-8 w-full"></div>
                    </div>
                  ))}
                </div>
              ) : repaymentSchedule && repaymentSchedule.length > 0 ? (
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Installment</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Interest</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Remaining Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repaymentSchedule.map((installment: any, index: number) => (
                        <TableRow key={index} className={installment.is_paid ? 'bg-green-50' : ''}>
                          <TableCell className="font-medium">
                            {installment.installment_number}
                          </TableCell>
                          <TableCell>{formatDate(installment.due_date)}</TableCell>
                          <TableCell>{formatDisplayCurrency(installment.principal_amount)}</TableCell>
                          <TableCell>{formatDisplayCurrency(installment.interest_amount)}</TableCell>
                          <TableCell className="font-medium">
                            {formatDisplayCurrency(installment.total_amount)}
                          </TableCell>
                          <TableCell>{formatDisplayCurrency(installment.remaining_balance)}</TableCell>
                          <TableCell>
                            <Badge variant={installment.is_paid ? 'default' : 'secondary'}>
                              {installment.is_paid ? 'Paid' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No repayment schedule available</p>
                </div>
              )}
            </CardContent>
          </Card>

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
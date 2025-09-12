import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { 
  updateLoan, 
  getCooperativeOrganizations, 
  calculateLoanScheduleRPC 
} from '@/lib/individual-payroll-utils';
import { logLoanEvent } from '@/lib/audit-logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calculator, AlertCircle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const editLoanSchema = z.object({
  cooperativeId: z.string().optional(),
  loanType: z.enum(['salary_advance', 'cooperative_loan', 'personal_loan', 'emergency_loan']),
  totalLoanAmount: z.number().min(1, 'Loan amount must be greater than 0'),
  interestRate: z.number().min(0).max(100),
  interestCalculationMethod: z.enum(['flat', 'reducing_balance']),
  numberOfInstallments: z.number().min(1, 'Number of installments must be at least 1'),
  startDate: z.string().min(1, 'Start date is required'),
  monthlyPrincipalAmount: z.number().min(0).optional(),
  monthlyInterestAmount: z.number().min(0).optional(),
  monthlyTotalDeduction: z.number().min(1, 'Monthly deduction must be greater than 0'),
  remainingBalance: z.number().min(0),
  status: z.enum(['pending', 'active', 'paid_off', 'defaulted', 'cancelled']),
  notes: z.string().optional(),
});

type EditLoanFormData = z.infer<typeof editLoanSchema>;

interface EditLoanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan: any;
}

export function EditLoanModal({ open, onClose, onSuccess, loan }: EditLoanModalProps) {
  const [calculatedSchedule, setCalculatedSchedule] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditLoanFormData>({
    resolver: zodResolver(editLoanSchema),
    defaultValues: {
      cooperativeId: loan?.cooperative_id || '',
      loanType: loan?.loan_type || 'personal_loan',
      totalLoanAmount: loan?.total_loan_amount || 0,
      interestRate: loan?.interest_rate || 0,
      interestCalculationMethod: loan?.interest_calculation_method || 'flat',
      numberOfInstallments: loan?.number_of_installments || 12,
      startDate: loan?.start_date || new Date().toISOString().split('T')[0],
      monthlyPrincipalAmount: loan?.monthly_principal_amount || 0,
      monthlyInterestAmount: loan?.monthly_interest_amount || 0,
      monthlyTotalDeduction: loan?.monthly_total_deduction || 0,
      remainingBalance: loan?.remaining_balance || 0,
      status: loan?.status || 'pending',
      notes: loan?.notes || '',
    },
  });

  // Reset form when loan changes
  useEffect(() => {
    if (loan) {
      form.reset({
        cooperativeId: loan.cooperative_id || '',
        loanType: loan.loan_type || 'personal_loan',
        totalLoanAmount: parseFloat(loan.total_loan_amount) || 0,
        interestRate: parseFloat(loan.interest_rate) || 0,
        interestCalculationMethod: loan.interest_calculation_method || 'flat',
        numberOfInstallments: loan.number_of_installments || 12,
        startDate: loan.start_date || new Date().toISOString().split('T')[0],
        monthlyPrincipalAmount: parseFloat(loan.monthly_principal_amount) || 0,
        monthlyInterestAmount: parseFloat(loan.monthly_interest_amount) || 0,
        monthlyTotalDeduction: parseFloat(loan.monthly_total_deduction) || 0,
        remainingBalance: parseFloat(loan.remaining_balance) || 0,
        status: loan.status || 'pending',
        notes: loan.notes || '',
      });
    }
  }, [loan, form]);

  // Fetch cooperatives
  const { data: cooperatives } = useQuery({
    queryKey: ['cooperative-organizations'],
    queryFn: getCooperativeOrganizations,
    enabled: open,
  });

  // Check if loan has started repayments (restrict certain edits)
  const hasStartedRepayments = loan?.installments_paid > 0;
  const canApprove = !loan?.approved_by && hasRole(['super_admin', 'account_admin']);

  // Watch form values for automatic calculation
  const totalLoanAmount = form.watch('totalLoanAmount');
  const interestRate = form.watch('interestRate');
  const numberOfInstallments = form.watch('numberOfInstallments');
  const interestCalculationMethod = form.watch('interestCalculationMethod');

  // Auto-calculate loan schedule when key values change
  useEffect(() => {
    const calculateSchedule = async () => {
      if (totalLoanAmount > 0 && numberOfInstallments > 0 && !hasStartedRepayments) {
        setIsCalculating(true);
        try {
          const schedule = await calculateLoanScheduleRPC(
            totalLoanAmount,
            interestRate,
            numberOfInstallments,
            interestCalculationMethod
          );
          
          setCalculatedSchedule(schedule);
          
          // Auto-fill calculated values only if loan hasn't started
          if (!hasStartedRepayments) {
            form.setValue('monthlyPrincipalAmount', schedule.monthlyPrincipal);
            form.setValue('monthlyInterestAmount', schedule.monthlyInterest);
            form.setValue('monthlyTotalDeduction', schedule.monthlyTotal);
          }
        } catch (error) {
          console.error('Error calculating loan schedule:', error);
        } finally {
          setIsCalculating(false);
        }
      }
    };

    if (!hasStartedRepayments) {
      const timeoutId = setTimeout(calculateSchedule, 500); // Debounce
      return () => clearTimeout(timeoutId);
    }
  }, [totalLoanAmount, interestRate, numberOfInstallments, interestCalculationMethod, hasStartedRepayments, form]);

  // Update loan mutation
  const updateLoanMutation = useMutation({
    mutationFn: async (data: EditLoanFormData) => {
      const oldValues = { ...loan };
      
      // Calculate end date
      const startDate = new Date(data.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + data.numberOfInstallments);

      await updateLoan(loan.id, {
        cooperativeId: data.cooperativeId || undefined,
        loanType: data.loanType,
        totalLoanAmount: data.totalLoanAmount,
        interestRate: data.interestRate,
        interestCalculationMethod: data.interestCalculationMethod,
        totalInterestCharged: calculatedSchedule?.totalInterest || parseFloat(loan.total_interest_charged),
        monthlyPrincipalAmount: data.monthlyPrincipalAmount || 0,
        monthlyInterestAmount: data.monthlyInterestAmount || 0,
        monthlyTotalDeduction: data.monthlyTotalDeduction,
        numberOfInstallments: data.numberOfInstallments,
        startDate: data.startDate,
        endDate: endDate.toISOString().split('T')[0],
        remainingBalance: data.remainingBalance,
        status: data.status,
        notes: data.notes,
      });

      await logLoanEvent('updated', loan.id, oldValues, data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Loan updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update loan',
        variant: 'destructive',
      });
    },
  });

  // Approve loan mutation
  const approveLoanMutation = useMutation({
    mutationFn: async () => {
      const oldValues = { ...loan };
      await updateLoan(loan.id, {
        status: 'active',
        approvedBy: user?.id,
        approvedAt: new Date().toISOString(),
      });

      await logLoanEvent('approved', loan.id, oldValues, { 
        status: 'active', 
        approvedBy: user?.id 
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Loan approved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve loan',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditLoanFormData) => {
    updateLoanMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Loan</DialogTitle>
        </DialogHeader>

        {hasStartedRepayments && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              This loan has started repayments. Some fields are restricted to prevent data inconsistency.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Loan Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cooperativeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cooperative (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cooperative or leave blank for direct loan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cooperatives?.filter(c => c.isActive).map((cooperative) => (
                            <SelectItem key={cooperative.id} value={cooperative.id}>
                              {cooperative.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="loanType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="salary_advance">Salary Advance</SelectItem>
                          <SelectItem value="cooperative_loan">Cooperative Loan</SelectItem>
                          <SelectItem value="personal_loan">Personal Loan</SelectItem>
                          <SelectItem value="emergency_loan">Emergency Loan</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending Approval</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paid_off">Paid Off</SelectItem>
                          <SelectItem value="defaulted">Defaulted</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Loan Terms */}
            <div>
              <h4 className="text-md font-medium mb-4">Loan Terms</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalLoanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Loan Amount (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={hasStartedRepayments}
                        />
                      </FormControl>
                      {hasStartedRepayments && (
                        <p className="text-xs text-gray-500">Cannot modify - repayments have started</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (% per annum)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={hasStartedRepayments}
                        />
                      </FormControl>
                      {hasStartedRepayments && (
                        <p className="text-xs text-gray-500">Cannot modify - repayments have started</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interestCalculationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Calculation Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={hasStartedRepayments}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="flat">Flat Interest</SelectItem>
                          <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                        </SelectContent>
                      </Select>
                      {hasStartedRepayments && (
                        <p className="text-xs text-gray-500">Cannot modify - repayments have started</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberOfInstallments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Installments</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          disabled={hasStartedRepayments}
                        />
                      </FormControl>
                      {hasStartedRepayments && (
                        <p className="text-xs text-gray-500">Cannot modify - repayments have started</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={hasStartedRepayments} />
                      </FormControl>
                      {hasStartedRepayments && (
                        <p className="text-xs text-gray-500">Cannot modify - repayments have started</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remainingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remaining Balance (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <p className="text-xs text-orange-600">
                        ⚠️ Manual adjustment will be logged for audit
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Calculated Schedule (only show if loan hasn't started) */}
            {calculatedSchedule && !hasStartedRepayments && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900">Recalculated Schedule</h4>
                    {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Monthly Principal</p>
                      <p className="font-medium">₦{calculatedSchedule.monthlyPrincipal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Monthly Interest</p>
                      <p className="font-medium">₦{calculatedSchedule.monthlyInterest.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Monthly Total</p>
                      <p className="font-medium text-blue-600">₦{calculatedSchedule.monthlyTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Interest</p>
                      <p className="font-medium">₦{calculatedSchedule.totalInterest.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly Deduction */}
            <div>
              <h4 className="text-md font-medium mb-4">Monthly Deduction</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="monthlyPrincipalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Principal (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyInterestAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Interest (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyTotalDeduction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Total Deduction (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes about this loan..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {canApprove && (
                <Button
                  type="button"
                  onClick={() => approveLoanMutation.mutate()}
                  disabled={approveLoanMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {approveLoanMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve Loan'
                  )}
                </Button>
              )}
              <Button
                type="submit"
                disabled={updateLoanMutation.isPending}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {updateLoanMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Loan'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
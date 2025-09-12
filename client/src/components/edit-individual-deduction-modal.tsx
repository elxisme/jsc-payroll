import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { updateIndividualDeduction, getLoanById } from '@/lib/individual-payroll-utils';
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
import { Loader2, Minus, CreditCard, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const editDeductionSchema = z.object({
  type: z.string().min(1, 'Deduction type is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  totalAmount: z.number().optional(),
  period: z.string().min(1, 'Period is required'),
  startPeriod: z.string().optional(),
  endPeriod: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'paid_off', 'cancelled']),
  loanId: z.string().optional(),
  isLoanRepayment: z.boolean(),
});

type EditDeductionFormData = z.infer<typeof editDeductionSchema>;

interface EditIndividualDeductionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deduction: any;
}

const deductionTypes = [
  { value: 'loan_repayment', label: 'Loan Repayment' },
  { value: 'salary_advance', label: 'Salary Advance' },
  { value: 'cooperative', label: 'Cooperative Deduction' },
  { value: 'fine', label: 'Fine/Penalty' },
  { value: 'garnishment', label: 'Court Garnishment' },
  { value: 'insurance_premium', label: 'Insurance Premium' },
  { value: 'union_dues', label: 'Additional Union Dues' },
  { value: 'training_cost', label: 'Training Cost Recovery' },
  { value: 'equipment_damage', label: 'Equipment Damage' },
  { value: 'other', label: 'Other Deduction' },
];

export function EditIndividualDeductionModal({ 
  open, 
  onClose, 
  onSuccess, 
  deduction 
}: EditIndividualDeductionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditDeductionFormData>({
    resolver: zodResolver(editDeductionSchema),
    defaultValues: {
      type: deduction?.type || '',
      amount: deduction?.amount || 0,
      totalAmount: deduction?.totalAmount || undefined,
      period: deduction?.period || new Date().toISOString().slice(0, 7),
      startPeriod: deduction?.startPeriod || '',
      endPeriod: deduction?.endPeriod || '',
      description: deduction?.description || '',
      status: deduction?.status || 'active',
      loanId: deduction?.loanId || '',
      isLoanRepayment: deduction?.isLoanRepayment || false,
    },
  });

  // Reset form when deduction changes
  React.useEffect(() => {
    if (deduction) {
      form.reset({
        type: deduction.type || '',
        amount: deduction.amount || 0,
        totalAmount: deduction.totalAmount || undefined,
        period: deduction.period || new Date().toISOString().slice(0, 7),
        startPeriod: deduction.startPeriod || '',
        endPeriod: deduction.endPeriod || '',
        description: deduction.description || '',
        status: deduction.status || 'active',
        loanId: deduction.loanId || '',
        isLoanRepayment: deduction.isLoanRepayment || false,
      });
    }
  }, [deduction, form]);

  // Fetch linked loan details if this is a loan repayment
  const { data: linkedLoan } = useQuery({
    queryKey: ['linked-loan', deduction?.loanId],
    queryFn: () => getLoanById(deduction.loanId),
    enabled: !!deduction?.loanId && deduction?.isLoanRepayment,
  });

  // Update deduction mutation
  const updateDeductionMutation = useMutation({
    mutationFn: async (data: EditDeductionFormData) => {
      await updateIndividualDeduction(deduction.id, {
        amount: data.amount,
        totalAmount: data.totalAmount,
        remainingBalance: data.totalAmount ? data.totalAmount - (deduction.totalAmount - deduction.remainingBalance) : undefined,
        status: data.status,
        loanId: data.loanId,
        isLoanRepayment: data.isLoanRepayment,
      });

      // Create notification for the staff member if status changed
      if (data.status !== deduction.status) {
        const { data: staffUser } = await supabase
          .from('staff')
          .select('user_id')
          .eq('id', deduction.staffId)
          .single();

        if (staffUser?.user_id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: staffUser.user_id,
              title: 'Individual Deduction Updated',
              message: `Your ${data.type.replace('_', ' ')} deduction has been updated. Status: ${data.status.replace('_', ' ')}.`,
              type: 'info',
            });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual deduction updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-deductions'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update individual deduction',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditDeductionFormData) => {
    updateDeductionMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const isLoanType = form.watch('type') === 'loan_repayment' || form.watch('type') === 'salary_advance';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Minus className="h-5 w-5 text-red-600" />
            <span>Edit Individual Deduction</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Loan Information Display */}
            {deduction?.isLoanRepayment && linkedLoan && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900">Linked Loan Information</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Loan Type</p>
                      <p className="font-medium">{linkedLoan.loanType.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Amount</p>
                      <p className="font-medium">₦{linkedLoan.totalLoanAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Remaining Balance</p>
                      <p className="font-medium">₦{linkedLoan.remainingBalance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <Badge variant="outline">{linkedLoan.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {deduction?.isLoanRepayment && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This deduction is linked to a loan. Changes to the amount will affect the loan's remaining balance.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deduction Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select deduction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {deductionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isLoanType ? 'Monthly Deduction Amount (NGN)' : 'Amount (NGN)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLoanType && (
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Loan/Advance Amount (NGN)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500 mt-1">
                    Selected: {field.value ? formatPeriod(field.value) : 'None'}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLoanType && (
              <>
                <FormField
                  control={form.control}
                  name="startPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Period (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="month"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Period (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="month"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paid_off">Paid Off</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details about this deduction..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2">Update Notes:</h4>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Changes will be reflected in the next payroll processing</li>
                <li>Setting status to "Paid Off" removes it from future payroll</li>
                <li>Setting status to "Cancelled" stops the deduction immediately</li>
                <li>For loans, remaining balance is automatically calculated</li>
              </ul>
            </div>

              <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateDeductionMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateDeductionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Deduction'
                )}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
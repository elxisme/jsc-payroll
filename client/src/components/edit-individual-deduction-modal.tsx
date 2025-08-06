import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateIndividualDeduction, cancelIndividualDeduction } from '@/lib/individual-payroll-utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Minus, Trash2 } from 'lucide-react';

const editDeductionSchema = z.object({
  status: z.enum(['active', 'paid_off', 'cancelled']),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  remainingBalance: z.number().min(0, 'Remaining balance cannot be negative'),
});

type EditDeductionFormData = z.infer<typeof editDeductionSchema>;

interface EditIndividualDeductionModalProps {
  open: boolean;
  onClose: () => void;
  deduction: any;
  onSuccess: () => void;
}

export function EditIndividualDeductionModal({ 
  open, 
  onClose, 
  deduction, 
  onSuccess 
}: EditIndividualDeductionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditDeductionFormData>({
    resolver: zodResolver(editDeductionSchema),
    defaultValues: {
      status: deduction?.status || 'active',
      amount: deduction?.amount || 0,
      remainingBalance: deduction?.remainingBalance || 0,
    },
  });

  // Reset form when deduction changes
  React.useEffect(() => {
    if (deduction) {
      form.reset({
        status: deduction.status || 'active',
        amount: deduction.amount || 0,
        remainingBalance: deduction.remainingBalance || deduction.totalAmount || 0,
      });
    }
  }, [deduction, form]);

  // Update deduction mutation
  const updateDeductionMutation = useMutation({
    mutationFn: async (data: EditDeductionFormData) => {
      if (!deduction?.id) throw new Error('No deduction selected');

      await updateIndividualDeduction(deduction.id, {
        status: data.status,
        amount: data.amount,
        remainingBalance: data.remainingBalance,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual deduction updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-deductions'] });
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

  // Cancel deduction mutation
  const cancelDeductionMutation = useMutation({
    mutationFn: async () => {
      if (!deduction?.id) throw new Error('No deduction selected');
      await cancelIndividualDeduction(deduction.id);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual deduction cancelled successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-deductions'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel individual deduction',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'paid_off':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const calculateProgress = () => {
    if (!deduction?.totalAmount || deduction.totalAmount === 0) return 0;
    const paid = deduction.totalAmount - (deduction.remainingBalance || 0);
    return (paid / deduction.totalAmount) * 100;
  };

  if (!deduction) return null;

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
        <div className="space-y-4">
          {/* Deduction Details */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Type</p>
                <p className="font-medium capitalize">{deduction.type.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-600">Monthly Amount</p>
                <p className="font-medium">{formatCurrency(deduction.amount)}</p>
              </div>
              <div>
                <p className="text-gray-600">Period</p>
                <p className="font-medium">{formatPeriod(deduction.period)}</p>
              </div>
              <div>
                <p className="text-gray-600">Current Status</p>
                <Badge className={getStatusColor(deduction.status)}>
                  {deduction.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Loan Progress (if applicable) */}
            {deduction.totalAmount && deduction.totalAmount > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Loan Progress</span>
                  <span className="font-medium">
                    {formatCurrency(deduction.totalAmount - (deduction.remainingBalance || 0))} / {formatCurrency(deduction.totalAmount)}
                  </span>
                </div>
                <Progress value={calculateProgress()} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Paid: {calculateProgress().toFixed(1)}%</span>
                  <span>Remaining: {formatCurrency(deduction.remainingBalance || 0)}</span>
                </div>
              </div>
            )}

            {deduction.description && (
              <div className="mt-3">
                <p className="text-gray-600 text-sm">Description</p>
                <p className="text-sm">{deduction.description}</p>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Deduction Amount (NGN)</FormLabel>
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

              {deduction.totalAmount && deduction.totalAmount > 0 && (
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
                          max={deduction.totalAmount}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <div className="text-xs text-gray-500 mt-1">
                        Maximum: {formatCurrency(deduction.totalAmount)}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-between space-x-2 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={deduction.status === 'paid_off'}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cancel Deduction
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Individual Deduction</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel this deduction? This action cannot be undone.
                        {deduction.status === 'paid_off' && (
                          <div className="mt-2 text-green-600 font-medium">
                            Note: This deduction has been fully paid off.
                          </div>
                        )}
                <div className="flex justify-between space-x-2 pt-4 border-t bg-white sticky bottom-0">
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelDeductionMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={deduction.status === 'paid_off' || cancelDeductionMutation.isPending}
                      >
                        {cancelDeductionMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          'Yes, Cancel Deduction'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateDeductionMutation.isPending}
                    className="bg-nigeria-green hover:bg-green-700"
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
              </div>
            </form>
          </Form>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateIndividualAllowanceStatus, cancelIndividualAllowance } from '@/lib/individual-payroll-utils';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, Trash2 } from 'lucide-react';

const editAllowanceSchema = z.object({
  status: z.enum(['pending', 'applied', 'cancelled']),
  description: z.string().optional(),
});

type EditAllowanceFormData = z.infer<typeof editAllowanceSchema>;

interface EditIndividualAllowanceModalProps {
  open: boolean;
  onClose: () => void;
  allowance: any;
  onSuccess: () => void;
}

export function EditIndividualAllowanceModal({ 
  open, 
  onClose, 
  allowance, 
  onSuccess 
}: EditIndividualAllowanceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditAllowanceFormData>({
    resolver: zodResolver(editAllowanceSchema),
    defaultValues: {
      status: allowance?.status || 'pending',
      description: allowance?.description || '',
    },
  });

  // Reset form when allowance changes
  React.useEffect(() => {
    if (allowance) {
      form.reset({
        status: allowance.status || 'pending',
        description: allowance.description || '',
      });
    }
  }, [allowance, form]);

  // Update allowance mutation
  const updateAllowanceMutation = useMutation({
    mutationFn: async (data: EditAllowanceFormData) => {
      if (!allowance?.id) throw new Error('No allowance selected');

      await updateIndividualAllowanceStatus(allowance.id, data.status);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual allowance updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-allowances'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update individual allowance',
        variant: 'destructive',
      });
    },
  });

  // Cancel allowance mutation
  const cancelAllowanceMutation = useMutation({
    mutationFn: async () => {
      if (!allowance?.id) throw new Error('No allowance selected');
      await cancelIndividualAllowance(allowance.id);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual allowance cancelled successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-allowances'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel individual allowance',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditAllowanceFormData) => {
    updateAllowanceMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'applied':
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

  if (!allowance) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span>Edit Individual Allowance</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
        <div className="space-y-4">
          {/* Allowance Details */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Type</p>
                <p className="font-medium capitalize">{allowance.type.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-600">Amount</p>
                <p className="font-medium">{formatCurrency(allowance.amount)}</p>
              </div>
              <div>
                <p className="text-gray-600">Period</p>
                <p className="font-medium">{formatPeriod(allowance.period)}</p>
              </div>
              <div>
                <p className="text-gray-600">Current Status</p>
                <Badge className={getStatusColor(allowance.status)}>
                  {allowance.status.toUpperCase()}
                </Badge>
              </div>
            </div>
            {allowance.description && (
              <div className="mt-3">
                <p className="text-gray-600 text-sm">Description</p>
                <p className="text-sm">{allowance.description}</p>
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
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                <div className="flex justify-between space-x-2 pt-4 border-t bg-white sticky bottom-0">
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between space-x-2 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={allowance.status === 'applied'}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cancel Allowance
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Individual Allowance</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel this allowance? This action cannot be undone.
                        {allowance.status === 'applied' && (
                          <div className="mt-2 text-red-600 font-medium">
                            Note: This allowance has already been applied to payroll and cannot be cancelled.
                          </div>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelAllowanceMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={allowance.status === 'applied' || cancelAllowanceMutation.isPending}
                      >
                        {cancelAllowanceMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          'Yes, Cancel Allowance'
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
                    disabled={updateAllowanceMutation.isPending}
                    className="bg-nigeria-green hover:bg-green-700"
                  >
                    {updateAllowanceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Status'
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
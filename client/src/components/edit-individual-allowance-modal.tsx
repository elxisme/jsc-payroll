import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { updateIndividualAllowance } from '@/lib/individual-payroll-utils';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign } from 'lucide-react';

const editAllowanceSchema = z.object({
  type: z.string().min(1, 'Allowance type is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  period: z.string().min(1, 'Period is required'),
  description: z.string().optional(),
  status: z.enum(['pending', 'applied', 'cancelled']),
});

type EditAllowanceFormData = z.infer<typeof editAllowanceSchema>;

interface EditIndividualAllowanceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allowance: any;
}

const allowanceTypes = [
  { value: 'overtime', label: 'Overtime Pay' },
  { value: 'bonus', label: 'Performance Bonus' },
  { value: 'commission', label: 'Commission' },
  { value: 'special_duty', label: 'Special Duty Allowance' },
  { value: 'acting_allowance', label: 'Acting Allowance' },
  { value: 'responsibility_allowance', label: 'Additional Responsibility' },
  { value: 'hazard_allowance', label: 'Hazard Allowance' },
  { value: 'field_allowance', label: 'Field Work Allowance' },
  { value: 'training_allowance', label: 'Training Allowance' },
  { value: 'other', label: 'Other Allowance' },
];

export function EditIndividualAllowanceModal({ 
  open, 
  onClose, 
  onSuccess, 
  allowance 
}: EditIndividualAllowanceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditAllowanceFormData>({
    resolver: zodResolver(editAllowanceSchema),
    defaultValues: {
      type: allowance?.type || '',
      amount: allowance?.amount || 0,
      period: allowance?.period || new Date().toISOString().slice(0, 7),
      description: allowance?.description || '',
      status: allowance?.status || 'pending',
    },
  });

  // Reset form when allowance changes
  React.useEffect(() => {
    if (allowance) {
      form.reset({
        type: allowance.type || '',
        amount: allowance.amount || 0,
        period: allowance.period || new Date().toISOString().slice(0, 7),
        description: allowance.description || '',
        status: allowance.status || 'pending',
      });
    }
  }, [allowance, form]);

  // Update allowance mutation
  const updateAllowanceMutation = useMutation({
    mutationFn: async (data: EditAllowanceFormData) => {
      await updateIndividualAllowance(allowance.id, {
        type: data.type,
        amount: data.amount,
        period: data.period,
        description: data.description,
        status: data.status,
      });

      // Create notification for the staff member if status changed
      if (data.status !== allowance.status) {
        const { data: staffUser } = await supabase
          .from('staff')
          .select('user_id')
          .eq('id', allowance.staffId)
          .single();

        if (staffUser?.user_id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: staffUser.user_id,
              title: 'Individual Allowance Updated',
              message: `Your ${data.type.replace('_', ' ')} allowance has been updated. Status: ${data.status.replace('_', ' ')}.`,
              type: 'info',
            });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual allowance updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-allowances'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
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

  const onSubmit = (data: EditAllowanceFormData) => {
    updateAllowanceMutation.mutate(data);
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowance Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select allowance type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowanceTypes.map((type) => (
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
                  <FormLabel>Amount (NGN)</FormLabel>
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

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Period</FormLabel>
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="applied">Applied</SelectItem>
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
                      placeholder="Additional details about this allowance..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Update Notes:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Changes will be reflected in the next payroll processing</li>
                <li>Setting status to "Applied" marks it as processed</li>
                <li>Setting status to "Cancelled" removes it from future payroll</li>
                <li>Period changes affect when the allowance is included</li>
              </ul>
            </div>

              <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
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
                  'Update Allowance'
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
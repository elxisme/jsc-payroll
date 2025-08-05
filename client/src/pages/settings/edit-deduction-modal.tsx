import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const editDeductionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
  isActive: z.boolean(),
});

type EditDeductionFormData = z.infer<typeof editDeductionSchema>;

interface EditDeductionModalProps {
  open: boolean;
  onClose: () => void;
  deduction: any;
  onSuccess: () => void;
}

export function EditDeductionModal({ open, onClose, deduction, onSuccess }: EditDeductionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditDeductionFormData>({
    resolver: zodResolver(editDeductionSchema),
    defaultValues: {
      name: deduction?.name || '',
      type: deduction?.type || 'percentage',
      value: deduction?.value || 0,
      isActive: deduction?.is_active ?? true,
    },
  });

  // Reset form when deduction changes
  React.useEffect(() => {
    if (deduction) {
      form.reset({
        name: deduction.name || '',
        type: deduction.type || 'percentage',
        value: parseFloat(deduction.value) || 0,
        isActive: deduction.is_active ?? true,
      });
    }
  }, [deduction, form]);

  // Update deduction mutation
  const updateDeductionMutation = useMutation({
    mutationFn: async (data: EditDeductionFormData) => {
      const { data: updatedDeduction, error } = await supabase
        .from('deductions')
        .update({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
          is_active: data.isActive,
        })
        .eq('id', deduction.id)
        .select()
        .single();

      if (error) throw error;
      return updatedDeduction;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Deduction updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-deductions'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update deduction',
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Deduction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deduction Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
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
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable or disable this deduction
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateDeductionMutation.isPending}>
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
      </DialogContent>
    </Dialog>
  );
}
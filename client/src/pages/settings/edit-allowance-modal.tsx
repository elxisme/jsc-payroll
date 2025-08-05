import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logSystemEvent } from '@/lib/audit-logger';
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

const editAllowanceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
  isActive: z.boolean(),
});

type EditAllowanceFormData = z.infer<typeof editAllowanceSchema>;

interface EditAllowanceModalProps {
  open: boolean;
  onClose: () => void;
  allowance: any;
  onSuccess: () => void;
}

export function EditAllowanceModal({ open, onClose, allowance, onSuccess }: EditAllowanceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditAllowanceFormData>({
    resolver: zodResolver(editAllowanceSchema),
    defaultValues: {
      name: allowance?.name || '',
      type: allowance?.type || 'percentage',
      value: allowance?.value || 0,
      isActive: allowance?.is_active ?? true,
    },
  });

  // Reset form when allowance changes
  React.useEffect(() => {
    if (allowance) {
      form.reset({
        name: allowance.name || '',
        type: allowance.type || 'percentage',
        value: parseFloat(allowance.value) || 0,
        isActive: allowance.is_active ?? true,
      });
    }
  }, [allowance, form]);

  // Update allowance mutation
  const updateAllowanceMutation = useMutation({
    mutationFn: async (data: EditAllowanceFormData) => {
      // Store old values for audit logging
      const oldValues = {
        name: allowance.name,
        type: allowance.type,
        value: allowance.value,
        is_active: allowance.is_active,
      };

      const { data: updatedAllowance, error } = await supabase
        .from('allowances')
        .update({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
          is_active: data.isActive,
        })
        .eq('id', allowance.id)
        .select()
        .single();

      if (error) throw error;
      
      // Log the update for audit trail
      await logSystemEvent('allowance_updated', 'allowances', allowance.id, oldValues, data);
      
      return updatedAllowance;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-allowances'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update allowance',
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Allowance</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowance Name</FormLabel>
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
                      Enable or disable this allowance
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
              <Button type="submit" disabled={updateAllowanceMutation.isPending}>
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
      </DialogContent>
    </Dialog>
  );
}
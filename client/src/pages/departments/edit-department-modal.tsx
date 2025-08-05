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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const editDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().min(2, 'Department code must be at least 2 characters'),
  description: z.string().optional(),
});

type EditDepartmentFormData = z.infer<typeof editDepartmentSchema>;

interface EditDepartmentModalProps {
  open: boolean;
  onClose: () => void;
  department: any;
  onSuccess: () => void;
}

export function EditDepartmentModal({ open, onClose, department, onSuccess }: EditDepartmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditDepartmentFormData>({
    resolver: zodResolver(editDepartmentSchema),
    defaultValues: {
      name: department?.name || '',
      code: department?.code || '',
      description: department?.description || '',
    },
  });

  // Reset form when department changes
  React.useEffect(() => {
    if (department) {
      form.reset({
        name: department.name || '',
        code: department.code || '',
        description: department.description || '',
      });
    }
  }, [department, form]);

  // Update department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: async (data: EditDepartmentFormData) => {
      const { data: updatedDepartment, error } = await supabase
        .from('departments')
        .update({
          name: data.name,
          code: data.code.toUpperCase(),
          description: data.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', department.id)
        .select()
        .single();

      if (error) throw error;
      return updatedDepartment;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Department updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['departments-with-staff'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update department',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditDepartmentFormData) => {
    updateDepartmentMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Legal Affairs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., LEG" {...field} />
                  </FormControl>
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
                      placeholder="Department description" 
                      {...field} 
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateDepartmentMutation.isPending}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {updateDepartmentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Department'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
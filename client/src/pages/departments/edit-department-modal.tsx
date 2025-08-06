import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logDepartmentEvent } from '@/lib/audit-logger';
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
import { Loader2 } from 'lucide-react';

const editDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().min(2, 'Department code must be at least 2 characters'),
  // Allow headOfDepartment to be null or undefined
  headOfDepartment: z.string().nullable().optional(),
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
      headOfDepartment: department?.head_of_department || null,
      description: department?.description || '',
    },
  });

  // Reset form when department changes
  React.useEffect(() => {
    if (department) {
      form.reset({
        name: department.name || '',
        code: department.code || '',
        headOfDepartment: department.head_of_department || null,
        description: department.description || '',
      });
    }
  }, [department, form]);

  // Fetch staff for head of department selection
  const { data: staffMembers } = useQuery({
    queryKey: ['staff-for-hod'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, staff_id, first_name, last_name, position')
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Update department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: async (data: EditDepartmentFormData) => {
      const oldValues = {
        name: department.name,
        code: department.code,
        head_of_department: department.head_of_department,
        description: department.description,
      };

      const { data: updatedDepartment, error } = await supabase
        .from('departments')
        .update({
          name: data.name,
          code: data.code.toUpperCase(),
          head_of_department: data.headOfDepartment || null,
          description: data.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', department.id)
        .select();
      if (error) throw error;
      
      if (!updatedDepartment || updatedDepartment.length === 0) {
        throw new Error('Department not found or no changes were made.');
      }
      
      await logDepartmentEvent('updated', department.id, oldValues, data);
      
      return updatedDepartment[0];
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
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
              name="headOfDepartment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Head of Department (Optional)</FormLabel>
                  {/* FIX: Use the field's value directly. It can be null. */}
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Head of Department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* FIX: Removed the item with value="" */}
                      {staffMembers?.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.first_name} {staff.last_name} ({staff.staff_id})
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Department description" 
                      {...field}
                      // Ensure null/undefined values are handled gracefully
                      value={field.value || ''}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

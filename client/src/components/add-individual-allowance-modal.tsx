import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { addIndividualAllowance } from '@/lib/individual-payroll-utils';
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

const addAllowanceSchema = z.object({
  staffId: z.string().min(1, 'Staff member is required'),
  type: z.string().min(1, 'Allowance type is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  period: z.string().min(1, 'Period is required'),
  description: z.string().optional(),
});

type AddAllowanceFormData = z.infer<typeof addAllowanceSchema>;

interface AddIndividualAllowanceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStaffId?: string;
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

export function AddIndividualAllowanceModal({ 
  open, 
  onClose, 
  onSuccess, 
  preselectedStaffId 
}: AddIndividualAllowanceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddAllowanceFormData>({
    resolver: zodResolver(addAllowanceSchema),
    defaultValues: {
      staffId: preselectedStaffId || '',
      type: '',
      amount: 0,
      period: new Date().toISOString().slice(0, 7), // Current month
      description: '',
    },
  });

  // Reset form when modal opens/closes or preselected staff changes
  React.useEffect(() => {
    if (open) {
      form.reset({
        staffId: preselectedStaffId || '',
        type: '',
        amount: 0,
        period: new Date().toISOString().slice(0, 7),
        description: '',
      });
    }
  }, [open, preselectedStaffId, form]);

  // Fetch active staff for selection
  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ['active-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          id,
          staff_id,
          first_name,
          last_name,
          position,
          departments!staff_department_id_fkey (
            name
          )
        `)
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Add allowance mutation
  const addAllowanceMutation = useMutation({
    mutationFn: async (data: AddAllowanceFormData) => {
      await addIndividualAllowance({
        staffId: data.staffId,
        type: data.type,
        amount: data.amount,
        period: data.period,
        description: data.description,
        status: 'pending',
      });

      // Create notification for the staff member
      const selectedStaff = staff?.find(s => s.id === data.staffId);
      if (selectedStaff) {
        const { data: staffUser } = await supabase
          .from('staff')
          .select('user_id')
          .eq('id', data.staffId)
          .single();

        if (staffUser?.user_id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: staffUser.user_id,
              title: 'New Individual Allowance Added',
              message: `A ${data.type.replace('_', ' ')} allowance of ₦${data.amount.toLocaleString()} has been added for ${data.period}.`,
              type: 'info',
            });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual allowance added successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-allowances'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add individual allowance',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddAllowanceFormData) => {
    addAllowanceMutation.mutate(data);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span>Add Individual Allowance</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff Member</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!!preselectedStaffId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={staffLoading ? "Loading staff..." : "Select staff member"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staff?.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.first_name} {member.last_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {member.staff_id} • {member.departments?.name}
                            </span>
                          </div>
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
              <h4 className="font-medium text-blue-900 mb-2">Important Notes:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Individual allowances are added to the staff member's regular salary</li>
                <li>This allowance will be included in the selected pay period</li>
                <li>The allowance will be marked with an asterisk (*) on the payslip</li>
                <li>Status will be "Pending" until payroll is processed</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addAllowanceMutation.isPending}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {addAllowanceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Allowance'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
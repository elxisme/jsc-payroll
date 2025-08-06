import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { addIndividualDeduction } from '@/lib/individual-payroll-utils';
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
import { Loader2, Minus } from 'lucide-react';

const addDeductionSchema = z.object({
  staffId: z.string().min(1, 'Staff member is required'),
  type: z.string().min(1, 'Deduction type is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  totalAmount: z.number().optional(),
  period: z.string().min(1, 'Period is required'),
  startPeriod: z.string().optional(),
  endPeriod: z.string().optional(),
  description: z.string().optional(),
});

type AddDeductionFormData = z.infer<typeof addDeductionSchema>;

interface AddIndividualDeductionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStaffId?: string;
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

export function AddIndividualDeductionModal({ 
  open, 
  onClose, 
  onSuccess, 
  preselectedStaffId 
}: AddIndividualDeductionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddDeductionFormData>({
    resolver: zodResolver(addDeductionSchema),
    defaultValues: {
      staffId: preselectedStaffId || '',
      type: '',
      amount: 0,
      totalAmount: undefined,
      period: new Date().toISOString().slice(0, 7), // Current month
      startPeriod: '',
      endPeriod: '',
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
        totalAmount: undefined,
        period: new Date().toISOString().slice(0, 7),
        startPeriod: '',
        endPeriod: '',
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

  // Add deduction mutation
  const addDeductionMutation = useMutation({
    mutationFn: async (data: AddDeductionFormData) => {
      await addIndividualDeduction({
        staffId: data.staffId,
        type: data.type,
        amount: data.amount,
        totalAmount: data.totalAmount,
        remainingBalance: data.totalAmount || data.amount,
        period: data.period,
        startPeriod: data.startPeriod,
        endPeriod: data.endPeriod,
        description: data.description,
        status: 'active',
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
              title: 'New Individual Deduction Added',
              message: `A ${data.type.replace('_', ' ')} deduction of ₦${data.amount.toLocaleString()} has been added for ${data.period}.`,
              type: 'info',
            });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Individual deduction added successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-individual-deductions'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add individual deduction',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddDeductionFormData) => {
    addDeductionMutation.mutate(data);
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
            <span>Add Individual Deduction</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
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
                  <FormLabel>Start Period</FormLabel>
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
              <h4 className="font-medium text-red-900 mb-2">Important Notes:</h4>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Individual deductions are subtracted from the staff member's salary</li>
                <li>This deduction will be included in the selected pay period</li>
                <li>For loans, specify the total amount and monthly deduction</li>
                <li>Status will be "Active" until fully paid or cancelled</li>
              </ul>
            </div>

              <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addDeductionMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {addDeductionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Deduction'
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
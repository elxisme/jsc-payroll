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
import { Switch } from '@/components/ui/switch';
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
  isRecurring: z.boolean().default(false),
}).refine((data) => {
  // If it's a loan type, total amount is required
  if (data.type.includes('loan') || data.type.includes('advance')) {
    return data.totalAmount && data.totalAmount > 0;
  }
  return true;
}, {
  message: "Total amount is required for loans and advances",
  path: ["totalAmount"],
});

type AddDeductionFormData = z.infer<typeof addDeductionSchema>;

interface AddIndividualDeductionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStaffId?: string;
}

const deductionTypes = [
  { value: 'loan_repayment', label: 'Loan Repayment', requiresTotal: true },
  { value: 'salary_advance', label: 'Salary Advance Recovery', requiresTotal: true },
  { value: 'cooperative_deduction', label: 'Cooperative Deduction', requiresTotal: false },
  { value: 'fine', label: 'Fine/Penalty', requiresTotal: false },
  { value: 'uniform_deduction', label: 'Uniform Deduction', requiresTotal: false },
  { value: 'training_cost', label: 'Training Cost Recovery', requiresTotal: true },
  { value: 'equipment_damage', label: 'Equipment Damage', requiresTotal: false },
  { value: 'overpayment_recovery', label: 'Overpayment Recovery', requiresTotal: true },
  { value: 'other', label: 'Other Deduction', requiresTotal: false },
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
      period: new Date().toISOString().slice(0, 7),
      startPeriod: new Date().toISOString().slice(0, 7),
      endPeriod: '',
      description: '',
      isRecurring: false,
    },
  });

  // Watch for type changes to show/hide total amount field
  const selectedType = form.watch('type');
  const isRecurring = form.watch('isRecurring');
  const selectedDeductionType = deductionTypes.find(t => t.value === selectedType);

  // Reset form when modal opens/closes or preselected staff changes
  React.useEffect(() => {
    if (open) {
      form.reset({
        staffId: preselectedStaffId || '',
        type: '',
        amount: 0,
        totalAmount: undefined,
        period: new Date().toISOString().slice(0, 7),
        startPeriod: new Date().toISOString().slice(0, 7),
        endPeriod: '',
        description: '',
        isRecurring: false,
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
      const deductionData = {
        staffId: data.staffId,
        type: data.type,
        amount: data.amount,
        totalAmount: data.totalAmount,
        remainingBalance: data.totalAmount || data.amount,
        period: data.period,
        startPeriod: data.startPeriod,
        endPeriod: data.endPeriod,
        description: data.description,
        status: 'active' as const,
      };

      await addIndividualDeduction(deductionData);

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
              title: 'New Deduction Added',
              message: `A ${data.type.replace('_', ' ')} deduction of ₦${data.amount.toLocaleString()} has been added${data.totalAmount ? ` (Total: ₦${data.totalAmount.toLocaleString()})` : ''}.`,
              type: 'warning',
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedDeductionType?.requiresTotal ? 'Monthly Deduction (NGN)' : 'Amount (NGN)'}
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

              {selectedDeductionType?.requiresTotal && (
                <FormField
                  control={form.control}
              <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount (NGN)</FormLabel>
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
            </div>

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
                    Deduction starts: {field.value ? formatPeriod(field.value) : 'None'}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedDeductionType?.requiresTotal && (
              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Recurring Deduction</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Continue deducting until total amount is recovered
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
            )}

            {isRecurring && selectedDeductionType?.requiresTotal && (
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
                    <div className="text-xs text-gray-500 mt-1">
                      Leave empty for automatic calculation based on total amount
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2">Important Notes:</h4>
              <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                <li>Individual deductions are subtracted from the staff member's salary</li>
                <li>Loan repayments will automatically track remaining balance</li>
                <li>The deduction will be marked with an asterisk (*) on the payslip</li>
                <li>Status will be "Active" and continue until paid off or cancelled</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
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
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { 
  createLoan, 
  getCooperativeOrganizations, 
  calculateLoanScheduleRPC 
} from '@/lib/individual-payroll-utils';
import { logLoanEvent } from '@/lib/audit-logger';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calculator, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const addLoanSchema = z.object({
  staffId: z.string().min(1, 'Staff member is required'),
  cooperativeId: z.string().optional(),
  loanType: z.enum(['salary_advance', 'cooperative_loan', 'personal_loan', 'emergency_loan']),
  totalLoanAmount: z.number().min(1, 'Loan amount must be greater than 0'),
  interestRate: z.number().min(0).max(100),
  interestCalculationMethod: z.enum(['flat', 'reducing_balance']),
  numberOfInstallments: z.number().min(1, 'Number of installments must be at least 1'),
  startDate: z.string().min(1, 'Start date is required'),
  monthlyPrincipalAmount: z.number().min(0).optional(),
  monthlyInterestAmount: z.number().min(0).optional(),
  monthlyTotalDeduction: z.number().min(1, 'Monthly deduction must be greater than 0'),
  notes: z.string().optional(),
  status: z.enum(['pending', 'active']),
});

type AddLoanFormData = z.infer<typeof addLoanSchema>;

interface AddLoanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStaffId?: string;
}

export function AddLoanModal({ open, onClose, onSuccess, preselectedStaffId }: AddLoanModalProps) {
  const [calculatedSchedule, setCalculatedSchedule] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddLoanFormData>({
    resolver: zodResolver(addLoanSchema),
    defaultValues: {
      staffId: preselectedStaffId || '',
      cooperativeId: '',
      loanType: 'personal_loan',
      totalLoanAmount: 0,
      interestRate: 0,
      interestCalculationMethod: 'flat',
      numberOfInstallments: 12,
      startDate: new Date().toISOString().split('T')[0],
      monthlyPrincipalAmount: 0,
      monthlyInterestAmount: 0,
      monthlyTotalDeduction: 0,
      notes: '',
      status: 'pending',
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.reset({
        staffId: preselectedStaffId || '',
        cooperativeId: '',
        loanType: 'personal_loan',
        totalLoanAmount: 0,
        interestRate: 0,
        interestCalculationMethod: 'flat',
        numberOfInstallments: 12,
        startDate: new Date().toISOString().split('T')[0],
        monthlyPrincipalAmount: 0,
        monthlyInterestAmount: 0,
        monthlyTotalDeduction: 0,
        notes: '',
        status: 'pending',
      });
      setCalculatedSchedule(null);
    }
  }, [open, preselectedStaffId, form]);

  // Fetch active staff
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

  // Fetch cooperatives
  const { data: cooperatives } = useQuery({
    queryKey: ['cooperative-organizations'],
    queryFn: getCooperativeOrganizations,
    enabled: open,
  });

  // Watch form values for automatic calculation
  const totalLoanAmount = form.watch('totalLoanAmount');
  const interestRate = form.watch('interestRate');
  const numberOfInstallments = form.watch('numberOfInstallments');
  const interestCalculationMethod = form.watch('interestCalculationMethod');

  // Auto-calculate loan schedule when key values change
  useEffect(() => {
    const calculateSchedule = async () => {
      if (totalLoanAmount > 0 && numberOfInstallments > 0) {
        setIsCalculating(true);
        try {
          const schedule = await calculateLoanScheduleRPC(
            totalLoanAmount,
            interestRate,
            numberOfInstallments,
            interestCalculationMethod
          );
          
          setCalculatedSchedule(schedule);
          
          // Auto-fill calculated values
          form.setValue('monthlyPrincipalAmount', schedule.monthlyPrincipal);
          form.setValue('monthlyInterestAmount', schedule.monthlyInterest);
          form.setValue('monthlyTotalDeduction', schedule.monthlyTotal);
        } catch (error) {
          console.error('Error calculating loan schedule:', error);
        } finally {
          setIsCalculating(false);
        }
      }
    };

    const timeoutId = setTimeout(calculateSchedule, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [totalLoanAmount, interestRate, numberOfInstallments, interestCalculationMethod, form]);

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async (data: AddLoanFormData) => {
      // Calculate end date
      const startDate = new Date(data.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + data.numberOfInstallments);

      const loan = await createLoan({
        staffId: data.staffId,
        cooperativeId: data.cooperativeId || undefined,
        loanType: data.loanType,
        totalLoanAmount: data.totalLoanAmount,
        interestRate: data.interestRate,
        interestCalculationMethod: data.interestCalculationMethod,
        totalInterestCharged: calculatedSchedule?.totalInterest || 0,
        monthlyPrincipalAmount: data.monthlyPrincipalAmount || 0,
        monthlyInterestAmount: data.monthlyInterestAmount || 0,
        monthlyTotalDeduction: data.monthlyTotalDeduction,
        numberOfInstallments: data.numberOfInstallments,
        startDate: data.startDate,
        endDate: endDate.toISOString().split('T')[0],
        status: data.status,
        notes: data.notes,
      });

      await logLoanEvent('created', loan.id, null, data);
      return loan;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Loan created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create loan',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddLoanFormData) => {
    createLoanMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setCalculatedSchedule(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Loan</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Loan Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  name="cooperativeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cooperative (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cooperative or leave blank for direct loan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cooperatives?.filter(c => c.isActive).map((cooperative) => (
                            <SelectItem key={cooperative.id} value={cooperative.id}>
                              {cooperative.name}
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
                  name="loanType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="salary_advance">Salary Advance</SelectItem>
                          <SelectItem value="cooperative_loan">Cooperative Loan</SelectItem>
                          <SelectItem value="personal_loan">Personal Loan</SelectItem>
                          <SelectItem value="emergency_loan">Emergency Loan</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending Approval</SelectItem>
                          <SelectItem value="active">Active (Approved)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Loan Terms */}
            <div>
              <h4 className="text-md font-medium mb-4">Loan Terms</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalLoanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Loan Amount (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
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
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (% per annum)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
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
                  name="interestCalculationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Calculation Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="flat">Flat Interest</SelectItem>
                          <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberOfInstallments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Installments</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Calculated Schedule */}
            {calculatedSchedule && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900">Calculated Loan Schedule</h4>
                    {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Monthly Principal</p>
                      <p className="font-medium">₦{calculatedSchedule.monthlyPrincipal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Monthly Interest</p>
                      <p className="font-medium">₦{calculatedSchedule.monthlyInterest.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Monthly Total</p>
                      <p className="font-medium text-blue-600">₦{calculatedSchedule.monthlyTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Interest</p>
                      <p className="font-medium">₦{calculatedSchedule.totalInterest.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Override Section */}
            <div>
              <h4 className="text-md font-medium mb-4">Monthly Deduction (Override if needed)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="monthlyPrincipalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Principal (NGN)</FormLabel>
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

                <FormField
                  control={form.control}
                  name="monthlyInterestAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Interest (NGN)</FormLabel>
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

                <FormField
                  control={form.control}
                  name="monthlyTotalDeduction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Total Deduction (NGN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes about this loan..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The loan will be created with the specified terms. If status is set to "Active", 
                monthly deductions will begin immediately in the next payroll run.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLoanMutation.isPending || isCalculating}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {createLoanMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Loan'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
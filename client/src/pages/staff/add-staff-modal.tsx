import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const addStaffSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().optional(),
  departmentId: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  gradeLevel: z.number().min(1).max(17),
  step: z.number().min(1).max(15),
  employmentDate: z.string().min(1, 'Employment date is required'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
});

type AddStaffFormData = z.infer<typeof addStaffSchema>;

interface AddStaffModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStaffModal({ open, onClose, onSuccess }: AddStaffModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddStaffFormData>({
    resolver: zodResolver(addStaffSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phoneNumber: '',
      departmentId: '',
      position: '',
      gradeLevel: 1,
      step: 1,
      employmentDate: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
    },
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Generate staff ID
  const generateStaffId = async () => {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('staff')
      .select('id', { count: 'exact' });
    
    const nextNumber = (count || 0) + 1;
    return `JSC/${year}/${nextNumber.toString().padStart(5, '0')}`;
  };

  // Create staff mutation
  const createStaffMutation = useMutation({
    mutationFn: async (data: AddStaffFormData) => {
      const staffId = await generateStaffId();
      
      const { data: staff, error } = await supabase
        .from('staff')
        .insert({
          staff_id: staffId,
          first_name: data.firstName,
          last_name: data.lastName,
          middle_name: data.middleName || null,
          email: data.email,
          phone_number: data.phoneNumber || null,
          department_id: data.departmentId,
          position: data.position,
          grade_level: data.gradeLevel,
          step: data.step,
          employment_date: data.employmentDate,
          bank_name: data.bankName || null,
          account_number: data.accountNumber || null,
          account_name: data.accountName || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return staff;
    },
    onSuccess: () => {
      // Create notification for admins about new staff
      supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'payroll_admin'])
        .then(({ data: adminUsers }) => {
          if (adminUsers?.length) {
            const notifications = adminUsers.map(admin => ({
              user_id: admin.id,
              title: 'New Staff Member Added',
              message: `A new staff member has been added to the system and requires review.`,
              type: 'info',
            }));

            supabase
              .from('notifications')
              .insert(notifications);
          }
        });

      toast({
        title: 'Success',
        description: 'Staff member created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create staff member',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddStaffFormData) => {
    createStaffMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Middle Name (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Employment Information */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Employment Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
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
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade Level</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Grade Level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...Array(17)].map((_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              GL {i + 1}
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
                  name="step"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Step</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Step" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...Array(15)].map((_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              Step {i + 1}
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
                  name="employmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Banking Information */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Banking Information (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Bank" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="access">Access Bank</SelectItem>
                          <SelectItem value="gtb">Guaranty Trust Bank</SelectItem>
                          <SelectItem value="firstbank">First Bank of Nigeria</SelectItem>
                          <SelectItem value="zenith">Zenith Bank</SelectItem>
                          <SelectItem value="uba">United Bank for Africa</SelectItem>
                          <SelectItem value="fidelity">Fidelity Bank</SelectItem>
                          <SelectItem value="union">Union Bank</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createStaffMutation.isPending}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {createStaffMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Staff Member'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logStaffEvent } from '@/lib/audit-logger';
import { initializeStaffLeaveBalances } from '@/lib/leave-management-utils';
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
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  pensionPin: z.string().optional(),
  taxPin: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinAddress: z.string().optional(),
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
      pensionPin: '',
      taxPin: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
      nextOfKinName: '',
      nextOfKinRelationship: '',
      nextOfKinPhone: '',
      nextOfKinAddress: '',
    },
  });

  // Fetch departments
  const { data: departments, isLoading: isLoadingDepartments } = useQuery({
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
    const { count, error } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true });

    if (error) {
        console.error("Error counting staff:", error);
        throw new Error("Could not generate staff ID due to a database error.");
    }
    
    const nextNumber = (count || 0) + 1;
    return `JSC/${year}/${nextNumber.toString().padStart(5, '0')}`;
  };

  // Create staff mutation
  const createStaffMutation = useMutation({
    mutationFn: async (data: AddStaffFormData) => {
      const defaultPassword = 'TempPassword123!';
      
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: defaultPassword,
        options: {
          emailRedirectTo: undefined,
        }
      });

      if (authError) {
        if (authError.message.includes('already registered') || 
            authError.message.includes('User already registered') ||
            authError.message.includes('email address is already registered')) {
          throw new Error(`This email address (${data.email}) is already registered in the system. Please use a different email address or check if the staff member already exists.`);
        }
        throw authError;
      }

      if (!authUser.user) {
        throw new Error('Failed to create user account');
      }

      const { error: userProfileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: data.email,
          role: 'staff',
        });

      if (userProfileError) {
        console.error('Failed to create user profile:', userProfileError);
        throw new Error('Failed to create user profile');
      }

      const staffId = await generateStaffId();
      
      const staffData = {
        staff_id: staffId,
        user_id: authUser.user.id,
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
        pension_pin: data.pensionPin || null,
        tax_pin: data.taxPin || null,
        next_of_kin: (data.nextOfKinName || data.nextOfKinRelationship || data.nextOfKinPhone || data.nextOfKinAddress) ? {
          name: data.nextOfKinName || null,
          relationship: data.nextOfKinRelationship || null,
          phone: data.nextOfKinPhone || null,
          address: data.nextOfKinAddress || null,
        } : null,
        status: 'active',
      };

      const { data: staff, error } = await supabase
        .from('staff')
        .insert(staffData)
        .select()
        .single();

      if (error) throw error;
      
      await logStaffEvent('created', staff.id, null, staffData);
      
      // Initialize leave balances for the new staff member
      await initializeStaffLeaveBalances(staff.id);
      
      await supabase
        .from('notifications')
        .insert({
          user_id: authUser.user.id,
          title: 'Welcome to JSC Payroll System',
          message: `Your account has been created. Please use the "Forgot Password" link on the login page to set your password and access your account.`,
          type: 'info',
        });
      
      return staff;
    },
    onSuccess: (newStaff) => {
      supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'payroll_admin'])
        .then(({ data: adminUsers }) => {
          if (adminUsers?.length) {
            const notifications = adminUsers.map(admin => ({
              user_id: admin.id,
              title: 'New Staff Member Added',
              message: `A new staff member, ${newStaff.first_name} ${newStaff.last_name}, has been added with a user account. They should use "Forgot Password" to set their password.`,
              type: 'info',
            }));

            supabase
              .from('notifications')
              .insert(notifications)
              .then();
          }
        });

      toast({
        title: 'Success',
        description: 'Staff member and user account created successfully. They can use "Forgot Password" to set their password.',
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A user account will be automatically created for this staff member. They can use "Forgot Password" on the login page to set their own password.
            </AlertDescription>
          </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. John" />
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
                        <Input {...field} placeholder="e.g. Doe" />
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
                        <Input type="email" {...field} placeholder="e.g. user@example.com" />
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
                        <Input {...field} placeholder="e.g. 08012345678" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Employment Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Employment Information</h4>
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
                            <SelectValue placeholder={isLoadingDepartments ? "Loading..." : "Select Department"} />
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
                        <Input {...field} placeholder="e.g. Software Engineer" />
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

                <FormField
                  control={form.control}
                  name="pensionPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pension PIN (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., PEN123456" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxPin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID/PIN (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., TIN123456" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Banking Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Banking Information (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Bank" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* FIX: Removed the item with value="" */}
                          <SelectItem value="access">Access Bank</SelectItem>
                          <SelectItem value="zenith">Zenith Bank</SelectItem>
                          <SelectItem value="gtb">Guaranty Trust Bank</SelectItem>
                          <SelectItem value="firstbank">First Bank of Nigeria</SelectItem>
                          <SelectItem value="uba">United Bank for Africa</SelectItem>
                          <SelectItem value="fidelity">Fidelity Bank</SelectItem>
                          <SelectItem value="union">Union Bank</SelectItem>
                          <SelectItem value="stanbic">Stanbic IBTC Bank</SelectItem>
                          <SelectItem value="polaris">Polaris Bank</SelectItem>
                          <SelectItem value="wema">Wema Bank</SelectItem>
                          <SelectItem value="sterling">Sterling Bank</SelectItem>
                          <SelectItem value="unity">Unity Bank</SelectItem>
                          <SelectItem value="ecobank">Ecobank Nigeria</SelectItem>
                          <SelectItem value="keystone">Keystone Bank</SelectItem>
                          <SelectItem value="titan">Titan Trust Bank</SelectItem>
                          <SelectItem value="globus">Globus Bank</SelectItem>
                          <SelectItem value="providus">Providus Bank</SelectItem>
                          <SelectItem value="suntrust">SunTrust Bank</SelectItem>
                          <SelectItem value="parallex">Parallex Bank</SelectItem>
                          <SelectItem value="premium">Premium Trust Bank</SelectItem>
                          <SelectItem value="taj">TAJ Bank</SelectItem>
                          <SelectItem value="jaiz">Jaiz Bank</SelectItem>
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
                        <Input {...field} placeholder="10-digit number" />
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
                        <Input {...field} placeholder="Official name on the account" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Next of Kin Information */}
            <div>
              <h4 className="text-md font-medium mb-4">Next of Kin Information (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nextOfKinName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Jane Doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextOfKinRelationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="spouse">Spouse</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="relative">Other Relative</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextOfKinPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 08012345678" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextOfKinAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 123 Main Street, Lagos" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t bg-white sticky bottom-0">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

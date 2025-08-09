import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logStaffEvent } from '@/lib/audit-logger';
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

const editStaffSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().optional(),
  departmentId: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  gradeLevel: z.number().min(1).max(17),
  step: z.number().min(1).max(15),
  status: z.enum(['active', 'on_leave', 'retired', 'terminated']),
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

type EditStaffFormData = z.infer<typeof editStaffSchema>;

interface EditStaffModalProps {
  open: boolean;
  onClose: () => void;
  staff: any;
  onSuccess: () => void;
}

export function EditStaffModal({ open, onClose, staff, onSuccess }: EditStaffModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditStaffFormData>({
    resolver: zodResolver(editStaffSchema),
  });

  // Reset form when staff data changes
  React.useEffect(() => {
    if (staff) {
      // Extract next of kin details from JSON object
      const nextOfKin = staff.next_of_kin || {};
      
      form.reset({
        firstName: staff.first_name || '',
        lastName: staff.last_name || '',
        middleName: staff.middle_name || '',
        email: staff.email || '',
        phoneNumber: staff.phone_number || '',
        departmentId: staff.department_id || '',
        position: staff.position || '',
        gradeLevel: staff.grade_level || 1,
        step: staff.step || 1,
        status: staff.status || 'active',
        pensionPin: staff.pension_pin || '',
        taxPin: staff.tax_pin || '',
        bankName: staff.bank_name || '',
        accountNumber: staff.account_number || '',
        accountName: staff.account_name || '',
        nextOfKinName: nextOfKin.name || '',
        nextOfKinRelationship: nextOfKin.relationship || '',
        nextOfKinPhone: nextOfKin.phone || '',
        nextOfKinAddress: nextOfKin.address || '',
      });
    }
  }, [staff, form]);

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

  // Update staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: async (data: EditStaffFormData) => {
      const oldValues = { ...staff };
      const newValues = {
        first_name: data.firstName,
        last_name: data.lastName,
        middle_name: data.middleName || null,
        email: data.email,
        phone_number: data.phoneNumber || null,
        department_id: data.departmentId,
        position: data.position,
        grade_level: data.gradeLevel,
        step: data.step,
        status: data.status,
        pension_pin: data.pensionPin || null,
        tax_pin: data.taxPin || null,
        bank_name: data.bankName || null,
        account_number: data.accountNumber || null,
        account_name: data.accountName || null,
        next_of_kin: (data.nextOfKinName || data.nextOfKinRelationship || data.nextOfKinPhone || data.nextOfKinAddress) ? {
          name: data.nextOfKinName || null,
          relationship: data.nextOfKinRelationship || null,
          phone: data.nextOfKinPhone || null,
          address: data.nextOfKinAddress || null,
        } : null,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedStaff, error } = await supabase
        .from('staff')
        .update(newValues)
        .eq('id', staff.id)
        .select()
        .single();

      if (error) throw error;

      await logStaffEvent('updated', staff.id, oldValues, newValues);

      return updatedStaff;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Staff member updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff', staff.id] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update staff member',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditStaffFormData) => {
    updateStaffMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
        </DialogHeader>

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
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
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
            <div className="flex justify-end space-x-3 pt-6">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateStaffMutation.isPending}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {updateStaffMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Staff Member'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
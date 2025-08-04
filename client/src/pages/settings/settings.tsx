import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings as SettingsIcon, 
  Users, 
  Calculator, 
  Database,
  Save,
  Plus,
  Edit,
  Trash2,
  Shield,
  Loader2
} from 'lucide-react';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().min(1, 'Role is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const editUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().min(1, 'Role is required'),
});

const salaryStructureSchema = z.object({
  gradeLevel: z.number().min(1).max(17),
  step: z.number().min(1).max(15),
  basicSalary: z.number().min(0),
});

const allowanceSchema = z.object({
  name: z.string().min(1, 'Allowance name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
});

const deductionSchema = z.object({
  name: z.string().min(1, 'Deduction name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
});
type UserFormData = z.infer<typeof userSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type SalaryStructureFormData = z.infer<typeof salaryStructureSchema>;
type AllowanceFormData = z.infer<typeof allowanceSchema>;
type DeductionFormData = z.infer<typeof deductionSchema>;

export default function Settings() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [showAddAllowance, setShowAddAllowance] = useState(false);
  const [showEditAllowance, setShowEditAllowance] = useState(false);
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [showEditDeduction, setShowEditDeduction] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; item: any }>({
    open: false,
    type: '',
    item: null,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      role: '',
      password: '',
    },
  });

  const editUserForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: '',
      role: '',
    },
  });
  const salaryForm = useForm<SalaryStructureFormData>({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: {
      gradeLevel: 1,
      step: 1,
      basicSalary: 0,
    },
  });

  const editSalaryForm = useForm<SalaryStructureFormData>({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: {
      gradeLevel: 1,
      step: 1,
      basicSalary: 0,
    },
  });

  const allowanceForm = useForm<AllowanceFormData>({
    resolver: zodResolver(allowanceSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
    },
  });

  const editAllowanceForm = useForm<AllowanceFormData>({
    resolver: zodResolver(allowanceSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
    },
  });

  const deductionForm = useForm<DeductionFormData>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
    },
  });

  const editDeductionForm = useForm<DeductionFormData>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
    },
  });
  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch salary structure
  const { data: salaryStructure, isLoading: salaryLoading } = useQuery({
    queryKey: ['salary-structure'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_structure')
        .select('*')
        .order('grade_level', { ascending: true })
        .order('step', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch allowances
  const { data: allowances, isLoading: allowancesLoading } = useQuery({
    queryKey: ['allowances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allowances')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deductions
  const { data: deductions, isLoading: deductionsLoading } = useQuery({
    queryKey: ['deductions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deductions')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      // First, sign up the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User not returned after signup');
      }

      // The handle_new_user trigger will have created an entry in public.users
      // Now, update the role for that user in public.users
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role: data.role })
        .eq('id', authData.user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedUser;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      userForm.reset();
      setShowAddUser(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (data: EditUserFormData & { id: string }) => {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ 
          email: data.email,
          role: data.role 
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return updatedUser;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      editUserForm.reset();
      setShowEditUser(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteDialog({ open: false, type: '', item: null });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  // Create salary structure mutation
  const createSalaryMutation = useMutation({
    mutationFn: async (data: SalaryStructureFormData) => {
      const { data: salary, error } = await supabase
        .from('salary_structure')
        .insert({
          grade_level: data.gradeLevel,
          step: data.step,
          basic_salary: data.basicSalary.toString(),
        })
        .select()
        .single();

      if (error) throw error;
      return salary;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Salary structure entry created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['salary-structure'] });
      salaryForm.reset();
      setShowAddSalary(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create salary structure',
        variant: 'destructive',
      });
    },
  });

  // Edit salary structure mutation
  const editSalaryMutation = useMutation({
    mutationFn: async (data: SalaryStructureFormData & { id: string }) => {
      const { data: salary, error } = await supabase
        .from('salary_structure')
        .update({
          grade_level: data.gradeLevel,
          step: data.step,
          basic_salary: data.basicSalary.toString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return salary;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Salary structure updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['salary-structure'] });
      editSalaryForm.reset();
      setShowEditSalary(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update salary structure',
        variant: 'destructive',
      });
    },
  });

  // Delete salary structure mutation
  const deleteSalaryMutation = useMutation({
    mutationFn: async (salaryId: string) => {
      const { error } = await supabase
        .from('salary_structure')
        .delete()
        .eq('id', salaryId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Salary structure entry deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['salary-structure'] });
      setDeleteDialog({ open: false, type: '', item: null });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete salary structure',
        variant: 'destructive',
      });
    },
  });

  // Create allowance mutation
  const createAllowanceMutation = useMutation({
    mutationFn: async (data: AllowanceFormData) => {
      const { data: allowance, error } = await supabase
        .from('allowances')
        .insert({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return allowance;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['allowances'] });
      allowanceForm.reset();
      setShowAddAllowance(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create allowance',
        variant: 'destructive',
      });
    },
  });

  // Edit allowance mutation
  const editAllowanceMutation = useMutation({
    mutationFn: async (data: AllowanceFormData & { id: string }) => {
      const { data: allowance, error } = await supabase
        .from('allowances')
        .update({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return allowance;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['allowances'] });
      editAllowanceForm.reset();
      setShowEditAllowance(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update allowance',
        variant: 'destructive',
      });
    },
  });

  // Delete allowance mutation
  const deleteAllowanceMutation = useMutation({
    mutationFn: async (allowanceId: string) => {
      const { error } = await supabase
        .from('allowances')
        .delete()
        .eq('id', allowanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['allowances'] });
      setDeleteDialog({ open: false, type: '', item: null });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete allowance',
        variant: 'destructive',
      });
    },
  });

  // Create deduction mutation
  const createDeductionMutation = useMutation({
    mutationFn: async (data: DeductionFormData) => {
      const { data: deduction, error } = await supabase
        .from('deductions')
        .insert({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return deduction;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Deduction created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['deductions'] });
      deductionForm.reset();
      setShowAddDeduction(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create deduction',
        variant: 'destructive',
      });
    },
  });

  // Edit deduction mutation
  const editDeductionMutation = useMutation({
    mutationFn: async (data: DeductionFormData & { id: string }) => {
      const { data: deduction, error } = await supabase
        .from('deductions')
        .update({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return deduction;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Deduction updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['deductions'] });
      editDeductionForm.reset();
      setShowEditDeduction(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update deduction',
        variant: 'destructive',
      });
    },
  });

  // Delete deduction mutation
  const deleteDeductionMutation = useMutation({
    mutationFn: async (deductionId: string) => {
      const { error } = await supabase
        .from('deductions')
        .delete()
        .eq('id', deductionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Deduction deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['deductions'] });
      setDeleteDialog({ open: false, type: '', item: null });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete deduction',
        variant: 'destructive',
      });
    },
  });
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'account_admin':
        return 'Account Manager';
      case 'payroll_admin':
        return 'Payroll Manager';
      case 'staff':
        return 'Staff';
      default:
        return 'Unknown';
    }
  };

  const handleEditUser = (user: any) => {
    setSelectedItem(user);
    editUserForm.setValue('email', user.email);
    editUserForm.setValue('role', user.role);
    setShowEditUser(true);
  };

  const handleEditSalary = (salary: any) => {
    setSelectedItem(salary);
    editSalaryForm.setValue('gradeLevel', salary.grade_level);
    editSalaryForm.setValue('step', salary.step);
    editSalaryForm.setValue('basicSalary', parseFloat(salary.basic_salary));
    setShowEditSalary(true);
  };

  const handleEditAllowance = (allowance: any) => {
    setSelectedItem(allowance);
    editAllowanceForm.setValue('name', allowance.name);
    editAllowanceForm.setValue('type', allowance.type);
    editAllowanceForm.setValue('value', parseFloat(allowance.value));
    setShowEditAllowance(true);
  };

  const handleEditDeduction = (deduction: any) => {
    setSelectedItem(deduction);
    editDeductionForm.setValue('name', deduction.name);
    editDeductionForm.setValue('type', deduction.type);
    editDeductionForm.setValue('value', parseFloat(deduction.value));
    setShowEditDeduction(true);
  };

  const handleDelete = (type: string, item: any) => {
    setDeleteDialog({ open: true, type, item });
  };

  const confirmDelete = () => {
    const { type, item } = deleteDialog;
    switch (type) {
      case 'user':
        deleteUserMutation.mutate(item.id);
        break;
      case 'salary':
        deleteSalaryMutation.mutate(item.id);
        break;
      case 'allowance':
        deleteAllowanceMutation.mutate(item.id);
        break;
      case 'deduction':
        deleteDeductionMutation.mutate(item.id);
        break;
    }
  };
  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">System Settings</h1>
        <p className="text-gray-600">Manage system configuration and administrative settings</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>User Management</span>
          </TabsTrigger>
          <TabsTrigger value="salary" className="flex items-center space-x-2">
            <Calculator className="h-4 w-4" />
            <span>Salary Structure</span>
          </TabsTrigger>
          <TabsTrigger value="allowances" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Allowances</span>
          </TabsTrigger>
          <TabsTrigger value="deductions" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Deductions</span>
          </TabsTrigger>
        </TabsList>

        {/* User Management */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Button
                  onClick={() => setShowAddUser(true)}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddUser && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Create New User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...userForm}>
                      <form onSubmit={userForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={userForm.control}
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
                            control={userForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Role</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="account_admin">Account Manager</SelectItem>
                                    <SelectItem value="payroll_admin">Payroll Manager</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={userForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Minimum 6 characters" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createUserMutation.isPending}
                            className="bg-nigeria-green hover:bg-green-700"
                          >
                            {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              {usersLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4 text-gray-400" />
                            <span>{getRoleDisplayName(user.role)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => handleDelete('user', user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Structure */}
        <TabsContent value="salary">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>CONJUSS Salary Structure</CardTitle>
                <Button
                  onClick={() => setShowAddSalary(true)}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddSalary && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Add Salary Structure Entry</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...salaryForm}>
                      <form onSubmit={salaryForm.handleSubmit((data) => createSalaryMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={salaryForm.control}
                            name="gradeLevel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Grade Level</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
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
                            control={salaryForm.control}
                            name="step"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Step</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
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
                            control={salaryForm.control}
                            name="basicSalary"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Basic Salary (NGN)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setShowAddSalary(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createSalaryMutation.isPending}
                            className="bg-nigeria-green hover:bg-green-700"
                          >
                            {createSalaryMutation.isPending ? 'Adding...' : 'Add Entry'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              {salaryLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-4 w-16"></div>
                      <div className="rounded bg-gray-200 h-4 w-16"></div>
                      <div className="rounded bg-gray-200 h-4 w-32"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grade Level</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryStructure?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>GL {entry.grade_level}</TableCell>
                        <TableCell>Step {entry.step}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(entry.basic_salary)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditSalary(entry)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => handleDelete('salary', entry)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allowances */}
        <TabsContent value="allowances">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Allowances Configuration</CardTitle>
                <Button
                  onClick={() => setShowAddAllowance(true)}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Allowance
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {allowancesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-4 w-32"></div>
                      <div className="rounded bg-gray-200 h-4 w-16"></div>
                      <div className="rounded bg-gray-200 h-4 w-20"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Allowance Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowances?.map((allowance) => (
                      <TableRow key={allowance.id}>
                        <TableCell className="font-medium">{allowance.name}</TableCell>
                        <TableCell className="capitalize">{allowance.type}</TableCell>
                        <TableCell>
                          {allowance.type === 'percentage' 
                            ? `${allowance.value}%` 
                            : formatCurrency(allowance.value)
                          }
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            allowance.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {allowance.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditAllowance(allowance)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => handleDelete('allowance', allowance)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Deductions Configuration</CardTitle>
                <Button
                  onClick={() => setShowAddDeduction(true)}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deduction
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deductionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-4 w-32"></div>
                      <div className="rounded bg-gray-200 h-4 w-16"></div>
                      <div className="rounded bg-gray-200 h-4 w-20"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deduction Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductions?.map((deduction) => (
                      <TableRow key={deduction.id}>
                        <TableCell className="font-medium">{deduction.name}</TableCell>
                        <TableCell className="capitalize">{deduction.type}</TableCell>
                        <TableCell>
                          {deduction.type === 'percentage' 
                            ? `${deduction.value}%` 
                            : formatCurrency(deduction.value)
                          }
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            deduction.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {deduction.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditDeduction(deduction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600"
                              onClick={() => handleDelete('deduction', deduction)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Modal */}
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit((data) => 
              editUserMutation.mutate({ ...data, id: selectedItem?.id })
            )} className="space-y-4">
              <FormField
                control={editUserForm.control}
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
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="account_admin">Account Manager</SelectItem>
                        <SelectItem value="payroll_admin">Payroll Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditUser(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editUserMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {editUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Salary Modal */}
      <Dialog open={showEditSalary} onOpenChange={setShowEditSalary}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Salary Structure</DialogTitle>
          </DialogHeader>
          <Form {...editSalaryForm}>
            <form onSubmit={editSalaryForm.handleSubmit((data) => 
              editSalaryMutation.mutate({ ...data, id: selectedItem?.id })
            )} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={editSalaryForm.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade Level</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  control={editSalaryForm.control}
                  name="step"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Step</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  control={editSalaryForm.control}
                  name="basicSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Basic Salary (NGN)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditSalary(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editSalaryMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {editSalaryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Entry'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Allowance Modal */}
      <Dialog open={showAddAllowance} onOpenChange={setShowAddAllowance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Allowance</DialogTitle>
          </DialogHeader>
          <Form {...allowanceForm}>
            <form onSubmit={allowanceForm.handleSubmit((data) => createAllowanceMutation.mutate(data))} className="space-y-4">
              <FormField
                control={allowanceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowance Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Housing Allowance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={allowanceForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
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
                control={allowanceForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Value {allowanceForm.watch('type') === 'percentage' ? '(%)' : '(NGN)'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder={allowanceForm.watch('type') === 'percentage' ? '20.0' : '15000'}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddAllowance(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAllowanceMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {createAllowanceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Allowance'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Allowance Modal */}
      <Dialog open={showEditAllowance} onOpenChange={setShowEditAllowance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Allowance</DialogTitle>
          </DialogHeader>
          <Form {...editAllowanceForm}>
            <form onSubmit={editAllowanceForm.handleSubmit((data) => 
              editAllowanceMutation.mutate({ ...data, id: selectedItem?.id })
            )} className="space-y-4">
              <FormField
                control={editAllowanceForm.control}
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
                control={editAllowanceForm.control}
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
                control={editAllowanceForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Value {editAllowanceForm.watch('type') === 'percentage' ? '(%)' : '(NGN)'}
                    </FormLabel>
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditAllowance(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editAllowanceMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {editAllowanceMutation.isPending ? (
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

      {/* Add Deduction Modal */}
      <Dialog open={showAddDeduction} onOpenChange={setShowAddDeduction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Deduction</DialogTitle>
          </DialogHeader>
          <Form {...deductionForm}>
            <form onSubmit={deductionForm.handleSubmit((data) => createDeductionMutation.mutate(data))} className="space-y-4">
              <FormField
                control={deductionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deduction Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pension Contribution" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={deductionForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
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
                control={deductionForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Value {deductionForm.watch('type') === 'percentage' ? '(%)' : '(NGN)'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder={deductionForm.watch('type') === 'percentage' ? '8.0' : '1000'}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddDeduction(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDeductionMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {createDeductionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Deduction'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Deduction Modal */}
      <Dialog open={showEditDeduction} onOpenChange={setShowEditDeduction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deduction</DialogTitle>
          </DialogHeader>
          <Form {...editDeductionForm}>
            <form onSubmit={editDeductionForm.handleSubmit((data) => 
              editDeductionMutation.mutate({ ...data, id: selectedItem?.id })
            )} className="space-y-4">
              <FormField
                control={editDeductionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deduction Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editDeductionForm.control}
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
                control={editDeductionForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Value {editDeductionForm.watch('type') === 'percentage' ? '(%)' : '(NGN)'}
                    </FormLabel>
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDeduction(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editDeductionMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {editDeductionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Deduction'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {deleteDialog.type} 
              {deleteDialog.item?.name || deleteDialog.item?.email || 'item'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Shield
} from 'lucide-react';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().min(1, 'Role is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'), // Make it required
});


const salaryStructureSchema = z.object({
  gradeLevel: z.number().min(1).max(17),
  step: z.number().min(1).max(15),
  basicSalary: z.number().min(0),
});

type UserFormData = z.infer<typeof userSchema>;
type SalaryStructureFormData = z.infer<typeof salaryStructureSchema>;

export default function Settings() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
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

  const salaryForm = useForm<SalaryStructureFormData>({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: {
      gradeLevel: 1,
      step: 1,
      basicSalary: 0,
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
  const { data: allowances } = useQuery({
    queryKey: ['allowances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allowances')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deductions
  const { data: deductions } = useQuery({
    queryKey: ['deductions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deductions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email: data.email,
          password: data.password || 'defaultpassword123',
          role: data.role,
        })
        .select()
        .single();

      if (error) throw error;
      return user;
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
                                <FormLabel>Password (Optional)</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Default: defaultpassword123" {...field} />
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
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600">
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
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600">
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
              <CardTitle>Allowances Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allowance Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowances?.map((allowance) => (
                    <TableRow key={allowance.id}>
                      <TableCell className="font-medium">{allowance.name}</TableCell>
                      <TableCell>{allowance.type}</TableCell>
                      <TableCell>
                        {allowance.type === 'percentage' 
                          ? `${allowance.value}%` 
                          : formatCurrency(allowance.value)
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader>
              <CardTitle>Deductions Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deduction Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions?.map((deduction) => (
                    <TableRow key={deduction.id}>
                      <TableCell className="font-medium">{deduction.name}</TableCell>
                      <TableCell>{deduction.type}</TableCell>
                      <TableCell>
                        {deduction.type === 'percentage' 
                          ? `${deduction.value}%` 
                          : formatCurrency(deduction.value)
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

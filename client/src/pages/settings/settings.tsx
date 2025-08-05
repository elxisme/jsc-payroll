import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logSystemEvent } from '@/lib/audit-logger';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { EditUserModal } from './edit-user-modal';
import { EditAllowanceModal } from './edit-allowance-modal';
import { EditDeductionModal } from './edit-deduction-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Settings as SettingsIcon, 
  Users, 
  DollarSign, 
  Plus, 
  Edit, 
  Trash2,
  Loader2,
  Shield,
  Database
} from 'lucide-react';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['super_admin', 'account_admin', 'payroll_admin', 'staff']),
});

const allowanceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
});

const deductionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
});

type UserFormData = z.infer<typeof userSchema>;
type AllowanceFormData = z.infer<typeof allowanceSchema>;
type DeductionFormData = z.infer<typeof deductionSchema>;

export default function Settings() {
  const { user } = useAuth();
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddAllowanceModal, setShowAddAllowanceModal] = useState(false);
  const [showAddDeductionModal, setShowAddDeductionModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditAllowanceModal, setShowEditAllowanceModal] = useState(false);
  const [showEditDeductionModal, setShowEditDeductionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedAllowance, setSelectedAllowance] = useState<any>(null);
  const [selectedDeduction, setSelectedDeduction] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      role: 'staff',
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

  const deductionForm = useForm<DeductionFormData>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
    },
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch allowances
  const { data: allowances, isLoading: allowancesLoading } = useQuery({
    queryKey: ['system-allowances'],
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
    queryKey: ['system-deductions'],
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
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', data.email)
        .single();

      if (existingUser) {
        throw new Error('A user with this email already exists');
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: data.email,
          role: data.role,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Log user creation
      await logSystemEvent('user_created', 'users', newUser.id, null, data);

      // Create notification for the new user
      await supabase
        .from('notifications')
        .insert({
          user_id: newUser.id,
          title: 'Welcome to JSC Payroll System',
          message: `Your account has been created with ${data.role.replace('_', ' ')} privileges. Please contact your administrator for login credentials.`,
          type: 'info',
        });
      
      return newUser;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      userForm.reset();
      setShowAddUserModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  // Create allowance mutation
  const createAllowanceMutation = useMutation({
    mutationFn: async (data: AllowanceFormData) => {
      const { data: newAllowance, error } = await supabase
        .from('allowances')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      
      // Log allowance creation
      await logSystemEvent('allowance_created', 'allowances', newAllowance.id, null, data);
      
      return newAllowance;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-allowances'] });
      allowanceForm.reset();
      setShowAddAllowanceModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create allowance',
        variant: 'destructive',
      });
    },
  });

  // Create deduction mutation
  const createDeductionMutation = useMutation({
    mutationFn: async (data: DeductionFormData) => {
      const { data: newDeduction, error } = await supabase
        .from('deductions')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      
      // Log deduction creation
      await logSystemEvent('deduction_created', 'deductions', newDeduction.id, null, data);
      
      return newDeduction;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Deduction created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-deductions'] });
      deductionForm.reset();
      setShowAddDeductionModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create deduction',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Prevent deletion of current user
      if (userId === user?.id) {
        throw new Error('You cannot delete your own account');
      }

      // Get user data before deletion for audit log
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // Check if user has associated staff record
      const { data: staffRecord } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (staffRecord) {
        throw new Error('Cannot delete user with associated staff record. Please remove staff association first.');
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      // Log user deletion
      if (userData) {
        await logSystemEvent('user_deleted', 'users', userId, userData, null);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  // Delete allowance mutation
  const deleteAllowanceMutation = useMutation({
    mutationFn: async (allowanceId: string) => {
      // Get allowance data before deletion for audit log
      const { data: allowanceData } = await supabase
        .from('allowances')
        .select('*')
        .eq('id', allowanceId)
        .single();

      const { error } = await supabase
        .from('allowances')
        .delete()
        .eq('id', allowanceId);

      if (error) throw error;
      
      // Log allowance deletion
      if (allowanceData) {
        await logSystemEvent('allowance_deleted', 'allowances', allowanceId, allowanceData, null);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allowance deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-allowances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete allowance',
        variant: 'destructive',
      });
    },
  });

  // Delete deduction mutation
  const deleteDeductionMutation = useMutation({
    mutationFn: async (deductionId: string) => {
      // Get deduction data before deletion for audit log
      const { data: deductionData } = await supabase
        .from('deductions')
        .select('*')
        .eq('id', deductionId)
        .single();

      const { error } = await supabase
        .from('deductions')
        .delete()
        .eq('id', deductionId);

      if (error) throw error;
      
      // Log deduction deletion
      if (deductionData) {
        await logSystemEvent('deduction_deleted', 'deductions', deductionId, deductionData, null);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Deduction deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-deductions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete deduction',
        variant: 'destructive',
      });
    },
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'account_admin':
        return 'bg-blue-100 text-blue-800';
      case 'payroll_admin':
        return 'bg-green-100 text-green-800';
      case 'staff':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">System Settings</h1>
        <p className="text-gray-600">Manage system configuration and user access</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="allowances">Allowances</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </CardTitle>
                <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
                  <DialogTrigger asChild>
                    <Button className="bg-nigeria-green hover:bg-green-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <Form {...userForm}>
                      <form onSubmit={userForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
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
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="payroll_admin">Payroll Admin</SelectItem>
                                  <SelectItem value="account_admin">Account Admin</SelectItem>
                                  <SelectItem value="super_admin">Super Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setShowAddUserModal(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              'Create User'
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
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
                          <Badge className={getRoleColor(user.role)}>
                            {formatRole(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowEditUserModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-600"
                                  disabled={user.id === user?.id} // Disable delete for current user
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this user? This action cannot be undone.
                                    {user.id === user?.id && (
                                      <div className="mt-2 text-red-600 font-medium">
                                        Note: You cannot delete your own account.
                                      </div>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUserMutation.mutate(user.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={user.id === user?.id}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* Allowances Tab */}
        <TabsContent value="allowances">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Allowance Rules</span>
                </CardTitle>
                <Dialog open={showAddAllowanceModal} onOpenChange={setShowAddAllowanceModal}>
                  <DialogTrigger asChild>
                    <Button className="bg-nigeria-green hover:bg-green-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Allowance
                    </Button>
                  </DialogTrigger>
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
                                <Input {...field} />
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
                          control={allowanceForm.control}
                          name="value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Value</FormLabel>
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

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setShowAddAllowanceModal(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createAllowanceMutation.isPending}>
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
              </div>
            </CardHeader>
            <CardContent>
              {allowancesLoading ? (
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
                      <TableHead>Name</TableHead>
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
                        <TableCell>
                          <Badge variant="outline">
                            {allowance.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {allowance.type === 'percentage' ? `${allowance.value}%` : `₦${Number(allowance.value).toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={allowance.is_active ? 'default' : 'secondary'}>
                            {allowance.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedAllowance(allowance);
                                setShowEditAllowanceModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Allowance</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this allowance? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAllowanceMutation.mutate(allowance.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* Deductions Tab */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Deduction Rules</span>
                </CardTitle>
                <Dialog open={showAddDeductionModal} onOpenChange={setShowAddDeductionModal}>
                  <DialogTrigger asChild>
                    <Button className="bg-nigeria-green hover:bg-green-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Deduction
                    </Button>
                  </DialogTrigger>
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
                                <Input {...field} />
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
                          control={deductionForm.control}
                          name="value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Value</FormLabel>
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

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setShowAddDeductionModal(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createDeductionMutation.isPending}>
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
              </div>
            </CardHeader>
            <CardContent>
              {deductionsLoading ? (
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
                      <TableHead>Name</TableHead>
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
                        <TableCell>
                          <Badge variant="outline">
                            {deduction.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deduction.type === 'percentage' ? `${deduction.value}%` : `₦${Number(deduction.value).toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={deduction.is_active ? 'default' : 'secondary'}>
                            {deduction.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedDeduction(deduction);
                                setShowEditDeductionModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Deduction</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this deduction? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteDeductionMutation.mutate(deduction.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* System Tab */}
        <TabsContent value="system">
          <div className="space-y-6">
            {/* Audit Logs Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Audit Logs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AuditLogsTable />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="h-5 w-5" />
                  <span>System Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Organization Name</Label>
                    <Input defaultValue="Judicial Service Committee" />
                  </div>
                  <div>
                    <Label>System Email</Label>
                    <Input defaultValue="system@jsc.gov.ng" />
                  </div>
                  <div>
                    <Label>Default Currency</Label>
                    <Select defaultValue="NGN">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NGN">Nigerian Naira (₦)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payroll Frequency</Label>
                    <Select defaultValue="monthly">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-600">Enforce 2FA for all admin users</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Session Timeout</Label>
                    <p className="text-sm text-gray-600">Auto-logout after inactivity</p>
                  </div>
                  <Select defaultValue="8">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="8">8 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Audit Logging</Label>
                    <p className="text-sm text-gray-600">Log all system activities</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Database Maintenance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Last Backup</Label>
                    <p className="text-sm text-gray-600">Database backup status</p>
                  </div>
                  <Badge variant="default">Today, 2:00 AM</Badge>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline">
                    <Database className="mr-2 h-4 w-4" />
                    Backup Now
                  </Button>
                  <Button variant="outline">
                    <Database className="mr-2 h-4 w-4" />
                    View Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit User Modal */}
      {selectedUser && (
        <EditUserModal
          open={showEditUserModal}
          onClose={() => {
            setShowEditUserModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onSuccess={() => {
            setShowEditUserModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Edit Allowance Modal */}
      {selectedAllowance && (
        <EditAllowanceModal
          open={showEditAllowanceModal}
          onClose={() => {
            setShowEditAllowanceModal(false);
            setSelectedAllowance(null);
          }}
          allowance={selectedAllowance}
          onSuccess={() => {
            setShowEditAllowanceModal(false);
            setSelectedAllowance(null);
          }}
        />
      )}

      {/* Edit Deduction Modal */}
      {selectedDeduction && (
        <EditDeductionModal
          open={showEditDeductionModal}
          onClose={() => {
            setShowEditDeductionModal(false);
            setSelectedDeduction(null);
          }}
          deduction={selectedDeduction}
          onSuccess={() => {
            setShowEditDeductionModal(false);
            setSelectedDeduction(null);
          }}
        />
      )}
    </div>
  );
}

// Audit Logs Component
function AuditLogsTable() {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          users (
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800';
    if (action.includes('updated')) return 'bg-blue-100 text-blue-800';
    if (action.includes('deleted')) return 'bg-red-100 text-red-800';
    if (action.includes('login')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-200 h-8 w-8"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Showing the last 50 audit log entries
      </div>
      
      {auditLogs && auditLogs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Resource ID</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">
                  {log.users?.email || 'System'}
                </TableCell>
                <TableCell>
                  <Badge className={getActionColor(log.action)}>
                    {formatAction(log.action)}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{log.resource}</TableCell>
                <TableCell className="font-mono text-xs">
                  {log.resource_id ? log.resource_id.slice(0, 8) + '...' : '-'}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p>No audit logs found</p>
        </div>
      )}
    </div>
  );
}
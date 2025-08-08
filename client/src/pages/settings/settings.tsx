import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logSystemEvent } from '@/lib/audit-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Switch } from '@/components/ui/switch';
import { EditAllowanceModal } from './edit-allowance-modal';
import { EditDeductionModal } from './edit-deduction-modal';
import { EditUserModal } from './edit-user-modal';
import { SalaryStructureSettings } from './salary-structure-settings';
import { LeaveTypesSettings } from './leave-types-settings';
import { AuditReport } from './audit-report';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  DollarSign,
  Minus,
  Scale,
  Shield,
  Calendar,
  Loader2
} from 'lucide-react';

// Schema definitions
const addAllowanceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
  isActive: z.boolean(),
});

const addDeductionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0, 'Value must be positive'),
  isActive: z.boolean(),
});

const addUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['super_admin', 'account_admin', 'payroll_admin', 'staff']),
});

type AddAllowanceFormData = z.infer<typeof addAllowanceSchema>;
type AddDeductionFormData = z.infer<typeof addDeductionSchema>;
type AddUserFormData = z.infer<typeof addUserSchema>;

export default function Settings() {
  const [showAddAllowanceModal, setShowAddAllowanceModal] = useState(false);
  const [showAddDeductionModal, setShowAddDeductionModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditAllowanceModal, setShowEditAllowanceModal] = useState(false);
  const [showEditDeductionModal, setShowEditDeductionModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedAllowance, setSelectedAllowance] = useState<any>(null);
  const [selectedDeduction, setSelectedDeduction] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form instances
  const allowanceForm = useForm<AddAllowanceFormData>({
    resolver: zodResolver(addAllowanceSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
      isActive: true,
    },
  });

  const deductionForm = useForm<AddDeductionFormData>({
    resolver: zodResolver(addDeductionSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
      isActive: true,
    },
  });

  const userForm = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: '',
      role: 'staff',
    },
  });

  // Fetch system allowances
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

  // Fetch system deductions
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

  // Fetch system users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('email');

      if (error) throw error;
      return data || [];
    },
  });

  // Create allowance mutation
  const createAllowanceMutation = useMutation({
    mutationFn: async (data: AddAllowanceFormData) => {
      const { data: allowance, error } = await supabase
        .from('allowances')
        .insert({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
          is_active: data.isActive,
        })
        .select()
        .single();

      if (error) throw error;
      
      await logSystemEvent('allowance_created', 'allowances', allowance.id, null, data);
      
      return allowance;
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
    mutationFn: async (data: AddDeductionFormData) => {
      const { data: deduction, error } = await supabase
        .from('deductions')
        .insert({
          name: data.name,
          type: data.type,
          value: data.value.toString(),
          is_active: data.isActive,
        })
        .select()
        .single();

      if (error) throw error;
      
      await logSystemEvent('deduction_created', 'deductions', deduction.id, null, data);
      
      return deduction;
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

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: AddUserFormData) => {
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email: data.email,
          role: data.role,
        })
        .select()
        .single();

      if (error) throw error;
      
      await logSystemEvent('user_created', 'users', user.id, null, data);
      
      return user;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
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

  // Delete allowance mutation
  const deleteAllowanceMutation = useMutation({
    mutationFn: async (allowanceId: string) => {
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

  const onSubmitAllowance = (data: AddAllowanceFormData) => {
    createAllowanceMutation.mutate(data);
  };

  const onSubmitDeduction = (data: AddDeductionFormData) => {
    createDeductionMutation.mutate(data);
  };

  const onSubmitUser = (data: AddUserFormData) => {
    createUserMutation.mutate(data);
  };

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
        <div className="w-full">
          <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">System Settings</h1>
          <p className="text-gray-600">Configure system-wide settings and manage payroll rules</p>
        </div>
      </div>

      <Tabs defaultValue="allowances" className="space-y-6">
        {/* === OPTIMIZATION START === */}
        {/* Replaced grid with a flex container that allows horizontal scrolling on small screens */}
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-fit sm:w-full sm:grid sm:grid-cols-6">
            <TabsTrigger value="allowances">Allowances</TabsTrigger>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="salary">Salary Structure</TabsTrigger>
            <TabsTrigger value="leave">Leave Types</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>
        </div>
        {/* === OPTIMIZATION END === */}

        {/* Allowances Tab */}
        <TabsContent value="allowances">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>System Allowances</span>
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
                      <form onSubmit={allowanceForm.handleSubmit(onSubmitAllowance)} className="space-y-4">
                        <FormField
                          control={allowanceForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Allowance Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Housing Allowance" />
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

                        <FormField
                          control={allowanceForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Active Status</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Enable or disable this allowance
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

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddAllowanceModal(false)}
                          >
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
              </div>
            </CardHeader>
            <CardContent>
              {allowancesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-8 w-32"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : allowances && allowances.length > 0 ? (
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
                    {allowances.map((allowance) => (
                      <TableRow key={allowance.id}>
                        <TableCell className="font-medium">{allowance.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {allowance.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {allowance.type === 'percentage' ? `${allowance.value}%` : `₦${parseFloat(allowance.value).toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={allowance.is_active ? 'default' : 'secondary'}>
                            {allowance.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit allowance</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete allowance</p>
                                </TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Allowance</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{allowance.name}"? This action cannot be undone.
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
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No allowances configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <CardTitle className="flex items-center space-x-2">
                  <Minus className="h-5 w-5" />
                  <span>System Deductions</span>
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
                      <form onSubmit={deductionForm.handleSubmit(onSubmitDeduction)} className="space-y-4">
                        <FormField
                          control={deductionForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deduction Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., PAYE Tax" />
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

                        <FormField
                          control={deductionForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Active Status</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Enable or disable this deduction
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

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddDeductionModal(false)}
                          >
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
              </div>
            </CardHeader>
            <CardContent>
              {deductionsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-8 w-32"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : deductions && deductions.length > 0 ? (
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
                    {deductions.map((deduction) => (
                      <TableRow key={deduction.id}>
                        <TableCell className="font-medium">{deduction.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {deduction.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deduction.type === 'percentage' ? `${deduction.value}%` : `₦${parseFloat(deduction.value).toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={deduction.is_active ? 'default' : 'secondary'}>
                            {deduction.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit deduction</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete deduction</p>
                                </TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Deduction</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{deduction.name}"? This action cannot be undone.
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
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Minus className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No deductions configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>System Users</span>
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
                      <form onSubmit={userForm.handleSubmit(onSubmitUser)} className="space-y-4">
                        <FormField
                          control={userForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} placeholder="user@jsc.gov.ng" />
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
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddUserModal(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createUserMutation.isPending}
                            className="bg-nigeria-green hover:bg-green-700"
                          >
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
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-8 w-48"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : users && users.length > 0 ? (
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
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(user.role)}>
                            {formatRole(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
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
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit user</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Structure Tab */}
        <TabsContent value="salary">
          <SalaryStructureSettings />
        </TabsContent>

        {/* Leave Types Tab */}
        <TabsContent value="leave">
          <LeaveTypesSettings />
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit">
          <AuditReport />
        </TabsContent>
      </Tabs>

      {/* Edit Modals */}
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
    </div>
  );
}

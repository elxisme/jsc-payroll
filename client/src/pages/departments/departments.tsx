import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '@/hooks/use-realtime';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { logDepartmentEvent } from '@/lib/audit-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Users, Building, Loader2, Trash2 } from 'lucide-react';
import { EditDepartmentModal } from './edit-department-modal';

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().min(2, 'Department code must be at least 2 characters'),
  description: z.string().optional(),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

export default function Departments() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates for departments
  useRealtime({
    enableNotifications: true,
    enableDepartmentUpdates: true,
  });
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  // Fetch departments with staff count
  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments-with-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          staff!staff_department_id_fkey (
            id
          )
        `)
        .order('name');

      // Debug logging to check what data is being returned
      console.log('Departments query result:', { data, error });
      console.log('Departments with staff count:', data?.map(dept => ({
        name: dept.name,
        staffCount: dept.staff?.length || 0,
        rawStaffData: dept.staff
      })));

      if (error) throw error;
      
      return (data || []).map(dept => ({
        ...dept,
        staffCount: dept.staff?.length || 0,
      }));
    },
  });

  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      const { data: department, error } = await supabase
        .from('departments')
        .insert({
          name: data.name,
          code: data.code.toUpperCase(),
          description: data.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Log the creation for audit trail
      await logDepartmentEvent('created', department.id, null, data);
      
      return department;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Department created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['departments-with-staff'] });
      form.reset();
      setShowAddModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create department',
        variant: 'destructive',
      });
    },
  });

  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      // Get department data before deletion for audit log
      const { data: departmentData } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      // Check if department has staff members
      const { data: staffInDept, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('department_id', departmentId)
        .limit(1);

      if (staffError) throw staffError;

      if (staffInDept && staffInDept.length > 0) {
        throw new Error('Cannot delete department with assigned staff members. Please reassign staff first.');
      }

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;
      
      // Log the deletion for audit trail
      if (departmentData) {
        await logDepartmentEvent('deleted', departmentId, departmentData, null);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Department deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['departments-with-staff'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete department',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DepartmentFormData) => {
    createDepartmentMutation.mutate(data);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Departments</h1>
            <p className="text-gray-600">Manage organizational departments and structure</p>
          </div>
          <div className="w-full sm:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto bg-nigeria-green hover:bg-green-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new department</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Department</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Legal Affairs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., LEG" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Department description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createDepartmentMutation.isPending}
                      className="bg-nigeria-green hover:bg-green-700"
                    >
                      {createDepartmentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Department'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Department Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Departments</p>
                <p className="text-3xl font-bold text-gray-900">
                  {isLoading ? '...' : departments?.length || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="text-blue-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900">
                  {isLoading ? '...' : departments?.reduce((sum, dept) => sum + dept.staffCount, 0) || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="text-nigeria-green" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Staff per Dept</p>
                <p className="text-3xl font-bold text-gray-900">
                  {isLoading ? '...' : departments?.length ? 
                    Math.round(departments.reduce((sum, dept) => sum + dept.staffCount, 0) / departments.length) : 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="text-purple-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : departments && departments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Staff Count</TableHead>
                  <TableHead>Head of Department</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="font-medium">{dept.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{dept.code}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {dept.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{dept.staffCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {dept.head_of_department ? 'Assigned' : 'Not assigned'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedDepartment(dept);
                                setShowEditModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit department details</p>
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
                              <p>Delete department</p>
                            </TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Department</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{dept.name}"? This action cannot be undone.
                                {dept.staffCount > 0 && (
                                  <div className="mt-2 text-red-600 font-medium">
                                    Warning: This department has {dept.staffCount} staff member(s). 
                                    Please reassign staff before deleting.
                                  </div>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteDepartmentMutation.mutate(dept.id)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={dept.staffCount > 0 || deleteDepartmentMutation.isPending}
                              >
                                {deleteDepartmentMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  'Delete Department'
                                )}
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
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="h-8 w-8 text-gray-400" />
              </div>
              <p>No departments found</p>
              <p className="text-sm">Create your first department to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Department Modal */}
      {selectedDepartment && (
        <EditDepartmentModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
          }}
          department={selectedDepartment}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
          }}
        />
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getActiveLeaveTypes, createLeaveType, updateLeaveType } from '@/lib/leave-management-utils';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Plus, Edit, Loader2 } from 'lucide-react';

const leaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Code must be at most 10 characters'),
  description: z.string().optional(),
  isPaid: z.boolean(),
  maxDaysPerYear: z.number().min(0, 'Must be 0 or greater').max(365, 'Cannot exceed 365 days'),
  accrualRate: z.number().min(0, 'Must be 0 or greater').max(30, 'Cannot exceed 30 days per month'),
  requiresApproval: z.boolean(),
  isActive: z.boolean(),
});

type LeaveTypeFormData = z.infer<typeof leaveTypeSchema>;

interface EditLeaveTypeModalProps {
  open: boolean;
  onClose: () => void;
  leaveType: any;
  onSuccess: () => void;
}

function EditLeaveTypeModal({ open, onClose, leaveType, onSuccess }: EditLeaveTypeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LeaveTypeFormData>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      name: leaveType?.name || '',
      code: leaveType?.code || '',
      description: leaveType?.description || '',
      isPaid: leaveType?.isPaid ?? true,
      maxDaysPerYear: leaveType?.maxDaysPerYear || 30,
      accrualRate: leaveType?.accrualRate || 2.5,
      requiresApproval: leaveType?.requiresApproval ?? true,
      isActive: leaveType?.isActive ?? true,
    },
  });

  React.useEffect(() => {
    if (leaveType) {
      form.reset({
        name: leaveType.name || '',
        code: leaveType.code || '',
        description: leaveType.description || '',
        isPaid: leaveType.isPaid ?? true,
        maxDaysPerYear: leaveType.maxDaysPerYear || 30,
        accrualRate: leaveType.accrualRate || 2.5,
        requiresApproval: leaveType.requiresApproval ?? true,
        isActive: leaveType.isActive ?? true,
      });
    }
  }, [leaveType, form]);

  const updateLeaveTypeMutation = useMutation({
    mutationFn: async (data: LeaveTypeFormData) => {
      if (!leaveType?.id) throw new Error("Leave type ID is missing");
      await updateLeaveType(leaveType.id, data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave type updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update leave type',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LeaveTypeFormData) => {
    updateLeaveTypeMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Leave Type</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Annual Leave" />
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
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., ANNUAL" />
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
                      <Textarea {...field} placeholder="Description of this leave type" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxDaysPerYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Days/Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accrualRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accrual Rate/Month</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Paid Leave</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Whether this leave type is paid
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

              <FormField
                control={form.control}
                name="requiresApproval"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Requires Approval</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Whether this leave type needs approval
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

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Whether this leave type is available for use
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

              <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateLeaveTypeMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {updateLeaveTypeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Leave Type'
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

export function LeaveTypesSettings() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LeaveTypeFormData>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      isPaid: true,
      maxDaysPerYear: 30,
      accrualRate: 2.5,
      requiresApproval: true,
      isActive: true,
    },
  });

  const { data: leaveTypes, isLoading } = useQuery({
    queryKey: ['leave-types'],
    queryFn: getActiveLeaveTypes,
  });

  const createLeaveTypeMutation = useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave type created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      setShowAddModal(false); // Close modal on success
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create leave type',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LeaveTypeFormData) => {
    createLeaveTypeMutation.mutate(data);
  };

  // **FIXED**: Define handleClose for the "Add" dialog
  const handleCloseAddModal = () => {
    form.reset();
    setShowAddModal(false);
  };

  const handleOpenAddModal = () => {
    form.reset();
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Leave Types Configuration</span>
            </CardTitle>
            <div className="w-full sm:w-auto">
              <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleOpenAddModal} className="w-full sm:w-auto bg-nigeria-green hover:bg-green-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Leave Type
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a new leave type</p>
                    </TooltipContent>
                  </Tooltip>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Add New Leave Type</DialogTitle>
                  </DialogHeader>
                  
                  <div className="flex-1 overflow-y-auto px-1">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leave Type Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Annual Leave" />
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
                              <FormLabel>Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., ANNUAL" />
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
                                <Textarea {...field} placeholder="Description of this leave type" rows={3} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="maxDaysPerYear"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Days/Year</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="accrualRate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Accrual Rate/Month</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="isPaid"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Paid Leave</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Whether this leave type is paid
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

                        <FormField
                          control={form.control}
                          name="requiresApproval"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Requires Approval</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Whether this leave type needs approval
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

                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Active</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Whether this leave type is available for use
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

                        <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
                          <Button type="button" variant="outline" onClick={handleCloseAddModal}>
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createLeaveTypeMutation.isPending}
                            className="bg-nigeria-green hover:bg-green-700"
                          >
                            {createLeaveTypeMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              'Create Leave Type'
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="rounded bg-gray-200 h-8 w-16"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : leaveTypes && leaveTypes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Max Days/Year</TableHead>
                  <TableHead>Accrual Rate</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveTypes.map((leaveType) => (
                  <TableRow key={leaveType.id}>
                    <TableCell className="font-medium">{leaveType.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{leaveType.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={leaveType.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {leaveType.isPaid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </TableCell>
                    <TableCell>{leaveType.maxDaysPerYear} days</TableCell>
                    <TableCell>{leaveType.accrualRate} days/month</TableCell>
                    <TableCell>
                      <Badge variant={leaveType.requiresApproval ? 'default' : 'secondary'}>
                        {leaveType.requiresApproval ? 'Required' : 'Auto'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={leaveType.isActive ? 'default' : 'secondary'}>
                        {leaveType.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLeaveType(leaveType);
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit leave type</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No leave types configured</p>
              <p className="text-sm">Create your first leave type to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLeaveType && (
        <EditLeaveTypeModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedLeaveType(null);
          }}
          leaveType={selectedLeaveType}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedLeaveType(null);
          }}
        />
      )}
    </div>
  );
}

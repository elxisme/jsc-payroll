import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  getCooperativeOrganizations, 
  createCooperativeOrganization, 
  updateCooperativeOrganization, 
  deleteCooperativeOrganization 
} from '@/lib/individual-payroll-utils';
import { logCooperativeEvent } from '@/lib/audit-logger';
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
import { Switch } from '@/components/ui/switch';
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
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, Edit, Trash2, Loader2, Phone, Mail, MapPin } from 'lucide-react';

const cooperativeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactPerson: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  interestRateDefault: z.number().min(0).max(100).optional(),
  isActive: z.boolean(),
});

type CooperativeFormData = z.infer<typeof cooperativeSchema>;

interface CooperativeManagementModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CooperativeManagementModal({ open, onClose, onSuccess }: CooperativeManagementModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCooperative, setEditingCooperative] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CooperativeFormData>({
    resolver: zodResolver(cooperativeSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phoneNumber: '',
      email: '',
      address: '',
      interestRateDefault: 0,
      isActive: true,
    },
  });

  // Fetch cooperatives
  const { data: cooperatives, isLoading } = useQuery({
    queryKey: ['cooperative-organizations'],
    queryFn: getCooperativeOrganizations,
    enabled: open,
  });

  // Log cooperatives data for debugging
  React.useEffect(() => {
    if (cooperatives) {
      console.log('Fetched cooperatives data:', cooperatives);
    }
  }, [cooperatives]);

  // Create cooperative mutation
  const createCooperativeMutation = useMutation({
    mutationFn: async (data: CooperativeFormData) => {
      const cooperative = await createCooperativeOrganization({
        name: data.name,
        contactPerson: data.contactPerson || undefined,
        phoneNumber: data.phoneNumber || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        interestRateDefault: data.interestRateDefault || undefined,
        isActive: data.isActive,
      });

      await logCooperativeEvent('created', cooperative.id, null, data);
      return cooperative;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Cooperative organization created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['cooperative-organizations'] });
      form.reset();
      setShowAddForm(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create cooperative organization',
        variant: 'destructive',
      });
    },
  });

  // Update cooperative mutation
  const updateCooperativeMutation = useMutation({
    mutationFn: async (data: CooperativeFormData) => {
      if (!editingCooperative) throw new Error('No cooperative selected');

      const oldValues = { ...editingCooperative };
      await updateCooperativeOrganization(editingCooperative.id, {
        name: data.name,
        contactPerson: data.contactPerson || undefined,
        phoneNumber: data.phoneNumber || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        interestRateDefault: data.interestRateDefault || undefined,
        isActive: data.isActive,
      });

      await logCooperativeEvent('updated', editingCooperative.id, oldValues, data);
      // Return the updated data to onSuccess for optimistic update
      return { id: editingCooperative.id, ...data };
    },
    onSuccess: (updatedData) => {
      toast({
        title: 'Success',
        description: 'Cooperative organization updated successfully',
      });
      
      // Optimistically update the cache
      queryClient.setQueryData(['cooperative-organizations'], (oldData: any) => {
        if (!oldData) return [];
        return oldData.map((coop: any) => 
          coop.id === updatedData.id ? { ...coop, ...updatedData } : coop
        );
      });

      // Invalidate to ensure eventual consistency with the server
      queryClient.invalidateQueries({ queryKey: ['cooperative-organizations'] });
      
      form.reset();
      setShowAddForm(false);
      setEditingCooperative(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update cooperative organization',
        variant: 'destructive',
      });
    },
  });

  // Delete cooperative mutation
  const deleteCooperativeMutation = useMutation({
    mutationFn: async (cooperativeId: string) => {
      const cooperative = cooperatives?.find(c => c.id === cooperativeId);
      await deleteCooperativeOrganization(cooperativeId);
      
      if (cooperative) {
        await logCooperativeEvent('deleted', cooperativeId, cooperative, null);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Cooperative organization deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['cooperative-organizations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete cooperative organization',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CooperativeFormData) => {
    if (editingCooperative) {
      updateCooperativeMutation.mutate(data);
    } else {
      createCooperativeMutation.mutate(data);
    }
  };

  const handleEdit = (cooperative: any) => {
    setEditingCooperative(cooperative);
    form.reset({
      name: cooperative.name,
      contactPerson: cooperative.contactPerson || '',
      phoneNumber: cooperative.phoneNumber || '',
      email: cooperative.email || '',
      address: cooperative.address || '',
      interestRateDefault: cooperative.interestRateDefault || 0,
      isActive: cooperative.isActive,
    });
    setShowAddForm(true);
  };

  const handleClose = () => {
    form.reset();
    setShowAddForm(false);
    setEditingCooperative(null);
    onClose();
  };

  const handleCancelForm = () => {
    form.reset();
    setShowAddForm(false);
    setEditingCooperative(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Manage Cooperative Organizations</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showAddForm ? (
            <>
              {/* Header with Add Button */}
              <div className="flex justify-between items-center">
                <p className="text-gray-600">Manage cooperative organizations that provide loans to staff</p>
                <Button
                  onClick={() => setShowAddForm(true)}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cooperative
                </Button>
              </div>

              {/* Cooperatives Table */}
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-4">
                      <div className="rounded bg-gray-200 h-16 w-full"></div>
                    </div>
                  ))}
                </div>
              ) : cooperatives && cooperatives.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Default Interest Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cooperatives.map((cooperative) => {
                      // Log individual cooperative data for debugging
                      console.log(`Cooperative: ${cooperative.name}, ID: ${cooperative.id}, isActive: ${cooperative.isActive}, Type: ${typeof cooperative.isActive}`);
                      return (
                        <TableRow key={cooperative.id}>
                          <TableCell>
                            <div className="font-medium">{cooperative.name}</div>
                          </TableCell>
                          <TableCell>
                            {cooperative.contactPerson || 'Not specified'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              {cooperative.phoneNumber && (
                                <div className="flex items-center space-x-1">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  <span>{cooperative.phoneNumber}</span>
                                </div>
                              )}
                              {cooperative.email && (
                                <div className="flex items-center space-x-1">
                                  <Mail className="h-3 w-3 text-gray-400" />
                                  <span>{cooperative.email}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {cooperative.interestRateDefault ? `${cooperative.interestRateDefault}%` : 'Not set'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={cooperative.isActive ? 'default' : 'secondary'}>
                              {cooperative.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(cooperative)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit cooperative</p>
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
                                    <p>Delete cooperative</p>
                                  </TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Cooperative</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{cooperative.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteCooperativeMutation.mutate(cooperative.id)}
                                      disabled={deleteCooperativeMutation.isPending}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {deleteCooperativeMutation.isPending ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        'Delete'
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Building className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No cooperative organizations found</p>
                  <p className="text-sm">Add your first cooperative to get started</p>
                </div>
              )}
            </>
          ) : (
            /* Add/Edit Form */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">
                    {editingCooperative ? 'Edit Cooperative' : 'Add New Cooperative'}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelForm}
                  >
                    Back to List
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., JSC Staff Cooperative Society" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Mrs. Adunni Olatunji" />
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
                          <Input {...field} placeholder="e.g., 08012345678" />
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
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., info@cooperative.org" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Physical address of the cooperative" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interestRateDefault"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Interest Rate (%) (Optional)</FormLabel>
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
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Whether this cooperative is available for new loans
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

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCancelForm}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCooperativeMutation.isPending || updateCooperativeMutation.isPending}
                    className="bg-nigeria-green hover:bg-green-700"
                  >
                    {(createCooperativeMutation.isPending || updateCooperativeMutation.isPending) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingCooperative ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingCooperative ? 'Update Cooperative' : 'Create Cooperative'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getActiveLeaveTypes,
  getStaffLeaveRequests,
  getStaffLeaveBalances,
  submitLeaveRequest,
  calculateWorkingDays,
  checkLeaveBalance,
  cancelLeaveRequest
} from '@/lib/leave-management-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Plus,
  Clock,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  FileText,
  Loader2
} from 'lucide-react';

const leaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

function LeaveManagement() {
  const { user } = useAuth();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveTypeId: '',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  // Fetch leave types
  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: getActiveLeaveTypes,
  });

  // Fetch staff leave requests
  const { data: leaveRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['staff-leave-requests', user?.staff_profile?.id],
    queryFn: () => getStaffLeaveRequests(user?.staff_profile?.id || ''),
    enabled: !!user?.staff_profile?.id,
  });

  // Fetch leave balances
  const { data: leaveBalances, isLoading: balancesLoading } = useQuery({
    queryKey: ['staff-leave-balances', user?.staff_profile?.id, selectedYear],
    queryFn: () => getStaffLeaveBalances(user?.staff_profile?.id || '', selectedYear),
    enabled: !!user?.staff_profile?.id,
  });

  // Submit leave request mutation
  const submitRequestMutation = useMutation({
    mutationFn: async (data: LeaveRequestFormData) => {
      if (!user?.staff_profile?.id) throw new Error('Staff profile not found');

      try {
        // Calculate working days
        const workingDays = calculateWorkingDays(data.startDate, data.endDate);
        
        // Check leave balance
        const balanceCheck = await checkLeaveBalance(
          user.staff_profile.id,
          data.leaveTypeId,
          workingDays,
          new Date(data.startDate).getFullYear()
        );

        if (!balanceCheck.hasBalance) {
          throw new Error(balanceCheck.message || 'Insufficient leave balance');
        }

        // If balance check is successful, submit the request
        await submitLeaveRequest({
          staffId: user.staff_profile.id,
          leaveTypeId: data.leaveTypeId,
          startDate: data.startDate,
          endDate: data.endDate,
          totalDays: workingDays,
          reason: data.reason,
        });
      } catch (error: any) {
        // **FIX**: Catch the specific PGRST116 error for uninitialized balances
        if (error?.code === 'PGRST116') {
          // Throw a user-friendly error instead of trying to initialize the balance
          throw new Error('Your leave balance is not set up. Please contact an administrator.');
        }
        // Re-throw any other errors to be handled by onError
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave request submitted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
      form.reset();
      setShowRequestModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit leave request',
        variant: 'destructive',
      });
    },
  });

  // Cancel leave request mutation
  const cancelRequestMutation = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave request cancelled successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['staff-leave-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel leave request',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LeaveRequestFormData) => {
    submitRequestMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return start === end ? start : `${start} - ${end}`;
  };

  const calculateBalancePercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((used / total) * 100, 100);
  };

  // Calculate working days for form preview
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  const previewDays = startDate && endDate ? calculateWorkingDays(startDate, endDate) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-gray-600">Manage your leave requests and view balances</p>
        </div>
        <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
          <DialogTrigger asChild>
            <Button className="bg-nigeria-green hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="leaveTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leave Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select leave type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {leaveTypes?.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <div className="flex items-center space-x-2">
                                  <span>{type.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {type.isPaid ? 'Paid' : 'Unpaid'}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {previewDays > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Working Days:</strong> {previewDays} days
                          

                        <span className="text-xs">
                          (Excludes weekends)
                        </span>
                      </p>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Leave</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Please provide a detailed reason for your leave request..."
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">Important Notes:</h4>
                    <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                      <li>Submit requests at least 2 weeks in advance when possible</li>
                      <li>Emergency leave may be submitted with shorter notice</li>
                      <li>Check your leave balance before submitting</li>
                      <li>You will receive a notification once your request is reviewed</li>
                    </ul>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
                    <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitRequestMutation.isPending}
                      className="bg-nigeria-green hover:bg-green-700"
                    >
                      {submitRequestMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="balances" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balances">Leave Balances</TabsTrigger>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
        </TabsList>

        {/* Leave Balances Tab */}
        <TabsContent value="balances">
          <div className="space-y-6">
            {/* Year Selection */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Year:</label>
                  <Select 
                    value={selectedYear.toString()} 
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(3)].map((_, i) => {
                        const year = new Date().getFullYear() - 1 + i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Leave Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {balancesLoading ? (
                [...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : leaveBalances && leaveBalances.length > 0 ? (
                leaveBalances.map((balance) => (
                  <Card key={balance.id}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">
                            {balance.leaveType?.name}
                          </h3>
                          <Badge className={balance.leaveType?.isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {balance.leaveType?.isPaid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Used: {balance.usedDays} days</span>
                            <span>Total: {balance.accruedDays + balance.carriedForward} days</span>
                          </div>
                          <Progress 
                            value={calculateBalancePercentage(balance.usedDays, balance.accruedDays + balance.carriedForward)} 
                            className="h-2"
                          />
                          <div className="text-center">
                            <p className="text-lg font-bold text-nigeria-green">
                              {balance.remainingDays} days remaining
                            </p>
                          </div>
                        </div>

                        {balance.carriedForward > 0 && (
                          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            Carried forward: {balance.carriedForward} days
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No leave balances found for {selectedYear}</p>
                  <p className="text-sm">Leave balances will be initialized automatically</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Leave Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
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
              ) : leaveRequests && leaveRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{request.leave_types?.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {request.leave_types?.code}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateRange(request.start_date, request.end_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{request.total_days}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(request.created_at)}
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => cancelRequestMutation.mutate(request.id)}
                                  disabled={cancelRequestMutation.isPending}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Cancel request</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {request.approval_comments && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{request.approval_comments}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <p>No leave requests found</p>
                  <p className="text-sm">Your leave requests will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LeaveManagement; // FIX: Added default export

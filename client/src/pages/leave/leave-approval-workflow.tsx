import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useRealtime } from '@/hooks/use-realtime';
import { getPendingLeaveRequests, updateLeaveRequestStatus } from '@/lib/leave-management-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  Check, 
  X, 
  Eye,
  User,
  Building,
  FileText,
  AlertCircle
} from 'lucide-react';

export default function LeaveApprovalWorkflow() {
  const { user, hasRole } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates for leave requests
  useRealtime({
    enableNotifications: true,
  });

  // Fetch pending leave requests
  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ['pending-leave-requests'],
    queryFn: getPendingLeaveRequests,
    enabled: !!user && hasRole(['super_admin', 'account_admin', 'payroll_admin']),
  });

  // Approve/reject leave request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, comments }: { 
      requestId: string; 
      status: 'approved' | 'rejected'; 
      comments?: string 
    }) => {
      await updateLeaveRequestStatus(requestId, status, comments);
    },
    onSuccess: (_, { status }) => {
      toast({
        title: 'Success',
        description: `Leave request ${status} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['pending-leave-requests'] });
      setShowApprovalModal(false);
      setApprovalComments('');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update leave request',
        variant: 'destructive',
      });
    },
  });

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

  const getLeaveTypeColor = (isPaid: boolean) => {
    return isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
  };

  const handleApprovalAction = (request: any, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const handleSubmitApproval = () => {
    if (!selectedRequest) return;

    updateRequestMutation.mutate({
      requestId: selectedRequest.id,
      status: approvalAction,
      comments: approvalComments || undefined,
    });
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="w-full">
          <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Leave Approval Workflow</h1>
          <p className="text-gray-600">Review and approve staff leave requests</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-3xl font-bold text-gray-900">
                  {pendingRequests?.length || 0}
                </p>
                <p className="text-sm text-gray-500">Requests awaiting review</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Days Requested</p>
              <p className="text-xl font-bold text-orange-600">
                {pendingRequests?.reduce((sum, req) => sum + req.total_days, 0) || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Pending Leave Requests</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
          ) : pendingRequests && pendingRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {request.staff?.first_name} {request.staff?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.staff?.staff_id} • {request.staff?.departments?.name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getLeaveTypeColor(request.leave_types?.is_paid)}>
                        {request.leave_types?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDateRange(request.start_date, request.end_date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{request.total_days}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprovalAction(request, 'approve')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Approve leave request</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprovalAction(request, 'reject')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reject leave request</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <p>No pending leave requests</p>
              <p className="text-sm">Leave requests requiring approval will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-gray-600">Staff Member</Label>
                  <p className="font-medium">
                    {selectedRequest.staff?.first_name} {selectedRequest.staff?.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{selectedRequest.staff?.staff_id}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Leave Type</Label>
                  <p className="font-medium">{selectedRequest.leave_types?.name}</p>
                  <Badge className={getLeaveTypeColor(selectedRequest.leave_types?.is_paid)} size="sm">
                    {selectedRequest.leave_types?.is_paid ? 'Paid' : 'Unpaid'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-gray-600">Dates</Label>
                  <p className="font-medium">
                    {formatDateRange(selectedRequest.start_date, selectedRequest.end_date)}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">Total Days</Label>
                  <p className="font-medium">{selectedRequest.total_days} working days</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-gray-600">Reason</Label>
                  <p className="font-medium">{selectedRequest.reason}</p>
                </div>
              </div>

              {/* Approval Comments */}
              <div>
                <Label htmlFor="comments">
                  Comments {approvalAction === 'reject' ? '(Required for rejection)' : '(Optional)'}
                </Label>
                <Textarea
                  id="comments"
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    approvalAction === 'approve' 
                      ? "Add any comments about this approval..."
                      : "Please provide a reason for rejection..."
                  }
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Warning for unpaid leave */}
              {!selectedRequest.leave_types?.is_paid && (
                <div className="flex items-start space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-800">Unpaid Leave Notice</p>
                    <p className="text-orange-700">
                      This is unpaid leave. The staff member's salary will be adjusted during payroll processing.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowApprovalModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitApproval}
                  disabled={updateRequestMutation.isPending || (approvalAction === 'reject' && !approvalComments.trim())}
                  className={approvalAction === 'approve' ? 'bg-nigeria-green hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {updateRequestMutation.isPending ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {approvalAction === 'approve' ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      {approvalAction === 'approve' ? 'Approve Request' : 'Reject Request'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
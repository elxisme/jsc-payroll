import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useRealtime } from '@/hooks/use-realtime';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logPayrollEvent } from '@/lib/audit-logger';
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
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Eye, 
  Check, 
  X,
  FileText,
  Calendar,
  Users
} from 'lucide-react';

export default function PayrollWorkflow() {
  const { user, hasRole } = useAuth();
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates for payroll workflow
  useRealtime({
    enableNotifications: true,
    enablePayrollUpdates: true,
  });
  // Fetch payroll runs based on user role
  const { data: payrollRuns, isLoading } = useQuery({
    queryKey: ['payroll-workflow'],
    queryFn: async () => {
      let query = supabase
        .from('payroll_runs')
        .select(`
          *,
          departments (
            name,
            code
          ),
          created_by_user:users!payroll_runs_created_by_fkey (
            email
          ),
          approved_by_user:users!payroll_runs_approved_by_fkey (
            email
          )
        `)
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (hasRole(['account_admin'])) {
        query = query.in('status', ['pending_review', 'approved', 'processed']);
      } else if (hasRole(['payroll_admin'])) {
        query = query.in('status', ['draft', 'pending_review', 'approved', 'processed']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Approve payroll run mutation
  const approvePayrollMutation = useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: 'approve' | 'reject' }) => {
      console.log('approvePayrollMutation started:', { runId, action, isPending: true });
      const oldValues = {
        status: selectedRun?.status,
        approved_by: selectedRun?.approved_by,
      };

      const updates: any = {
        approved_by: user?.id,
      };

      if (action === 'approve') {
        updates.status = 'approved';
      } else {
        updates.status = 'draft';
      }

      const { error } = await supabase
        .from('payroll_runs')
        .update(updates)
        .eq('id', runId);

      if (error) throw error;

      // Log the approval/rejection for audit trail
      await logPayrollEvent(action === 'approve' ? 'approved' : 'rejected', runId, oldValues, updates);

      // Create notification for the creator
      if (selectedRun?.created_by) {
        await supabase
          .from('notifications')
          .insert({
            user_id: selectedRun.created_by,
            title: `Payroll ${action === 'approve' ? 'Approved' : 'Rejected'}`,
            message: `Your payroll run for ${selectedRun.period} has been ${action}d. ${approvalComments ? `Comments: ${approvalComments}` : ''}`,
            type: action === 'approve' ? 'success' : 'warning',
          });
      }
    },
    onSuccess: (_, { action }) => {
      console.log('approvePayrollMutation success:', { action });
      toast({
        title: 'Success',
        description: `Payroll run ${action}d successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowApprovalModal(false);
      setApprovalComments('');
      setSelectedRun(null);
    },
    onError: (error: any) => {
      console.log('approvePayrollMutation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payroll run',
        variant: 'destructive',
      });
    },
  });

  // Finalize payroll run mutation (Super Admin only)
  const finalizePayrollMutation = useMutation({
    mutationFn: async (runId: string) => {
      console.log('finalizePayrollMutation started:', { runId, isPending: true });
      const oldValues = {
        status: selectedRun?.status,
        processed_at: selectedRun?.processed_at,
      };

      const newValues = {
        status: 'processed',
        processed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('payroll_runs')
        .update(newValues)
        .eq('id', runId);

      if (error) throw error;

      // Log the finalization for audit trail
      await logPayrollEvent('processed', runId, oldValues, newValues);

      // Create notification for all admins
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'account_admin', 'payroll_admin']);

      if (adminUsers?.length) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          title: 'Payroll Processed',
          message: `Payroll for ${selectedRun?.period} has been finalized and processed.`,
          type: 'success',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    },
    onSuccess: () => {
      console.log('finalizePayrollMutation success');
      toast({
        title: 'Success',
        description: 'Payroll run finalized successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedRun(null);
    },
    onError: (error: any) => {
      console.log('finalizePayrollMutation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to finalize payroll run',
        variant: 'destructive',
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'pending_review':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'pending_review':
        return 'bg-orange-100 text-orange-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: string | number) => {
    return formatDisplayCurrency(amount);
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const canApprove = (run: any) => {
    console.log('canApprove check:', { 
      userRole: user?.role, 
      runStatus: run.status, 
      hasRole: hasRole(['account_admin', 'super_admin']),
      result: hasRole(['account_admin', 'super_admin']) && run.status === 'pending_review'
    });
    return hasRole(['account_admin', 'super_admin']) && run.status === 'pending_review';
  };

  const canFinalize = (run: any) => {
    console.log('canFinalize check:', { 
      userRole: user?.role, 
      runStatus: run.status, 
      hasRole: hasRole(['super_admin']),
      result: hasRole(['super_admin']) && run.status === 'approved'
    });
    return hasRole(['super_admin']) && run.status === 'approved';
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payroll Workflow</h1>
        <p className="text-gray-600">Review and approve payroll runs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
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
          ) : payrollRuns && payrollRuns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Staff Count</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{formatPeriod(run.period)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {run.departments?.name || 'All Departments'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{run.total_staff || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(run.net_amount || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(run.status)}
                        <Badge className={getStatusColor(run.status)}>
                          {run.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {run.created_by_user?.email || 'System'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRun(run)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View payroll run details</p>
                          </TooltipContent>
                        </Tooltip>
                        {canApprove(run) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  setShowApprovalModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Review and approve payroll</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canFinalize(run) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  finalizePayrollMutation.mutate(run.id);
                                }}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Finalize and process payroll</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No payroll runs found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Payroll Run</DialogTitle>
          </DialogHeader>
          
          {selectedRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-gray-600">Period</Label>
                  <p className="font-medium">{formatPeriod(selectedRun.period)}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Department</Label>
                  <p className="font-medium">{selectedRun.departments?.name || 'All Departments'}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Total Staff</Label>
                  <p className="font-medium">{selectedRun.total_staff || 0}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Net Amount</Label>
                  <p className="font-medium">{formatCurrency(selectedRun.net_amount || 0)}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="comments">Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="Add any comments about this payroll run..."
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowApprovalModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => approvePayrollMutation.mutate({ runId: selectedRun.id, action: 'reject' })}
                  disabled={approvePayrollMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => approvePayrollMutation.mutate({ runId: selectedRun.id, action: 'approve' })}
                  disabled={approvePayrollMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useRealtime } from '@/hooks/use-realtime';
import { supabase } from '@/lib/supabase';
import { formatDisplayCurrency } from '@/lib/currency-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logPayrollEvent } from '@/lib/audit-logger';
import { isPayrollLockedFrontend, processPayrollRun, generatePayslipsForPayrollRun } from '@/lib/payroll-calculator';
import { PayrollDetailsModal } from '@/components/payroll-details-modal';
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
  Users,
  Unlock,
  Play,
  Send,
  RefreshCw
} from 'lucide-react';

export default function PayrollWorkflow() {
  const { user, hasRole } = useAuth();
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRunDetailsModal, setShowRunDetailsModal] = useState(false);
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

  // Reopen payroll run mutation (Super Admin only)
  const reopenPayrollMutation = useMutation({
    mutationFn: async (runId: string) => {
      console.log('reopenPayrollMutation started:', { runId, isPending: true });
      const oldValues = {
        status: selectedRun?.status,
        processed_at: selectedRun?.processed_at,
      };

      const newValues = {
        status: 'draft',
        processed_at: null,
      };

      const { error } = await supabase
        .from('payroll_runs')
        .update(newValues)
        .eq('id', runId);

      if (error) throw error;

      // Log the reopening for audit trail
      await logPayrollEvent('reopened', runId, oldValues, newValues);

      // Create notification for all admins
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'account_admin', 'payroll_admin']);

      if (adminUsers?.length) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          title: 'Payroll Reopened',
          message: `Payroll for ${selectedRun?.period} has been reopened by a Super Admin and is now available for modifications.`,
          type: 'warning',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    },
    onSuccess: () => {
      console.log('reopenPayrollMutation success');
      toast({
        title: 'Success',
        description: 'Payroll run reopened successfully. You can now make modifications.',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedRun(null);
    },
    onError: (error: any) => {
      console.log('reopenPayrollMutation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reopen payroll run',
        variant: 'destructive',
      });
    },
  });

  // Send for review mutation (Payroll Admin)
  const sendForReviewMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('payroll_runs')
        .update({
          status: 'pending_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (error) throw error;

      // Log the action for audit trail
      await logPayrollEvent('submitted_for_review', runId, { status: 'draft' }, { status: 'pending_review' });

      // Create notification for account admins
      const { data: accountAdmins } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'account_admin']);

      if (accountAdmins?.length) {
        const notifications = accountAdmins.map(admin => ({
          user_id: admin.id,
          title: 'Payroll Ready for Review',
          message: `Payroll for ${selectedRun?.period} has been submitted for review and approval.`,
          type: 'info',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payroll sent for review successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
      setSelectedRun(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send payroll for review',
        variant: 'destructive',
      });
    },
  });

  // Rerun payroll mutation (Payroll Admin)
  const rerunPayrollMutation = useMutation({
    mutationFn: async (runId: string) => {
      // Fetch staff for this payroll run
      const { data: payrollRun, error: payrollError } = await supabase
        .from('payroll_runs')
        .select('period, department_id')
        .eq('id', runId)
        .single();

      if (payrollError) throw payrollError;

      // Fetch staff based on department filter
      let staffQuery = supabase
        .from('staff')
        .select('id, grade_level, step, position')
        .eq('status', 'active');

      if (payrollRun.department_id) {
        staffQuery = staffQuery.eq('department_id', payrollRun.department_id);
      }

      const { data: staff, error: staffError } = await staffQuery;
      if (staffError) throw staffError;

      if (!staff || staff.length === 0) {
        throw new Error('No staff found for this payroll run');
      }

      // Prepare payroll inputs
      const payrollInputs = staff.map(staffMember => ({
        staffId: staffMember.id,
        gradeLevel: staffMember.grade_level,
        step: staffMember.step,
        position: staffMember.position,
        arrears: 0,
        overtime: 0,
        bonus: 0,
        loans: 0,
        cooperatives: 0,
      }));

      // Process payroll (calculate only, no payslips)
      await processPayrollRun(runId, payrollRun.period, payrollInputs);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payroll recalculated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
      setSelectedRun(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to rerun payroll',
        variant: 'destructive',
      });
    },
  });

  // Generate payslips mutation (Super Admin)
  const generatePayslipsMutation = useMutation({
    mutationFn: async (runId: string) => {
      // Fetch staff for this payroll run
      const { data: payrollRun, error: payrollError } = await supabase
        .from('payroll_runs')
        .select('period, department_id')
        .eq('id', runId)
        .single();

      if (payrollError) throw payrollError;

      // Fetch staff based on department filter
      let staffQuery = supabase
        .from('staff')
        .select('id, grade_level, step, position')
        .eq('status', 'active');

      if (payrollRun.department_id) {
        staffQuery = staffQuery.eq('department_id', payrollRun.department_id);
      }

      const { data: staff, error: staffError } = await staffQuery;
      if (staffError) throw staffError;

      if (!staff || staff.length === 0) {
        throw new Error('No staff found for this payroll run');
      }

      // Prepare payroll inputs
      const payrollInputs = staff.map(staffMember => ({
        staffId: staffMember.id,
        gradeLevel: staffMember.grade_level,
        step: staffMember.step,
        position: staffMember.position,
        arrears: 0,
        overtime: 0,
        bonus: 0,
        loans: 0,
        cooperatives: 0,
      }));

      // Generate payslips
      await generatePayslipsForPayrollRun(runId, payrollRun.period, payrollInputs);

      // Create notification for all admins
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'account_admin', 'payroll_admin']);

      if (adminUsers?.length) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          title: 'Payslips Generated',
          message: `Payslips for ${payrollRun.period} have been generated and are now available for download.`,
          type: 'success',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payslips generated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-workflow'] });
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      setSelectedRun(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate payslips',
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

  const canSendForReview = (run: any) => {
    return hasRole(['payroll_admin', 'super_admin']) && run.status === 'draft';
  };

  const canRerun = (run: any) => {
    return hasRole(['payroll_admin', 'super_admin']) && run.status === 'draft';
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

  const canReopen = (run: any) => {
    console.log('canReopen check:', { 
      userRole: user?.role, 
      runStatus: run.status, 
      hasRole: hasRole(['super_admin']),
      result: hasRole(['super_admin']) && run.status === 'processed'
    });
    return hasRole(['super_admin']) && run.status === 'processed';
  };

  const canGeneratePayslips = (run: any) => {
    return hasRole(['super_admin']) && run.status === 'processed';
  };

  // Check if payroll is locked (async function)
  const [lockedPayrolls, setLockedPayrolls] = React.useState<Record<string, boolean>>({});

  // Load lock status for visible payroll runs
  React.useEffect(() => {
    if (payrollRuns?.length) {
      const checkLockStatus = async () => {
        const lockStatuses: Record<string, boolean> = {};
        for (const run of payrollRuns) {
          lockStatuses[run.id] = await isPayrollLockedFrontend(run.id);
        }
        setLockedPayrolls(lockStatuses);
      };
      checkLockStatus();
    }
  }, [payrollRuns]);

  const isPayrollLocked = (run: any) => {
    return lockedPayrolls[run.id] || false;
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="w-full">
          <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Payroll Workflow</h1>
          <p className="text-gray-600">Review and approve payroll runs</p>
        </div>
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
                    <TableCell className="font-medium text-right min-w-fit whitespace-nowrap">
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
                      <div className="flex space-x-1 flex-wrap gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRun(run);
                                setShowRunDetailsModal(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View payroll run details</p>
                          </TooltipContent>
                        </Tooltip>
                        {canRerun(run) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  rerunPayrollMutation.mutate(run.id);
                                }}
                                disabled={rerunPayrollMutation.isPending}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Rerun payroll calculation</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canSendForReview(run) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  sendForReviewMutation.mutate(run.id);
                                }}
                                disabled={sendForReviewMutation.isPending}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Send for review</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
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
                                disabled={isPayrollLocked(run)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isPayrollLocked(run) 
                                  ? 'Payroll is locked and cannot be modified' 
                                  : 'Review and approve payroll'
                                }
                              </p>
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
                                disabled={isPayrollLocked(run)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isPayrollLocked(run) 
                                  ? 'Payroll is already finalized and locked' 
                                  : 'Finalize and process payroll'
                                }
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canGeneratePayslips(run) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  generatePayslipsMutation.mutate(run.id);
                                }}
                                disabled={generatePayslipsMutation.isPending}
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Generate payslips</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canReopen(run) && (
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-orange-600 hover:text-orange-700"
                                  >
                                    <Unlock className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reopen processed payroll (Super Admin only)</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reopen Processed Payroll</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to reopen this processed payroll for {formatPeriod(run.period)}?
                                  <br /><br />
                                  <strong>Warning:</strong> This will change the status from "Processed" to "Draft" and allow modifications. 
                                  This action should only be done in exceptional circumstances and will be logged for audit purposes.
                                  <br /><br />
                                  <strong>Department:</strong> {run.departments?.name || 'All Departments'}
                                  <br />
                                  <strong>Staff Count:</strong> {run.total_staff || 0}
                                  <br />
                                  <strong>Net Amount:</strong> {formatCurrency(run.net_amount || 0)}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setSelectedRun(run);
                                    reopenPayrollMutation.mutate(run.id);
                                  }}
                                  disabled={reopenPayrollMutation.isPending}
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  {reopenPayrollMutation.isPending ? (
                                    <>
                                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                                      Reopening...
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="mr-2 h-4 w-4" />
                                      Reopen Payroll
                                    </>
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                  disabled={approvePayrollMutation.isPending || isPayrollLocked(selectedRun) || finalizePayrollMutation.isPending || reopenPayrollMutation.isPending || sendForReviewMutation.isPending || rerunPayrollMutation.isPending || generatePayslipsMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => approvePayrollMutation.mutate({ runId: selectedRun.id, action: 'approve' })}
                  disabled={approvePayrollMutation.isPending || isPayrollLocked(selectedRun) || finalizePayrollMutation.isPending || reopenPayrollMutation.isPending || sendForReviewMutation.isPending || rerunPayrollMutation.isPending || generatePayslipsMutation.isPending}
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

      {/* Payroll Run Details Modal */}
      {selectedRun && (
        <PayrollDetailsModal
          open={showRunDetailsModal}
          onClose={() => {
            setShowRunDetailsModal(false);
            setSelectedRun(null);
          }}
          payrollRun={selectedRun}
        />
      )}
    </div>
  );
}
import { supabase } from './supabase';
import { logAuditAction } from './audit-logger';

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string;
  isPaid: boolean;
  maxDaysPerYear: number;
  accrualRate: number;
  requiresApproval: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id?: string;
  staffId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy?: string;
  approvedBy?: string;
  approvalComments?: string;
  approvedAt?: string;
}

export interface LeaveBalance {
  id: string;
  staffId: string;
  leaveTypeId: string;
  year: number;
  accruedDays: number;
  usedDays: number;
  remainingDays: number;
  carriedForward: number;
  leaveType?: LeaveType;
}

/**
 * Calculate working days between two dates (excluding weekends)
 */
export function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Fetch all active leave types
 */
export async function getActiveLeaveTypes(): Promise<LeaveType[]> {
  const { data, error } = await supabase
    .from('leave_types')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  
  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    code: item.code,
    description: item.description,
    isPaid: item.is_paid,
    maxDaysPerYear: item.max_days_per_year,
    accrualRate: parseFloat(item.accrual_rate),
    requiresApproval: item.requires_approval,
    isActive: item.is_active,
  }));
}

/**
 * Create a new leave type
 */
export async function createLeaveType(leaveType: Omit<LeaveType, 'id'>): Promise<LeaveType> {
  const { data, error } = await supabase
    .from('leave_types')
    .insert({
      name: leaveType.name,
      code: leaveType.code.toUpperCase(),
      description: leaveType.description,
      is_paid: leaveType.isPaid,
      max_days_per_year: leaveType.maxDaysPerYear,
      accrual_rate: leaveType.accrualRate.toString(),
      requires_approval: leaveType.requiresApproval,
      is_active: leaveType.isActive,
    })
    .select()
    .single();

  if (error) throw error;

  await logAuditAction({
    action: 'leave_type_created',
    resource: 'leave_types',
    resourceId: data.id,
    newValues: leaveType,
  });

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    description: data.description,
    isPaid: data.is_paid,
    maxDaysPerYear: data.max_days_per_year,
    accrualRate: parseFloat(data.accrual_rate),
    requiresApproval: data.requires_approval,
    isActive: data.is_active,
  };
}

/**
 * Update a leave type
 */
export async function updateLeaveType(id: string, updates: Partial<Omit<LeaveType, 'id'>>): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name) updateData.name = updates.name;
  if (updates.code) updateData.code = updates.code.toUpperCase();
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.isPaid !== undefined) updateData.is_paid = updates.isPaid;
  if (updates.maxDaysPerYear) updateData.max_days_per_year = updates.maxDaysPerYear;
  if (updates.accrualRate !== undefined) updateData.accrual_rate = updates.accrualRate.toString();
  if (updates.requiresApproval !== undefined) updateData.requires_approval = updates.requiresApproval;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { error } = await supabase
    .from('leave_types')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;

  await logAuditAction({
    action: 'leave_type_updated',
    resource: 'leave_types',
    resourceId: id,
    newValues: updates,
  });
}

/**
 * Submit a leave request
 */
export async function submitLeaveRequest(request: LeaveRequest): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const workingDays = calculateWorkingDays(request.startDate, request.endDate);
  
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      staff_id: request.staffId,
      leave_type_id: request.leaveTypeId,
      start_date: request.startDate,
      end_date: request.endDate,
      total_days: workingDays,
      reason: request.reason,
      requested_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;

  await logAuditAction({
    action: 'leave_request_submitted',
    resource: 'leave_requests',
    resourceId: data.id,
    newValues: { ...request, totalDays: workingDays },
  });

  // Create notification for approvers
  const { data: approvers } = await supabase
    .from('users')
    .select('id')
    .in('role', ['super_admin', 'account_admin', 'payroll_admin']);

  if (approvers?.length) {
    const notifications = approvers.map(approver => ({
      user_id: approver.id,
      title: 'New Leave Request',
      message: `A new leave request has been submitted and requires approval.`,
      type: 'info',
    }));

    await supabase
      .from('notifications')
      .insert(notifications);
  }

  return data.id;
}

/**
 * Get leave requests for a staff member
 */
export async function getStaffLeaveRequests(staffId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      leave_types (
        name,
        code,
        is_paid
      ),
      approved_by_user:users!leave_requests_approved_by_fkey (
        email
      )
    `)
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get pending leave requests for approval
 */
export async function getPendingLeaveRequests(): Promise<any[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      staff (
        staff_id,
        first_name,
        last_name,
        departments!staff_department_id_fkey (
          name
        )
      ),
      leave_types (
        name,
        code,
        is_paid
      ),
      requested_by_user:users!leave_requests_requested_by_fkey (
        email
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Approve or reject a leave request
 */
export async function updateLeaveRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected',
  comments?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const updateData: any = {
    status,
    approved_by: user?.id,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (comments) {
    updateData.approval_comments = comments;
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .update(updateData)
    .eq('id', requestId)
    .select(`
      *,
      staff (
        user_id,
        first_name,
        last_name
      ),
      leave_types (
        name
      )
    `)
    .single();

  if (error) throw error;

  await logAuditAction({
    action: `leave_request_${status}`,
    resource: 'leave_requests',
    resourceId: requestId,
    newValues: { status, comments },
  });

  // Create notification for the staff member
  if (data.staff?.user_id) {
    await supabase
      .from('notifications')
      .insert({
        user_id: data.staff.user_id,
        title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your ${data.leave_types?.name} request has been ${status}. ${comments ? `Comments: ${comments}` : ''}`,
        type: status === 'approved' ? 'success' : 'warning',
      });
  }
}

/**
 * Get leave balances for a staff member
 */
export async function getStaffLeaveBalances(staffId: string, year?: number): Promise<LeaveBalance[]> {
  const currentYear = year || new Date().getFullYear();
  
  const { data, error } = await supabase
    .from('staff_leave_balances')
    .select(`
      *,
      leave_types (
        name,
        code,
        is_paid,
        max_days_per_year
      )
    `)
    .eq('staff_id', staffId)
    .eq('year', currentYear)
    .order('leave_types(name)');

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    staffId: item.staff_id,
    leaveTypeId: item.leave_type_id,
    year: item.year,
    accruedDays: parseFloat(item.accrued_days),
    usedDays: parseFloat(item.used_days),
    remainingDays: parseFloat(item.remaining_days),
    carriedForward: parseFloat(item.carried_forward),
    leaveType: item.leave_types ? {
      id: item.leave_type_id,
      name: item.leave_types.name,
      code: item.leave_types.code,
      isPaid: item.leave_types.is_paid,
      maxDaysPerYear: item.leave_types.max_days_per_year,
      accrualRate: 0, // Not needed for balance display
      requiresApproval: true, // Not needed for balance display
      isActive: true, // Not needed for balance display
    } : undefined,
  }));
}

/**
 * Initialize leave balances for a new staff member
 */
export async function initializeStaffLeaveBalances(staffId: string): Promise<void> {
  const { error } = await supabase.rpc('initialize_staff_leave_balances', {
    staff_id_param: staffId,
  });

  if (error) throw error;

  await logAuditAction({
    action: 'leave_balances_initialized',
    resource: 'staff_leave_balances',
    resourceId: staffId,
    newValues: { staffId },
  });
}

/**
 * Check if staff member has sufficient leave balance
 */
export async function checkLeaveBalance(
  staffId: string,
  leaveTypeId: string,
  requestedDays: number,
  year?: number
): Promise<{ hasBalance: boolean; message?: string }> {
  const currentYear = year || new Date().getFullYear();

  // First, check if the leave type is paid. Unpaid leave doesn't need a balance check.
  const { data: leaveType, error: leaveTypeError } = await supabase
    .from('leave_types')
    .select('is_paid, name')
    .eq('id', leaveTypeId)
    .single();

  if (leaveTypeError) {
    // This error is critical and should be thrown
    throw new Error('Could not verify the leave type.');
  }

  if (!leaveType.is_paid) {
    return { hasBalance: true, message: 'Sufficient balance.' };
  }
  
  // **FIX**: Use .maybeSingle() to safely fetch the balance.
  // This returns `null` instead of throwing an error if no row is found.
  const { data: balance, error } = await supabase
    .from('staff_leave_balances')
    .select('remaining_days')
    .eq('staff_id', staffId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', currentYear)
    .maybeSingle();

  // Handle actual database errors, but not the "0 rows" case
  if (error) {
    throw error;
  }

  // If balance is null (no record) or the balance is insufficient
  if (!balance || parseFloat(balance.remaining_days) < requestedDays) {
    // This specific error code will be caught by the calling component
    const customError: any = new Error('Insufficient leave balance.');
    customError.code = 'PGRST116'; // Simulate the error code for consistent handling
    throw customError;
  }

  return { hasBalance: true, message: 'Sufficient balance.' };
}


/**
 * Cancel a leave request (only if pending)
 */
export async function cancelLeaveRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('leave_requests')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending'); // Only allow cancellation of pending requests

  if (error) throw error;

  await logAuditAction({
    action: 'leave_request_cancelled',
    resource: 'leave_requests',
    resourceId: requestId,
    newValues: { status: 'cancelled' },
  });
}

/**
 * Get leave requests that affect payroll for a specific period
 */
export async function getLeaveRequestsForPayrollPeriod(period: string): Promise<any[]> {
  const [year, month] = period.split('-');
  const startOfMonth = `${year}-${month}-01`;
  const endOfMonth = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      staff (
        id,
        staff_id,
        first_name,
        last_name
      ),
      leave_types (
        name,
        is_paid
      )
    `)
    .eq('status', 'approved')
    .or(`start_date.lte.${endOfMonth},end_date.gte.${startOfMonth}`)
    .order('start_date');

  if (error) throw error;

  return (data || []).map(request => {
    // Calculate overlap with payroll period
    const requestStart = new Date(request.start_date);
    const requestEnd = new Date(request.end_date);
    const periodStart = new Date(startOfMonth);
    const periodEnd = new Date(endOfMonth);

    const overlapStart = new Date(Math.max(requestStart.getTime(), periodStart.getTime()));
    const overlapEnd = new Date(Math.min(requestEnd.getTime(), periodEnd.getTime()));
    
    const daysInPeriod = calculateWorkingDays(
      overlapStart.toISOString().split('T')[0],
      overlapEnd.toISOString().split('T')[0]
    );

    return {
      ...request,
      daysInPeriod,
      isPaid: request.leave_types?.is_paid || false,
    };
  });
}

/**
 * Run monthly leave accrual for all active staff
 */
export async function runMonthlyLeaveAccrual(): Promise<void> {
  const { error } = await supabase.rpc('accrue_monthly_leave');

  if (error) throw error;

  await logAuditAction({
    action: 'monthly_leave_accrual_run',
    resource: 'staff_leave_balances',
    newValues: { date: new Date().toISOString() },
  });
}

/**
 * Get leave statistics for dashboard
 */
export async function getLeaveStatistics(): Promise<{
  totalPendingRequests: number;
  totalApprovedThisMonth: number;
  totalStaffOnLeave: number;
  mostUsedLeaveType: string;
}> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().split('T')[0];

  const [pendingRequests, approvedThisMonth, staffOnLeave, leaveTypeUsage] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'pending'),
    
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'approved')
      .gte('created_at', `${currentMonth}-01`),
    
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today),
    
    supabase
      .from('leave_requests')
      .select(`
        leave_type_id,
        leave_types (name)
      `)
      .eq('status', 'approved')
      .gte('created_at', `${new Date().getFullYear()}-01-01`)
  ]);

  // Calculate most used leave type
  const leaveTypeCounts: Record<string, number> = {};
  leaveTypeUsage.data?.forEach(request => {
    const typeName = request.leave_types?.name || 'Unknown';
    leaveTypeCounts[typeName] = (leaveTypeCounts[typeName] || 0) + 1;
  });

  const mostUsedLeaveType = Object.entries(leaveTypeCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

  return {
    totalPendingRequests: pendingRequests.count || 0,
    totalApprovedThisMonth: approvedThisMonth.count || 0,
    totalStaffOnLeave: staffOnLeave.count || 0,
    mostUsedLeaveType,
  };
}

import { supabase } from './supabase';

export interface AuditLogData {
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
}

/**
 * Log an audit action to the database
 */
export async function logAuditAction(data: AuditLogData): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user found for audit logging');
      return;
    }

    // Get client IP and user agent (limited in browser environment)
    const userAgent = navigator.userAgent;
    
    const auditRecord = {
      user_id: user.id,
      action: data.action,
      resource: data.resource,
      resource_id: data.resourceId || null,
      old_values: data.oldValues || null,
      new_values: data.newValues || null,
      ip_address: null, // Cannot get real IP in browser
      user_agent: userAgent,
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert(auditRecord);

    if (error) {
      console.error('Failed to log audit action:', error);
    }
  } catch (error) {
    console.error('Error in audit logging:', error);
  }
}

/**
 * Log user authentication events
 */
export async function logAuthEvent(action: 'login' | 'logout', userEmail?: string): Promise<void> {
  await logAuditAction({
    action: `user_${action}`,
    resource: 'users',
    newValues: { email: userEmail },
  });
}

/**
 * Log staff management events
 */
export async function logStaffEvent(
  action: 'created' | 'updated' | 'deleted',
  staffId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await logAuditAction({
    action: `staff_${action}`,
    resource: 'staff',
    resourceId: staffId,
    oldValues,
    newValues,
  });
}

/**
 * Log department management events
 */
export async function logDepartmentEvent(
  action: 'created' | 'updated' | 'deleted',
  departmentId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await logAuditAction({
    action: `department_${action}`,
    resource: 'departments',
    resourceId: departmentId,
    oldValues,
    newValues,
  });
}

/**
 * Log payroll events
 */
export async function logPayrollEvent(
  action: 'created' | 'approved' | 'rejected' | 'processed' | 'reopened',
  payrollRunId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await logAuditAction({
    action: `payroll_${action}`,
    resource: 'payroll_runs',
    resourceId: payrollRunId,
    oldValues,
    newValues,
  });
}

/**
 * Log system configuration changes
 */
export async function logSystemEvent(
  action: string,
  resource: string,
  resourceId?: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await logAuditAction({
    action: `system_${action}`,
    resource,
    resourceId,
    oldValues,
    newValues,
  });
}

/**
 * Log loan management events
 */
export async function logLoanEvent(
  action: 'created' | 'updated' | 'approved' | 'cancelled' | 'paid_off' | 'defaulted',
  loanId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await logAuditAction({
    action: `loan_${action}`,
    resource: 'loans',
    resourceId: loanId,
    oldValues,
    newValues,
  });
}

/**
 * Log cooperative organization events
 */
export async function logCooperativeEvent(
  action: 'created' | 'updated' | 'deleted',
  cooperativeId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await logAuditAction({
    action: `cooperative_${action}`,
    resource: 'cooperative_organizations',
    resourceId: cooperativeId,
    oldValues,
    newValues,
  });
}
import { supabase } from './supabase';

export interface IndividualAllowance {
  id?: string;
  staffId: string;
  type: string;
  amount: number;
  period: string;
  description?: string;
  status?: 'pending' | 'applied' | 'cancelled';
}

export interface IndividualDeduction {
  id?: string;
  staffId: string;
  type: string;
  amount: number;
  totalAmount?: number;
  remainingBalance?: number;
  period: string;
  startPeriod?: string;
  endPeriod?: string;
  description?: string;
  status?: 'active' | 'paid_off' | 'cancelled';
}

export interface IndividualAllowanceUpdate {
  type?: string;
  amount?: number;
  period?: string;
  description?: string;
  status?: 'pending' | 'applied' | 'cancelled';
}

/**
 * Add individual allowance for a staff member
 */
export async function addIndividualAllowance(allowance: IndividualAllowance): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('staff_individual_allowances')
    .insert({
      staff_id: allowance.staffId,
      type: allowance.type,
      amount: allowance.amount.toString(),
      period: allowance.period,
      description: allowance.description,
      status: allowance.status || 'pending',
      created_by: user?.id,
    });

  if (error) throw error;
}

/**
 * Add individual deduction for a staff member
 */
export async function addIndividualDeduction(deduction: IndividualDeduction): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('staff_individual_deductions')
    .insert({
      staff_id: deduction.staffId,
      type: deduction.type,
      amount: deduction.amount.toString(),
      total_amount: deduction.totalAmount?.toString(),
      remaining_balance: deduction.remainingBalance?.toString() || deduction.totalAmount?.toString(),
      period: deduction.period,
      start_period: deduction.startPeriod,
      end_period: deduction.endPeriod,
      description: deduction.description,
      status: deduction.status || 'active',
      created_by: user?.id,
    });

  if (error) throw error;
}

/**
 * Get individual allowances for a staff member
 */
export async function getStaffIndividualAllowances(
  staffId: string, 
  period?: string
): Promise<IndividualAllowance[]> {
  let query = supabase
    .from('staff_individual_allowances')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });

  if (period) {
    query = query.eq('period', period);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    staffId: item.staff_id,
    type: item.type,
    amount: parseFloat(item.amount),
    period: item.period,
    description: item.description,
    status: item.status as 'pending' | 'applied' | 'cancelled',
  }));
}

/**
 * Get individual deductions for a staff member
 */
export async function getStaffIndividualDeductions(
  staffId: string, 
  period?: string
): Promise<IndividualDeduction[]> {
  let query = supabase
    .from('staff_individual_deductions')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });

  if (period) {
    query = query.eq('period', period);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    staffId: item.staff_id,
    type: item.type,
    amount: parseFloat(item.amount),
    totalAmount: item.total_amount ? parseFloat(item.total_amount) : undefined,
    remainingBalance: item.remaining_balance ? parseFloat(item.remaining_balance) : undefined,
    period: item.period,
    startPeriod: item.start_period,
    endPeriod: item.end_period,
    description: item.description,
    status: item.status as 'active' | 'paid_off' | 'cancelled',
  }));
}

/**
 * Update individual allowance status
 */
export async function updateIndividualAllowanceStatus(
  allowanceId: string, 
  status: 'pending' | 'applied' | 'cancelled'
): Promise<void> {
  const { error } = await supabase
    .from('staff_individual_allowances')
    .update({ 
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', allowanceId);

  if (error) throw error;
}

/**
 * Update individual allowance
 */
export async function updateIndividualAllowance(
  allowanceId: string,
  updates: IndividualAllowanceUpdate
): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.type) updateData.type = updates.type;
  if (updates.amount !== undefined) updateData.amount = updates.amount.toString();
  if (updates.period) updateData.period = updates.period;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.status) updateData.status = updates.status;

  const { error } = await supabase
    .from('staff_individual_allowances')
    .update(updateData)
    .eq('id', allowanceId);

  if (error) throw error;
}

/**
 * Update individual deduction status and balance
 */
export async function updateIndividualDeduction(
  deductionId: string,
  updates: Partial<IndividualDeduction>
): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) updateData.status = updates.status;
  if (updates.remainingBalance !== undefined) updateData.remaining_balance = updates.remainingBalance.toString();
  if (updates.amount !== undefined) updateData.amount = updates.amount.toString();

  const { error } = await supabase
    .from('staff_individual_deductions')
    .update(updateData)
    .eq('id', deductionId);

  if (error) throw error;
}

/**
 * Cancel individual allowance
 */
export async function cancelIndividualAllowance(allowanceId: string): Promise<void> {
  await updateIndividualAllowanceStatus(allowanceId, 'cancelled');
}

/**
 * Cancel individual deduction
 */
export async function cancelIndividualDeduction(deductionId: string): Promise<void> {
  const { error } = await supabase
    .from('staff_individual_deductions')
    .update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', deductionId);

  if (error) throw error;
}

/**
 * Get pending individual allowances for payroll processing
 */
export async function getPendingAllowancesForPeriod(period: string): Promise<IndividualAllowance[]> {
  const { data, error } = await supabase
    .from('staff_individual_allowances')
    .select(`
      *,
      staff (
        staff_id,
        first_name,
        last_name
      )
    `)
    .eq('period', period)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    staffId: item.staff_id,
    type: item.type,
    amount: parseFloat(item.amount),
    period: item.period,
    description: item.description,
    status: item.status as 'pending' | 'applied' | 'cancelled',
  }));
}

/**
 * Get active individual deductions for payroll processing
 */
export async function getActiveDeductionsForPeriod(period: string): Promise<IndividualDeduction[]> {
  const { data, error } = await supabase
    .from('staff_individual_deductions')
    .select(`
      *,
      staff (
        staff_id,
        first_name,
        last_name
      )
    `)
    .eq('period', period)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    staffId: item.staff_id,
    type: item.type,
    amount: parseFloat(item.amount),
    totalAmount: item.total_amount ? parseFloat(item.total_amount) : undefined,
    remainingBalance: item.remaining_balance ? parseFloat(item.remaining_balance) : undefined,
    period: item.period,
    startPeriod: item.start_period,
    endPeriod: item.end_period,
    description: item.description,
    status: item.status as 'active' | 'paid_off' | 'cancelled',
  }));
}
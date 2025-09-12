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
  loanId?: string;
  isLoanRepayment?: boolean;
}

export interface IndividualAllowanceUpdate {
  type?: string;
  amount?: number;
  period?: string;
  description?: string;
  status?: 'pending' | 'applied' | 'cancelled';
}

export interface CooperativeOrganization {
  id: string;
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  interestRateDefault?: number;
  isActive: boolean;
}

export interface Loan {
  id: string;
  staffId: string;
  cooperativeId?: string;
  loanType: string;
  totalLoanAmount: number;
  interestRate: number;
  interestCalculationMethod: string;
  totalInterestCharged: number;
  monthlyPrincipalAmount: number;
  monthlyInterestAmount: number;
  monthlyTotalDeduction: number;
  numberOfInstallments: number;
  installmentsPaid: number;
  startDate: string;
  endDate: string;
  remainingBalance: number;
  status: string;
  notes?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
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
      loan_id: deduction.loanId,
      is_loan_repayment: deduction.isLoanRepayment || false,
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

/**
 * Create a new cooperative organization
 */
export async function createCooperativeOrganization(cooperative: Omit<CooperativeOrganization, 'id'>): Promise<CooperativeOrganization> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('cooperative_organizations')
    .insert({
      name: cooperative.name,
      contact_person: cooperative.contactPerson,
      phone_number: cooperative.phoneNumber,
      email: cooperative.email,
      address: cooperative.address,
      interest_rate_default: cooperative.interestRateDefault?.toString(),
      is_active: cooperative.isActive,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    contactPerson: data.contact_person,
    phoneNumber: data.phone_number,
    email: data.email,
    address: data.address,
    interestRateDefault: data.interest_rate_default ? parseFloat(data.interest_rate_default) : undefined,
    isActive: data.is_active,
  };
}

/**
 * Get all cooperative organizations
 */
export async function getCooperativeOrganizations(): Promise<CooperativeOrganization[]> {
  const { data, error } = await supabase
    .from('cooperative_organizations')
    .select('*')
    .order('name');

  if (error) throw error;

  return (data || []).map(item => {
    console.log("Raw item from Supabase:", item); // Log the raw item
    const isActiveValue = item.is_active;
    let isActiveBoolean: boolean;

    if (typeof isActiveValue === 'boolean') {
      isActiveBoolean = isActiveValue;
    } else if (typeof isActiveValue === 'string') {
      isActiveBoolean = isActiveValue.toLowerCase() === 'true';
    } else if (isActiveValue === null || isActiveValue === undefined) {
      isActiveBoolean = false; // Default to false if null or undefined
    } else {
      isActiveBoolean = Boolean(isActiveValue); // Catch-all for other types
    }

    return {
      id: item.id,
      name: item.name,
      contactPerson: item.contact_person,
      phoneNumber: item.phone_number,
      email: item.email,
      address: item.address,
      interestRateDefault: item.interest_rate_default ? parseFloat(item.interest_rate_default) : undefined,
      isActive: isActiveBoolean, // Use the robustly converted boolean
    };
  });
}

/**
 * Update a cooperative organization
 */
export async function updateCooperativeOrganization(id: string, updates: Partial<Omit<CooperativeOrganization, 'id'>>): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name) updateData.name = updates.name;
  if (updates.contactPerson !== undefined) updateData.contact_person = updates.contactPerson;
  if (updates.phoneNumber !== undefined) updateData.phone_number = updates.phoneNumber;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.address !== undefined) updateData.address = updates.address;
  if (updates.interestRateDefault !== undefined) updateData.interest_rate_default = updates.interestRateDefault?.toString();
  
  // Explicitly ensure is_active is a boolean
  updateData.is_active = Boolean(updates.isActive); 

  console.log(`[updateCooperativeOrganization] Updating cooperative ${id} with data:`, updateData);

  const { error } = await supabase
    .from('cooperative_organizations')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error("[updateCooperativeOrganization] Supabase update error:", error);
    throw error;
  }
}

/**
 * Delete a cooperative organization
 */
export async function deleteCooperativeOrganization(id: string): Promise<void> {
  const { error } = await supabase
    .from('cooperative_organizations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Create a new loan
 */
export async function createLoan(loan: Omit<Loan, 'id' | 'installmentsPaid' | 'remainingBalance' | 'createdBy' | 'approvedBy' | 'approvedAt'>): Promise<Loan> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('loans')
    .insert({
      staff_id: loan.staffId,
      cooperative_id: loan.cooperativeId,
      loan_type: loan.loanType,
      total_loan_amount: loan.totalLoanAmount.toString(),
      interest_rate: loan.interestRate.toString(),
      interest_calculation_method: loan.interestCalculationMethod,
      total_interest_charged: loan.totalInterestCharged.toString(),
      monthly_principal_amount: loan.monthlyPrincipalAmount.toString(),
      monthly_interest_amount: loan.monthlyInterestAmount.toString(),
      monthly_total_deduction: loan.monthlyTotalDeduction.toString(),
      number_of_installments: loan.numberOfInstallments,
      start_date: loan.startDate,
      end_date: loan.endDate,
      remaining_balance: loan.totalLoanAmount.toString(),
      status: loan.status,
      notes: loan.notes,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    staffId: data.staff_id,
    cooperativeId: data.cooperative_id,
    loanType: data.loan_type,
    totalLoanAmount: parseFloat(data.total_loan_amount),
    interestRate: parseFloat(data.interest_rate),
    interestCalculationMethod: data.interest_calculation_method,
    totalInterestCharged: parseFloat(data.total_interest_charged),
    monthlyPrincipalAmount: parseFloat(data.monthly_principal_amount),
    monthlyInterestAmount: parseFloat(data.monthly_interest_amount),
    monthlyTotalDeduction: parseFloat(data.monthly_total_deduction),
    numberOfInstallments: data.number_of_installments,
    installmentsPaid: data.installments_paid || 0,
    startDate: data.start_date,
    endDate: data.end_date,
    remainingBalance: parseFloat(data.remaining_balance),
    status: data.status,
    notes: data.notes,
    createdBy: data.created_by,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
  };
}

/**
 * Get loan by ID
 */
export async function getLoanById(loanId: string): Promise<Loan | null> {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      staff (
        staff_id,
        first_name,
        last_name
      ),
      cooperative_organizations (
        name
      )
    `)
    .eq('id', loanId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    id: data.id,
    staffId: data.staff_id,
    cooperativeId: data.cooperative_id,
    loanType: data.loan_type,
    totalLoanAmount: parseFloat(data.total_loan_amount),
    interestRate: parseFloat(data.interest_rate),
    interestCalculationMethod: data.interest_calculation_method,
    totalInterestCharged: parseFloat(data.total_interest_charged),
    monthlyPrincipalAmount: parseFloat(data.monthly_principal_amount),
    monthlyInterestAmount: parseFloat(data.monthly_interest_amount),
    monthlyTotalDeduction: parseFloat(data.monthly_total_deduction),
    numberOfInstallments: data.number_of_installments,
    installmentsPaid: data.installments_paid || 0,
    startDate: data.start_date,
    endDate: data.end_date,
    remainingBalance: parseFloat(data.remaining_balance),
    status: data.status,
    notes: data.notes,
    createdBy: data.created_by,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
  };
}

/**
 * Get loans for a specific staff member
 */
export async function getStaffLoans(staffId: string): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      cooperative_organizations (
        name
      )
    `)
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    staffId: item.staff_id,
    cooperativeId: item.cooperative_id,
    loanType: item.loan_type,
    totalLoanAmount: parseFloat(item.total_loan_amount),
    interestRate: parseFloat(item.interest_rate),
    interestCalculationMethod: item.interest_calculation_method,
    totalInterestCharged: parseFloat(item.total_interest_charged),
    monthlyPrincipalAmount: parseFloat(item.monthly_principal_amount),
    monthlyInterestAmount: parseFloat(item.monthly_interest_amount),
    monthlyTotalDeduction: parseFloat(item.monthly_total_deduction),
    numberOfInstallments: item.number_of_installments,
    installmentsPaid: item.installments_paid || 0,
    startDate: item.start_date,
    endDate: item.end_date,
    remainingBalance: parseFloat(item.remaining_balance),
    status: item.status,
    notes: item.notes,
    createdBy: item.created_by,
    approvedBy: item.approved_by,
    approvedAt: item.approved_at,
  }));
}

/**
 * Update a loan
 */
export async function updateLoan(loanId: string, updates: Partial<Loan>): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.cooperativeId !== undefined) updateData.cooperative_id = updates.cooperativeId;
  if (updates.loanType) updateData.loan_type = updates.loanType;
  if (updates.totalLoanAmount !== undefined) updateData.total_loan_amount = updates.totalLoanAmount.toString();
  if (updates.interestRate !== undefined) updateData.interest_rate = updates.interestRate.toString();
  if (updates.interestCalculationMethod) updateData.interest_calculation_method = updates.interestCalculationMethod;
  if (updates.totalInterestCharged !== undefined) updateData.total_interest_charged = updates.totalInterestCharged.toString();
  if (updates.monthlyPrincipalAmount !== undefined) updateData.monthly_principal_amount = updates.monthlyPrincipalAmount.toString();
  if (updates.monthlyInterestAmount !== undefined) updateData.monthly_interest_amount = updates.monthlyInterestAmount.toString();
  if (updates.monthlyTotalDeduction !== undefined) updateData.monthly_total_deduction = updates.monthlyTotalDeduction.toString();
  if (updates.numberOfInstallments !== undefined) updateData.number_of_installments = updates.numberOfInstallments;
  if (updates.installmentsPaid !== undefined) updateData.installments_paid = updates.installments_paid;
  if (updates.startDate) updateData.start_date = updates.startDate;
  if (updates.endDate) updateData.end_date = updates.endDate;
  if (updates.remainingBalance !== undefined) updateData.remaining_balance = updates.remainingBalance.toString();
  if (updates.status) updateData.status = updates.status;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.approvedBy !== undefined) updateData.approved_by = updates.approvedBy;
  if (updates.approvedAt !== undefined) updateData.approved_at = updates.approvedAt;

  const { error } = await supabase
    .from('loans')
    .update(updateData)
    .eq('id', loanId);

  if (error) throw error;
}

/**
 * Delete a loan
 */
export async function deleteLoan(loanId: string): Promise<void> {
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId);

  if (error) throw error;
}

/**
 * Calculate loan schedule using Supabase RPC
 */
export async function calculateLoanScheduleRPC(
  principal: number,
  interestRate: number,
  installments: number,
  method: string = 'flat'
): Promise<{
  monthlyPrincipal: number;
  monthlyInterest: number;
  monthlyTotal: number;
  totalInterest: number;
}> {
  const { data, error } = await supabase.rpc('calculate_loan_schedule', {
    p_principal: principal,
    p_interest_rate: interestRate,
    p_installments: installments,
    p_method: method,
  });

  if (error) throw error;

  const result = data[0];
  return {
    monthlyPrincipal: parseFloat(result.monthly_principal),
    monthlyInterest: parseFloat(result.monthly_interest),
    monthlyTotal: parseFloat(result.monthly_total),
    totalInterest: parseFloat(result.total_interest),
  };
}

/**
 * Get loan repayment schedule
 */
export async function getLoanRepaymentSchedule(loanId: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_loan_repayment_schedule', {
    p_loan_id: loanId,
  });

  if (error) throw error;
  return data || [];
}

import { supabase } from './supabase';

export interface PayrollInputs {
  staffId: string;
  gradeLevel: number;
  step: number;
  position: string;
  arrears?: number;
  overtime?: number;
  bonus?: number;
  loans?: number;
  cooperatives?: number;
  individualAllowances?: Array<{
    type: string;
    amount: number;
    description?: string;
  }>;
  individualDeductions?: Array<{
    type: string;
    amount: number;
    description?: string;
  }>;
}

export interface PayrollResult {
  staffId: string;
  basicSalary: number;
  allowancesBreakdown: Record<string, number>;
  individualAllowancesBreakdown: Record<string, number>;
  totalAllowances: number;
  grossPay: number;
  deductionsBreakdown: Record<string, number>;
  individualDeductionsBreakdown: Record<string, number>;
  totalDeductions: number;
  netPay: number;
  arrears: number;
  overtime: number;
  bonus: number;
}

export interface AllowanceRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  is_active: boolean;
}

export interface DeductionRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  is_active: boolean;
}

/**
 * Fetch active allowance and deduction rules from database
 */
export async function fetchPayrollRules(): Promise<{
  allowances: AllowanceRule[];
  deductions: DeductionRule[];
}> {
  const [allowancesResult, deductionsResult] = await Promise.all([
    supabase
      .from('allowances')
      .select('*')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('deductions')
      .select('*')
      .eq('is_active', true)
      .order('name'),
  ]);

  if (allowancesResult.error) throw allowancesResult.error;
  if (deductionsResult.error) throw deductionsResult.error;

  return {
    allowances: allowancesResult.data || [],
    deductions: deductionsResult.data || [],
  };
}

/**
 * Get basic salary from salary structure table
 */
export async function getBasicSalaryFromDB(gradeLevel: number, step: number): Promise<number> {
  const { data, error } = await supabase
    .from('salary_structure')
    .select('basic_salary')
    .eq('grade_level', gradeLevel)
    .eq('step', step)
    .single();

  if (error) {
    console.warn(`No salary structure found for GL${gradeLevel} Step${step}, using fallback calculation`);
    // Fallback calculation if not found in database
    const baseSalary = 30000 + (gradeLevel * 8000) + (step * 2000);
    return baseSalary;
  }

  return parseFloat(data.basic_salary);
}

/**
 * Calculate allowances based on database rules
 */
export function calculateAllowances(
  basicSalary: number,
  allowanceRules: AllowanceRule[],
  gradeLevel: number,
  position: string
): Record<string, number> {
  const allowances: Record<string, number> = {};

  allowanceRules.forEach(rule => {
    let amount = 0;
    
    if (rule.type === 'percentage') {
      amount = basicSalary * (rule.value / 100);
    } else {
      amount = rule.value;
    }

    // Apply position-based adjustments
    if (rule.name.toLowerCase().includes('responsibility')) {
      // Senior positions get higher responsibility allowance
      if (gradeLevel >= 15) {
        amount *= 1.5;
      } else if (gradeLevel >= 10) {
        amount *= 1.2;
      }
    }

    if (rule.name.toLowerCase().includes('hazard')) {
      // Only apply hazard allowance for field/rural positions
      if (!position.toLowerCase().includes('field') && !position.toLowerCase().includes('rural')) {
        amount = 0;
      }
    }

    allowances[rule.name.toLowerCase().replace(/\s+/g, '_')] = amount;
  });

  return allowances;
}

/**
 * Calculate PAYE tax based on Nigerian tax brackets
 */
export function calculatePAYE(annualGross: number): number {
  let tax = 0;
  const taxFreeAllowance = 300000; // ₦300,000 annual tax-free allowance

  if (annualGross > taxFreeAllowance) {
    const taxableIncome = annualGross - taxFreeAllowance;
    
    // Nigerian tax brackets (2024/2025)
    if (taxableIncome <= 300000) {
      tax = taxableIncome * 0.07; // 7%
    } else if (taxableIncome <= 800000) {
      tax = 300000 * 0.07 + (taxableIncome - 300000) * 0.11; // 11%
    } else if (taxableIncome <= 1300000) {
      tax = 300000 * 0.07 + 500000 * 0.11 + (taxableIncome - 800000) * 0.15; // 15%
    } else if (taxableIncome <= 2900000) {
      tax = 300000 * 0.07 + 500000 * 0.11 + 500000 * 0.15 + (taxableIncome - 1300000) * 0.19; // 19%
    } else {
      tax = 300000 * 0.07 + 500000 * 0.11 + 500000 * 0.15 + 1600000 * 0.19 + (taxableIncome - 2900000) * 0.21; // 21%
    }
  }

  return tax;
}

/**
 * Calculate deductions based on database rules
 */
export function calculateDeductions(
  basicSalary: number,
  grossPay: number,
  deductionRules: DeductionRule[],
  loans: number = 0,
  cooperatives: number = 0
): Record<string, number> {
  const deductions: Record<string, number> = {};

  deductionRules.forEach(rule => {
    let amount = 0;
    
    if (rule.name.toLowerCase().includes('paye') || rule.name.toLowerCase().includes('tax')) {
      // Calculate PAYE based on annual gross
      amount = calculatePAYE(grossPay * 12) / 12; // Convert back to monthly
    } else if (rule.type === 'percentage') {
      // Most percentage deductions are based on gross pay
      const baseAmount = rule.name.toLowerCase().includes('nhf') ? basicSalary : grossPay;
      amount = baseAmount * (rule.value / 100);
    } else {
      amount = rule.value;
    }

    deductions[rule.name.toLowerCase().replace(/\s+/g, '_')] = amount;
  });

  // Add custom deductions
  if (loans > 0) {
    deductions['loan_repayment'] = loans;
  }
  if (cooperatives > 0) {
    deductions['cooperative_deduction'] = cooperatives;
  }

  return deductions;
}

/**
 * Fetch individual allowances for a staff member for a specific period
 */
export async function fetchIndividualAllowances(staffId: string, period: string): Promise<Array<{
  type: string;
  amount: number;
  description?: string;
}>> {
  const { data, error } = await supabase
    .from('staff_individual_allowances')
    .select('type, amount, description')
    .eq('staff_id', staffId)
    .eq('period', period)
    .eq('status', 'pending'); // Only get pending allowances for processing

  if (error) {
    console.error('Error fetching individual allowances:', error);
    return [];
  }

  return (data || []).map(item => ({
    type: item.type,
    amount: parseFloat(item.amount),
    description: item.description || undefined,
  }));
}

/**
 * Fetch individual deductions for a staff member for a specific period
 */
export async function fetchIndividualDeductions(staffId: string, period: string): Promise<Array<{
  type: string;
  amount: number;
  description?: string;
}>> {
  const { data, error } = await supabase
    .from('staff_individual_deductions')
    .select('type, amount, description')
    .eq('staff_id', staffId)
    .eq('period', period)
    .eq('status', 'active'); // Only get active deductions for processing

  if (error) {
    console.error('Error fetching individual deductions:', error);
    return [];
  }

  return (data || []).map(item => ({
    type: item.type,
    amount: parseFloat(item.amount),
    description: item.description || undefined,
  }));
}

/**
 * Calculate complete payroll for a staff member
 */
export async function calculateStaffPayroll(inputs: PayrollInputs): Promise<PayrollResult> {
  // Get basic salary from database
  const basicSalary = await getBasicSalaryFromDB(inputs.gradeLevel, inputs.step);
  
  // Fetch allowance and deduction rules
  const { allowances: allowanceRules, deductions: deductionRules } = await fetchPayrollRules();
  
  // Fetch individual allowances and deductions for this staff member
  const period = new Date().toISOString().slice(0, 7); // Current period, could be passed as parameter
  const individualAllowances = inputs.individualAllowances || await fetchIndividualAllowances(inputs.staffId, period);
  const individualDeductions = inputs.individualDeductions || await fetchIndividualDeductions(inputs.staffId, period);
  
  // Calculate allowances
  const allowancesBreakdown = calculateAllowances(
    basicSalary,
    allowanceRules,
    inputs.gradeLevel,
    inputs.position
  );
  
  // Calculate individual allowances breakdown
  const individualAllowancesBreakdown: Record<string, number> = {};
  individualAllowances.forEach(allowance => {
    const key = allowance.type.toLowerCase().replace(/\s+/g, '_');
    individualAllowancesBreakdown[key] = (individualAllowancesBreakdown[key] || 0) + allowance.amount;
  });
  
  const totalAllowances = Object.values(allowancesBreakdown).reduce((sum, amount) => sum + amount, 0);
  const totalIndividualAllowances = Object.values(individualAllowancesBreakdown).reduce((sum, amount) => sum + amount, 0);
  
  // Calculate gross pay including extras
  const arrears = inputs.arrears || 0;
  const overtime = inputs.overtime || 0;
  const bonus = inputs.bonus || 0;
  const grossPay = basicSalary + totalAllowances + totalIndividualAllowances + arrears + overtime + bonus;
  
  // Calculate deductions
  const deductionsBreakdown = calculateDeductions(
    basicSalary,
    grossPay,
    deductionRules,
    inputs.loans,
    inputs.cooperatives
  );
  
  // Calculate individual deductions breakdown
  const individualDeductionsBreakdown: Record<string, number> = {};
  individualDeductions.forEach(deduction => {
    const key = deduction.type.toLowerCase().replace(/\s+/g, '_');
    individualDeductionsBreakdown[key] = (individualDeductionsBreakdown[key] || 0) + deduction.amount;
  });
  
  const totalDeductions = Object.values(deductionsBreakdown).reduce((sum, amount) => sum + amount, 0);
  const totalIndividualDeductions = Object.values(individualDeductionsBreakdown).reduce((sum, amount) => sum + amount, 0);
  const finalTotalDeductions = totalDeductions + totalIndividualDeductions;
  
  // Calculate net pay
  const netPay = grossPay - finalTotalDeductions;

  return {
    staffId: inputs.staffId,
    basicSalary,
    allowancesBreakdown,
    individualAllowancesBreakdown,
    totalAllowances: totalAllowances + totalIndividualAllowances,
    grossPay,
    deductionsBreakdown,
    individualDeductionsBreakdown,
    totalDeductions: finalTotalDeductions,
    netPay,
    arrears,
    overtime,
    bonus,
  };
}

/**
 * Calculate payroll for multiple staff members
 */
export async function calculateBulkPayroll(staffInputs: PayrollInputs[]): Promise<PayrollResult[]> {
  const results: PayrollResult[] = [];
  
  // Fetch rules once for all calculations
  const { allowances: allowanceRules, deductions: deductionRules } = await fetchPayrollRules();
  
  for (const inputs of staffInputs) {
    try {
      const basicSalary = await getBasicSalaryFromDB(inputs.gradeLevel, inputs.step);
      
      // Fetch individual allowances and deductions for this staff member
      const period = new Date().toISOString().slice(0, 7); // Current period
      const individualAllowances = inputs.individualAllowances || await fetchIndividualAllowances(inputs.staffId, period);
      const individualDeductions = inputs.individualDeductions || await fetchIndividualDeductions(inputs.staffId, period);
      
      const allowancesBreakdown = calculateAllowances(
        basicSalary,
        allowanceRules,
        inputs.gradeLevel,
        inputs.position
      );
      
      // Calculate individual allowances breakdown
      const individualAllowancesBreakdown: Record<string, number> = {};
      individualAllowances.forEach(allowance => {
        const key = allowance.type.toLowerCase().replace(/\s+/g, '_');
        individualAllowancesBreakdown[key] = (individualAllowancesBreakdown[key] || 0) + allowance.amount;
      });
      
      const totalAllowances = Object.values(allowancesBreakdown).reduce((sum, amount) => sum + amount, 0);
      const totalIndividualAllowances = Object.values(individualAllowancesBreakdown).reduce((sum, amount) => sum + amount, 0);
      
      const arrears = inputs.arrears || 0;
      const overtime = inputs.overtime || 0;
      const bonus = inputs.bonus || 0;
      const grossPay = basicSalary + totalAllowances + totalIndividualAllowances + arrears + overtime + bonus;
      
      const deductionsBreakdown = calculateDeductions(
        basicSalary,
        grossPay,
        deductionRules,
        inputs.loans,
        inputs.cooperatives
      );
      
      // Calculate individual deductions breakdown
      const individualDeductionsBreakdown: Record<string, number> = {};
      individualDeductions.forEach(deduction => {
        const key = deduction.type.toLowerCase().replace(/\s+/g, '_');
        individualDeductionsBreakdown[key] = (individualDeductionsBreakdown[key] || 0) + deduction.amount;
      });
      
      const totalDeductions = Object.values(deductionsBreakdown).reduce((sum, amount) => sum + amount, 0);
      const totalIndividualDeductions = Object.values(individualDeductionsBreakdown).reduce((sum, amount) => sum + amount, 0);
      const finalTotalDeductions = totalDeductions + totalIndividualDeductions;
      const netPay = grossPay - finalTotalDeductions;

      results.push({
        staffId: inputs.staffId,
        basicSalary,
        allowancesBreakdown,
        individualAllowancesBreakdown,
        totalAllowances: totalAllowances + totalIndividualAllowances,
        grossPay,
        deductionsBreakdown,
        individualDeductionsBreakdown,
        totalDeductions: finalTotalDeductions,
        netPay,
        arrears,
        overtime,
        bonus,
      });
    } catch (error) {
      console.error(`Error calculating payroll for staff ${inputs.staffId}:`, error);
      // Continue with other staff members
    }
  }
  
  return results;
}

/**
 * Process payroll run and generate payslips
 */
export async function processPayrollRun(
  payrollRunId: string,
  period: string,
  staffInputs: PayrollInputs[]
): Promise<void> {
  // Calculate payroll for all staff
  const payrollResults = await calculateBulkPayroll(staffInputs);
  
  // Create payslip records
  const payslips = payrollResults.map(result => ({
    staff_id: result.staffId,
    payroll_run_id: payrollRunId,
    period,
    basic_salary: result.basicSalary.toString(),
    allowances: {
      ...result.allowancesBreakdown,
      ...result.individualAllowancesBreakdown,
    },
    deductions: {
      ...result.deductionsBreakdown,
      ...result.individualDeductionsBreakdown,
    },
    gross_pay: result.grossPay.toString(),
    total_deductions: result.totalDeductions.toString(),
    net_pay: result.netPay.toString(),
  }));

  // Insert payslips into database
  const { error: payslipsError } = await supabase
    .from('payslips')
    .insert(payslips);

  if (payslipsError) throw payslipsError;

  // Mark individual allowances as applied
  if (payrollResults.some(r => Object.keys(r.individualAllowancesBreakdown).length > 0)) {
    const { error: allowanceUpdateError } = await supabase
      .from('staff_individual_allowances')
      .update({ 
        status: 'applied',
        payroll_run_id: payrollRunId,
        updated_at: new Date().toISOString(),
      })
      .eq('period', period)
      .eq('status', 'pending')
      .in('staff_id', payrollResults.map(r => r.staffId));

    if (allowanceUpdateError) console.error('Error updating individual allowances status:', allowanceUpdateError);
  }

  // Update remaining balances for loan deductions
  for (const result of payrollResults) {
    if (Object.keys(result.individualDeductionsBreakdown).length > 0) {
      // Update remaining balances for loan-type deductions
      const loanDeductions = Object.entries(result.individualDeductionsBreakdown)
        .filter(([type]) => type.includes('loan') || type.includes('advance'));

      for (const [type, amount] of loanDeductions) {
        const { error: balanceUpdateError } = await supabase
          .rpc('update_loan_balance', {
            p_staff_id: result.staffId,
            p_period: period,
            p_type: type,
            p_payment_amount: amount,
          });

        if (balanceUpdateError) {
          console.error('Error updating loan balance:', balanceUpdateError);
        }
      }
    }
  }

  // Update payroll run with totals
  const totalGross = payrollResults.reduce((sum, result) => sum + result.grossPay, 0);
  const totalDeductions = payrollResults.reduce((sum, result) => sum + result.totalDeductions, 0);
  const totalNet = payrollResults.reduce((sum, result) => sum + result.netPay, 0);

  const { error: updateError } = await supabase
    .from('payroll_runs')
    .update({
      total_staff: payrollResults.length,
      gross_amount: totalGross.toString(),
      total_deductions: totalDeductions.toString(),
      net_amount: totalNet.toString(),
      status: 'pending_review',
    })
    .eq('id', payrollRunId);

  if (updateError) throw updateError;
}
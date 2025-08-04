// CONJUSS (Consolidated Judicial Salary Structure) utilities for Nigerian Judicial Service

export interface SalaryStructure {
  gradeLevel: number;
  step: number;
  basicSalary: number;
  allowances: Allowances;
  deductions: Deductions;
}

export interface Allowances {
  housing: number;
  transport: number;
  medical: number;
  leave: number;
  responsibility: number;
  hazard: number;
  rural: number;
  entertainment: number;
}

export interface Deductions {
  paye: number;
  pension: number;
  nhf: number;
  insurance: number;
  union: number;
  loans: number;
  cooperatives: number;
}

export interface PayrollCalculation {
  basicSalary: number;
  totalAllowances: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  allowancesBreakdown: Allowances;
  deductionsBreakdown: Deductions;
}

// Standard CONJUSS allowance rates (as percentages of basic salary)
const ALLOWANCE_RATES = {
  housing: 0.20, // 20% of basic salary
  transport: 0.10, // 10% of basic salary
  medical: 0.05, // 5% of basic salary
  leave: 0.05, // 5% of basic salary
  responsibility: 0.15, // 15% of basic salary (varies by position)
  hazard: 0.10, // 10% of basic salary (for certain positions)
  rural: 0.10, // 10% of basic salary (for rural postings)
  entertainment: 0.05, // 5% of basic salary
};

// Standard deduction rates
const DEDUCTION_RATES = {
  paye: 0.075, // 7.5% (varies by income bracket)
  pension: 0.08, // 8% of gross pay
  nhf: 0.025, // 2.5% of basic salary
  insurance: 0.01, // 1% of gross pay
  union: 0.005, // 0.5% of basic salary
};

// Simplified CONJUSS salary scale (actual values may vary)
const SALARY_SCALE: Record<string, number> = {
  // Grade Level 1
  '1-1': 30000, '1-2': 31000, '1-3': 32000, '1-4': 33000, '1-5': 34000,
  '1-6': 35000, '1-7': 36000, '1-8': 37000, '1-9': 38000, '1-10': 39000,
  '1-11': 40000, '1-12': 41000, '1-13': 42000, '1-14': 43000, '1-15': 44000,
  
  // Grade Level 2
  '2-1': 35000, '2-2': 36500, '2-3': 38000, '2-4': 39500, '2-5': 41000,
  '2-6': 42500, '2-7': 44000, '2-8': 45500, '2-9': 47000, '2-10': 48500,
  '2-11': 50000, '2-12': 51500, '2-13': 53000, '2-14': 54500, '2-15': 56000,
  
  // Grade Level 3
  '3-1': 42000, '3-2': 44000, '3-3': 46000, '3-4': 48000, '3-5': 50000,
  '3-6': 52000, '3-7': 54000, '3-8': 56000, '3-9': 58000, '3-10': 60000,
  '3-11': 62000, '3-12': 64000, '3-13': 66000, '3-14': 68000, '3-15': 70000,
  
  // Continue pattern for higher grades...
  // This is a simplified version - actual CONJUSS scale would have all 17 grades
  
  // Grade Level 10 (Mid-level)
  '10-1': 120000, '10-2': 125000, '10-3': 130000, '10-4': 135000, '10-5': 140000,
  '10-6': 145000, '10-7': 150000, '10-8': 155000, '10-9': 160000, '10-10': 165000,
  '10-11': 170000, '10-12': 175000, '10-13': 180000, '10-14': 185000, '10-15': 190000,
  
  // Grade Level 15 (Senior level)
  '15-1': 250000, '15-2': 260000, '15-3': 270000, '15-4': 280000, '15-5': 290000,
  '15-6': 300000, '15-7': 310000, '15-8': 320000, '15-9': 330000, '15-10': 340000,
  '15-11': 350000, '15-12': 360000, '15-13': 370000, '15-14': 380000, '15-15': 390000,
  
  // Grade Level 17 (Top level)
  '17-1': 450000, '17-2': 470000, '17-3': 490000, '17-4': 510000, '17-5': 530000,
  '17-6': 550000, '17-7': 570000, '17-8': 590000, '17-9': 610000, '17-10': 630000,
  '17-11': 650000, '17-12': 670000, '17-13': 690000, '17-14': 710000, '17-15': 730000,
};

/**
 * Get basic salary for a specific grade level and step
 */
export function getBasicSalary(gradeLevel: number, step: number): number {
  const key = `${gradeLevel}-${step}`;
  return SALARY_SCALE[key] || 0;
}

/**
 * Calculate allowances based on basic salary and position
 */
export function calculateAllowances(
  basicSalary: number,
  gradeLevel: number,
  position?: string
): Allowances {
  // Adjust responsibility allowance based on grade level
  let responsibilityRate = ALLOWANCE_RATES.responsibility;
  if (gradeLevel >= 15) {
    responsibilityRate = 0.25; // Senior positions get higher responsibility allowance
  } else if (gradeLevel >= 10) {
    responsibilityRate = 0.20;
  }

  // Adjust hazard allowance based on position
  let hazardRate = 0;
  if (position?.toLowerCase().includes('field') || position?.toLowerCase().includes('rural')) {
    hazardRate = ALLOWANCE_RATES.hazard;
  }

  return {
    housing: basicSalary * ALLOWANCE_RATES.housing,
    transport: basicSalary * ALLOWANCE_RATES.transport,
    medical: basicSalary * ALLOWANCE_RATES.medical,
    leave: basicSalary * ALLOWANCE_RATES.leave,
    responsibility: basicSalary * responsibilityRate,
    hazard: basicSalary * hazardRate,
    rural: 0, // Applied only for rural postings
    entertainment: basicSalary * ALLOWANCE_RATES.entertainment,
  };
}

/**
 * Calculate PAYE tax based on Nigerian tax brackets
 */
export function calculatePAYE(grossPay: number): number {
  // Nigerian Personal Income Tax rates (simplified)
  // First ₦300,000 is tax-free
  // Next ₦300,000 is taxed at 7%
  // Next ₦500,000 is taxed at 11%
  // Next ₦500,000 is taxed at 15%
  // Next ₦1,600,000 is taxed at 19%
  // Above ₦3,200,000 is taxed at 21%

  const annualGross = grossPay * 12; // Convert to annual
  let tax = 0;

  if (annualGross > 300000) {
    if (annualGross <= 600000) {
      tax = (annualGross - 300000) * 0.07;
    } else if (annualGross <= 1100000) {
      tax = 300000 * 0.07 + (annualGross - 600000) * 0.11;
    } else if (annualGross <= 1600000) {
      tax = 300000 * 0.07 + 500000 * 0.11 + (annualGross - 1100000) * 0.15;
    } else if (annualGross <= 3200000) {
      tax = 300000 * 0.07 + 500000 * 0.11 + 500000 * 0.15 + (annualGross - 1600000) * 0.19;
    } else {
      tax = 300000 * 0.07 + 500000 * 0.11 + 500000 * 0.15 + 1600000 * 0.19 + (annualGross - 3200000) * 0.21;
    }
  }

  return tax / 12; // Convert back to monthly
}

/**
 * Calculate deductions based on gross pay and basic salary
 */
export function calculateDeductions(
  grossPay: number,
  basicSalary: number,
  loans: number = 0,
  cooperatives: number = 0
): Deductions {
  return {
    paye: calculatePAYE(grossPay),
    pension: grossPay * DEDUCTION_RATES.pension,
    nhf: basicSalary * DEDUCTION_RATES.nhf,
    insurance: grossPay * DEDUCTION_RATES.insurance,
    union: basicSalary * DEDUCTION_RATES.union,
    loans,
    cooperatives,
  };
}

/**
 * Calculate complete payroll for a staff member
 */
export function calculatePayroll(
  gradeLevel: number,
  step: number,
  position?: string,
  loans: number = 0,
  cooperatives: number = 0,
  arrears: number = 0,
  overtime: number = 0
): PayrollCalculation {
  const basicSalary = getBasicSalary(gradeLevel, step);
  const allowancesBreakdown = calculateAllowances(basicSalary, gradeLevel, position);
  
  const totalAllowances = Object.values(allowancesBreakdown).reduce((sum, amount) => sum + amount, 0);
  const grossPay = basicSalary + totalAllowances + arrears + overtime;
  
  const deductionsBreakdown = calculateDeductions(grossPay, basicSalary, loans, cooperatives);
  const totalDeductions = Object.values(deductionsBreakdown).reduce((sum, amount) => sum + amount, 0);
  
  const netPay = grossPay - totalDeductions;

  return {
    basicSalary,
    totalAllowances,
    grossPay,
    totalDeductions,
    netPay,
    allowancesBreakdown,
    deductionsBreakdown,
  };
}

/**
 * Get all salary grades and steps
 */
export function getAllSalaryGrades(): Array<{ gradeLevel: number; step: number; basicSalary: number }> {
  return Object.entries(SALARY_SCALE).map(([key, salary]) => {
    const [gradeLevel, step] = key.split('-').map(Number);
    return { gradeLevel, step, basicSalary: salary };
  });
}

/**
 * Get salary range for a specific grade level
 */
export function getSalaryRange(gradeLevel: number): { min: number; max: number } {
  const grades = getAllSalaryGrades().filter(g => g.gradeLevel === gradeLevel);
  if (grades.length === 0) return { min: 0, max: 0 };
  
  const salaries = grades.map(g => g.basicSalary);
  return {
    min: Math.min(...salaries),
    max: Math.max(...salaries),
  };
}

/**
 * Validate grade level and step combination
 */
export function isValidGradeStep(gradeLevel: number, step: number): boolean {
  return gradeLevel >= 1 && gradeLevel <= 17 && step >= 1 && step <= 15;
}

/**
 * Get next step progression for a staff member
 */
export function getNextStep(gradeLevel: number, currentStep: number): { gradeLevel: number; step: number } | null {
  if (currentStep < 15) {
    return { gradeLevel, step: currentStep + 1 };
  }
  
  // If at step 15, promotion to next grade level step 1
  if (gradeLevel < 17) {
    return { gradeLevel: gradeLevel + 1, step: 1 };
  }
  
  // Already at maximum
  return null;
}

/*
  # Create Individual Staff Allowances and Deductions Tables

  1. New Tables
    - `staff_individual_allowances`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, foreign key to staff)
      - `payroll_run_id` (uuid, foreign key to payroll_runs, optional)
      - `type` (text, e.g., 'overtime', 'bonus')
      - `amount` (decimal, the allowance amount)
      - `period` (text, payroll period)
      - `description` (text, optional)
      - `status` (text, 'pending', 'applied', 'cancelled')
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `staff_individual_deductions`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, foreign key to staff)
      - `payroll_run_id` (uuid, foreign key to payroll_runs, optional)
      - `type` (text, e.g., 'loan_repayment', 'fine')
      - `amount` (decimal, deduction amount for current period)
      - `total_amount` (decimal, total loan/advance amount)
      - `remaining_balance` (decimal, outstanding balance)
      - `period` (text, payroll period)
      - `start_period` (text, when deduction started)
      - `end_period` (text, when deduction should end)
      - `description` (text, optional)
      - `status` (text, 'active', 'paid_off', 'cancelled')
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for staff to view their own records
    - Add policies for admins to manage all records

  3. Functions
    - Create function to update loan balances after payments
*/

-- Staff individual allowances table (for overtime, bonuses, etc.)
CREATE TABLE IF NOT EXISTS staff_individual_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'overtime', 'bonus', 'commission', 'special_duty', etc.
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  period TEXT NOT NULL, -- '2025-01' format
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'applied', 'cancelled'
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff individual deductions table (for loans, advances, fines, etc.)
CREATE TABLE IF NOT EXISTS staff_individual_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'loan_repayment', 'salary_advance', 'fine', 'cooperative', etc.
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0), -- Amount for current period
  total_amount DECIMAL(15,2), -- Total loan/advance amount (for tracking)
  remaining_balance DECIMAL(15,2), -- Outstanding balance (for loans/advances)
  period TEXT NOT NULL, -- '2025-01' format
  start_period TEXT, -- When the deduction started
  end_period TEXT, -- When the deduction should end (optional)
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paid_off', 'cancelled'
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_individual_allowances_staff_id ON staff_individual_allowances(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_individual_allowances_period ON staff_individual_allowances(period);
CREATE INDEX IF NOT EXISTS idx_staff_individual_allowances_status ON staff_individual_allowances(status);
CREATE INDEX IF NOT EXISTS idx_staff_individual_deductions_staff_id ON staff_individual_deductions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_individual_deductions_period ON staff_individual_deductions(period);
CREATE INDEX IF NOT EXISTS idx_staff_individual_deductions_status ON staff_individual_deductions(status);

-- Enable Row Level Security
ALTER TABLE staff_individual_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_individual_deductions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_individual_allowances
CREATE POLICY "Individual allowances viewable by admins and staff owner"
  ON staff_individual_allowances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
    OR 
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_individual_allowances.staff_id 
      AND staff.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Payroll admins can manage individual allowances"
  ON staff_individual_allowances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'payroll_admin')
    )
  );

-- RLS Policies for staff_individual_deductions
CREATE POLICY "Individual deductions viewable by admins and staff owner"
  ON staff_individual_deductions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
    OR 
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_individual_deductions.staff_id 
      AND staff.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Payroll admins can manage individual deductions"
  ON staff_individual_deductions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'payroll_admin')
    )
  );

-- Function to update loan balances after payments
CREATE OR REPLACE FUNCTION update_loan_balance(
  p_staff_id UUID,
  p_period TEXT,
  p_type TEXT,
  p_payment_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE staff_individual_deductions
  SET 
    remaining_balance = GREATEST(0, remaining_balance - p_payment_amount),
    status = CASE 
      WHEN (remaining_balance - p_payment_amount) <= 0 THEN 'paid_off'
      ELSE status
    END,
    updated_at = NOW()
  WHERE staff_id = p_staff_id 
    AND period = p_period 
    AND type = p_type
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
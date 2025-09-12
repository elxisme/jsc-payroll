/*
  # Loan Management System with Cooperatives and Interest

  1. New Tables
    - `cooperative_organizations`
      - `id` (uuid, primary key)
      - `name` (text, unique name of cooperative)
      - `contact_person` (text, contact person name)
      - `phone_number` (text, contact phone)
      - `email` (text, contact email)
      - `address` (text, physical address)
      - `is_active` (boolean, whether cooperative is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `loans`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, foreign key to staff)
      - `cooperative_id` (uuid, foreign key to cooperative_organizations, nullable)
      - `loan_type` (text, type of loan)
      - `total_loan_amount` (decimal, original principal)
      - `interest_rate` (decimal, annual interest rate percentage)
      - `interest_calculation_method` (text, flat or reducing_balance)
      - `total_interest_charged` (decimal, total interest over loan term)
      - `monthly_principal_amount` (decimal, monthly principal payment)
      - `monthly_interest_amount` (decimal, monthly interest payment)
      - `monthly_total_deduction` (decimal, total monthly payment)
      - `number_of_installments` (integer, total installments)
      - `installments_paid` (integer, installments completed)
      - `start_date` (date, loan start date)
      - `end_date` (date, projected end date)
      - `remaining_balance` (decimal, current outstanding balance)
      - `status` (text, loan status)
      - `created_by` (uuid, foreign key to users)
      - `approved_by` (uuid, foreign key to users)
      - `approved_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Table Modifications
    - Add `loan_id` column to `staff_individual_deductions`
    - Add `is_loan_repayment` column to `staff_individual_deductions`

  3. Security
    - Enable RLS on new tables
    - Add policies for admin access
    - Audit trail for all loan operations

  4. Business Logic Functions
    - Automatic loan balance updates on deduction
    - Interest calculation functions
    - Loan schedule generation
    - Cooperative loan tracking
*/

-- Create cooperative organizations table
CREATE TABLE IF NOT EXISTS cooperative_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_person text,
  phone_number text,
  email text,
  address text,
  interest_rate_default decimal(5,2) DEFAULT 0.00, -- Default interest rate for this cooperative
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  cooperative_id uuid REFERENCES cooperative_organizations(id) ON DELETE SET NULL,
  loan_type text NOT NULL, -- 'salary_advance', 'cooperative_loan', 'personal_loan', 'emergency_loan'
  total_loan_amount decimal(15,2) NOT NULL CHECK (total_loan_amount > 0),
  interest_rate decimal(5,2) NOT NULL DEFAULT 0.00 CHECK (interest_rate >= 0),
  interest_calculation_method text NOT NULL DEFAULT 'flat', -- 'flat', 'reducing_balance'
  total_interest_charged decimal(15,2) NOT NULL DEFAULT 0.00,
  monthly_principal_amount decimal(15,2) NOT NULL CHECK (monthly_principal_amount > 0),
  monthly_interest_amount decimal(15,2) NOT NULL DEFAULT 0.00,
  monthly_total_deduction decimal(15,2) NOT NULL CHECK (monthly_total_deduction > 0),
  number_of_installments integer NOT NULL CHECK (number_of_installments > 0),
  installments_paid integer DEFAULT 0 CHECK (installments_paid >= 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  remaining_balance decimal(15,2) NOT NULL CHECK (remaining_balance >= 0),
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'paid_off', 'defaulted', 'cancelled'
  notes text,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Business logic constraints
  CONSTRAINT valid_loan_dates CHECK (end_date > start_date),
  CONSTRAINT valid_loan_status CHECK (status IN ('pending', 'active', 'paid_off', 'defaulted', 'cancelled')),
  CONSTRAINT valid_loan_type CHECK (loan_type IN ('salary_advance', 'cooperative_loan', 'personal_loan', 'emergency_loan')),
  CONSTRAINT valid_interest_method CHECK (interest_calculation_method IN ('flat', 'reducing_balance')),
  CONSTRAINT valid_installments_paid CHECK (installments_paid <= number_of_installments)
);

-- Add columns to staff_individual_deductions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_individual_deductions' AND column_name = 'loan_id'
  ) THEN
    ALTER TABLE staff_individual_deductions ADD COLUMN loan_id uuid REFERENCES loans(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_individual_deductions' AND column_name = 'is_loan_repayment'
  ) THEN
    ALTER TABLE staff_individual_deductions ADD COLUMN is_loan_repayment boolean DEFAULT false;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE cooperative_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cooperative_organizations
CREATE POLICY "Admins can view all cooperatives" ON cooperative_organizations
  FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage cooperatives" ON cooperative_organizations
  FOR ALL 
  USING (is_admin(auth.uid()));

-- RLS Policies for loans
CREATE POLICY "Admins can view all loans" ON loans
  FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view own loans" ON loans
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = loans.staff_id 
      AND staff.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage loans" ON loans
  FOR ALL 
  USING (is_admin(auth.uid()));

-- Function to calculate loan interest and schedule
CREATE OR REPLACE FUNCTION calculate_loan_schedule(
  p_principal decimal,
  p_interest_rate decimal,
  p_installments integer,
  p_method text DEFAULT 'flat'
)
RETURNS TABLE(
  monthly_principal decimal,
  monthly_interest decimal,
  monthly_total decimal,
  total_interest decimal
) AS $$
DECLARE
  monthly_rate decimal;
  principal_payment decimal;
  interest_payment decimal;
  total_interest_amount decimal;
BEGIN
  -- Convert annual rate to monthly rate
  monthly_rate := p_interest_rate / 100 / 12;
  
  IF p_method = 'flat' THEN
    -- Flat interest: Interest calculated on original principal for entire term
    total_interest_amount := p_principal * (p_interest_rate / 100) * (p_installments / 12.0);
    principal_payment := p_principal / p_installments;
    interest_payment := total_interest_amount / p_installments;
  ELSE
    -- Reducing balance: Interest calculated on outstanding balance
    IF monthly_rate = 0 THEN
      principal_payment := p_principal / p_installments;
      interest_payment := 0;
      total_interest_amount := 0;
    ELSE
      -- EMI calculation for reducing balance
      monthly_total := p_principal * (monthly_rate * POWER(1 + monthly_rate, p_installments)) / 
                     (POWER(1 + monthly_rate, p_installments) - 1);
      
      -- For reducing balance, we'll approximate the average interest
      total_interest_amount := (monthly_total * p_installments) - p_principal;
      principal_payment := p_principal / p_installments;
      interest_payment := total_interest_amount / p_installments;
    END IF;
  END IF;
  
  RETURN QUERY SELECT 
    principal_payment,
    interest_payment,
    principal_payment + interest_payment,
    total_interest_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update loan balance when deduction is applied
CREATE OR REPLACE FUNCTION update_loan_balance_on_deduction()
RETURNS trigger AS $$
DECLARE
  loan_record record;
BEGIN
  -- Only process if this is a loan repayment
  IF NEW.is_loan_repayment = true AND NEW.loan_id IS NOT NULL THEN
    -- Get current loan details
    SELECT * INTO loan_record FROM loans WHERE id = NEW.loan_id;
    
    IF FOUND THEN
      -- Update loan balance and installments
      UPDATE loans 
      SET 
        remaining_balance = GREATEST(0, remaining_balance - NEW.amount),
        installments_paid = installments_paid + 1,
        status = CASE 
          WHEN (remaining_balance - NEW.amount) <= 0 OR (installments_paid + 1) >= number_of_installments 
          THEN 'paid_off'
          ELSE status
        END,
        updated_at = now()
      WHERE id = NEW.loan_id;
      
      -- Log the payment in audit logs
      INSERT INTO audit_logs (
        user_id,
        action,
        resource,
        resource_id,
        old_values,
        new_values
      ) VALUES (
        auth.uid(),
        'loan_payment_applied',
        'loans',
        NEW.loan_id::text,
        jsonb_build_object(
          'remaining_balance', loan_record.remaining_balance,
          'installments_paid', loan_record.installments_paid
        ),
        jsonb_build_object(
          'payment_amount', NEW.amount,
          'new_remaining_balance', GREATEST(0, loan_record.remaining_balance - NEW.amount),
          'new_installments_paid', loan_record.installments_paid + 1
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for loan balance updates
DROP TRIGGER IF EXISTS trigger_update_loan_balance ON staff_individual_deductions;
CREATE TRIGGER trigger_update_loan_balance
  AFTER INSERT OR UPDATE ON staff_individual_deductions
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_balance_on_deduction();

-- Function to get loan repayment schedule
CREATE OR REPLACE FUNCTION get_loan_repayment_schedule(p_loan_id uuid)
RETURNS TABLE(
  installment_number integer,
  due_date date,
  principal_amount decimal,
  interest_amount decimal,
  total_amount decimal,
  remaining_balance decimal,
  is_paid boolean
) AS $$
DECLARE
  loan_record record;
  current_balance decimal;
  installment_date date;
  i integer;
BEGIN
  -- Get loan details
  SELECT * INTO loan_record FROM loans WHERE id = p_loan_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  current_balance := loan_record.total_loan_amount;
  installment_date := loan_record.start_date;
  
  -- Generate schedule for each installment
  FOR i IN 1..loan_record.number_of_installments LOOP
    -- Calculate due date (monthly intervals)
    installment_date := loan_record.start_date + (i - 1) * INTERVAL '1 month';
    
    RETURN QUERY SELECT 
      i,
      installment_date,
      loan_record.monthly_principal_amount,
      loan_record.monthly_interest_amount,
      loan_record.monthly_total_deduction,
      GREATEST(0, current_balance - loan_record.monthly_principal_amount),
      i <= loan_record.installments_paid;
    
    current_balance := GREATEST(0, current_balance - loan_record.monthly_principal_amount);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get staff grade changes in period (updated for loan management)
CREATE OR REPLACE FUNCTION get_staff_grade_changes_in_period(
  p_staff_id uuid,
  period_date text
)
RETURNS TABLE(
  grade_level integer,
  step integer,
  days_in_period integer
) AS $$
DECLARE
  period_start date;
  period_end date;
  promotion_record record;
  current_date date;
  next_date date;
  current_grade integer;
  current_step integer;
BEGIN
  -- Parse period (YYYY-MM format) to get start and end dates
  period_start := (period_date || '-01')::date;
  period_end := (period_start + INTERVAL '1 month - 1 day')::date;
  
  -- Get initial grade/step at start of period
  SELECT s.grade_level, s.step INTO current_grade, current_step
  FROM staff s
  WHERE s.id = p_staff_id;
  
  current_date := period_start;
  
  -- Check for any promotions that became effective during this period
  FOR promotion_record IN
    SELECT effective_date, new_grade_level, new_step
    FROM promotions
    WHERE staff_id = p_staff_id
    AND effective_date BETWEEN period_start AND period_end
    AND approved_at IS NOT NULL
    ORDER BY effective_date
  LOOP
    -- Return the current grade for days before this promotion
    IF promotion_record.effective_date > current_date THEN
      RETURN QUERY SELECT 
        current_grade,
        current_step,
        (promotion_record.effective_date - current_date)::integer;
    END IF;
    
    -- Update to new grade/step
    current_grade := promotion_record.new_grade_level;
    current_step := promotion_record.new_step;
    current_date := promotion_record.effective_date;
  END LOOP;
  
  -- Return remaining days in period with final grade/step
  IF current_date <= period_end THEN
    RETURN QUERY SELECT 
      current_grade,
      current_step,
      (period_end - current_date + 1)::integer;
  END IF;
  
  -- If no promotions in period, return full month with current grade/step
  IF NOT EXISTS (
    SELECT 1 FROM promotions
    WHERE staff_id = p_staff_id
    AND effective_date BETWEEN period_start AND period_end
    AND approved_at IS NOT NULL
  ) THEN
    RETURN QUERY SELECT 
      current_grade,
      current_step,
      EXTRACT(DAY FROM period_end)::integer;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample cooperative organizations
INSERT INTO cooperative_organizations (name, contact_person, phone_number, email, address, interest_rate_default, is_active) VALUES
('JSC Staff Cooperative Society', 'Mrs. Adunni Olatunji', '08012345678', 'info@jsccooperative.org', 'Plot 123, Central Business District, Abuja', 12.00, true),
('Federal Judiciary Multipurpose Cooperative', 'Mr. Emeka Okonkwo', '08087654321', 'admin@fjmcoop.ng', 'No. 45, Judicial Complex, Lagos', 15.00, true),
('Court Workers Thrift and Credit Society', 'Dr. Fatima Abdullahi', '08098765432', 'secretary@cwtcs.gov.ng', 'Suite 12, Federal Secretariat, Abuja', 10.00, true),
('Nigerian Judicial Staff Credit Union', 'Barr. Chinedu Okoro', '08076543210', 'info@njscu.org', 'Block C, Judiciary Quarters, Port Harcourt', 18.00, true),
('Supreme Court Staff Cooperative', 'Mrs. Blessing Adebayo', '08065432109', 'contact@scstaffcoop.ng', 'Supreme Court Complex, Three Arms Zone, Abuja', 8.00, true)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loans_staff_id ON loans(staff_id);
CREATE INDEX IF NOT EXISTS idx_loans_cooperative_id ON loans(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_start_date ON loans(start_date);
CREATE INDEX IF NOT EXISTS idx_loans_end_date ON loans(end_date);
CREATE INDEX IF NOT EXISTS idx_staff_individual_deductions_loan_id ON staff_individual_deductions(loan_id);
CREATE INDEX IF NOT EXISTS idx_staff_individual_deductions_is_loan ON staff_individual_deductions(is_loan_repayment);
CREATE INDEX IF NOT EXISTS idx_cooperative_organizations_active ON cooperative_organizations(is_active);

-- Add comments for documentation
COMMENT ON TABLE cooperative_organizations IS 'Manages cooperative organizations that provide loans to staff';
COMMENT ON TABLE loans IS 'Tracks all loans with interest calculations and repayment schedules';
COMMENT ON FUNCTION calculate_loan_schedule(decimal, decimal, integer, text) IS 'Calculates loan repayment schedule with interest';
COMMENT ON FUNCTION get_loan_repayment_schedule(uuid) IS 'Returns detailed repayment schedule for a specific loan';
COMMENT ON FUNCTION update_loan_balance_on_deduction() IS 'Automatically updates loan balance when deduction is applied';
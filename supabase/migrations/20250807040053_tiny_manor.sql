/*
  # Leave Management System Tables

  1. New Tables
    - `leave_types`
      - `id` (uuid, primary key)
      - `name` (text, leave type name)
      - `code` (text, unique code)
      - `description` (text, optional description)
      - `is_paid` (boolean, whether leave is paid)
      - `max_days_per_year` (integer, maximum days allowed per year)
      - `accrual_rate` (decimal, days accrued per month)
      - `requires_approval` (boolean, whether approval is needed)
      - `is_active` (boolean, whether leave type is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `leave_requests`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, foreign key to staff)
      - `leave_type_id` (uuid, foreign key to leave_types)
      - `start_date` (date, leave start date)
      - `end_date` (date, leave end date)
      - `total_days` (integer, calculated working days)
      - `reason` (text, reason for leave)
      - `status` (text, pending/approved/rejected/cancelled)
      - `requested_by` (uuid, foreign key to users)
      - `approved_by` (uuid, foreign key to users)
      - `approval_comments` (text, optional comments)
      - `approved_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `staff_leave_balances`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, foreign key to staff)
      - `leave_type_id` (uuid, foreign key to leave_types)
      - `year` (integer, calendar year)
      - `accrued_days` (decimal, total days accrued)
      - `used_days` (decimal, total days used)
      - `remaining_days` (decimal, remaining balance)
      - `carried_forward` (decimal, days carried from previous year)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for role-based access control
    - Staff can view their own leave data
    - Admins can manage all leave data

  3. Sample Data
    - Standard Nigerian government leave types
    - Initial leave balances for existing staff
*/

-- Leave Types table
CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_paid boolean NOT NULL DEFAULT true,
  max_days_per_year integer NOT NULL DEFAULT 30,
  accrual_rate decimal(5,2) NOT NULL DEFAULT 2.5, -- Days per month
  requires_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Leave Requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days integer NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
  requested_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approval_comments text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- Staff Leave Balances table
CREATE TABLE IF NOT EXISTS staff_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id),
  year integer NOT NULL,
  accrued_days decimal(5,2) NOT NULL DEFAULT 0,
  used_days decimal(5,2) NOT NULL DEFAULT 0,
  remaining_days decimal(5,2) NOT NULL DEFAULT 0,
  carried_forward decimal(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, leave_type_id, year)
);

-- Enable Row Level Security
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_types
CREATE POLICY "Leave types viewable by all authenticated users" ON leave_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage leave types" ON leave_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'payroll_admin')
    )
  );

-- RLS Policies for leave_requests
CREATE POLICY "Staff can view own leave requests" ON leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = leave_requests.staff_id 
      AND staff.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
  );

CREATE POLICY "Staff can insert own leave requests" ON leave_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = leave_requests.staff_id 
      AND staff.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own pending requests" ON leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = leave_requests.staff_id 
      AND staff.user_id = auth.uid()
    )
    AND status = 'pending'
  );

CREATE POLICY "Admins can manage all leave requests" ON leave_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
  );

-- RLS Policies for staff_leave_balances
CREATE POLICY "Staff can view own leave balances" ON staff_leave_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_leave_balances.staff_id 
      AND staff.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
  );

CREATE POLICY "Admins can manage leave balances" ON staff_leave_balances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'payroll_admin')
    )
  );

-- Insert standard Nigerian government leave types
INSERT INTO leave_types (name, code, description, is_paid, max_days_per_year, accrual_rate, requires_approval) VALUES
('Annual Leave', 'ANNUAL', 'Annual vacation leave', true, 30, 2.5, true),
('Sick Leave', 'SICK', 'Medical leave for illness', true, 15, 1.25, false),
('Maternity Leave', 'MATERNITY', 'Maternity leave for female staff', true, 90, 0, true),
('Paternity Leave', 'PATERNITY', 'Paternity leave for male staff', true, 10, 0, true),
('Study Leave', 'STUDY', 'Educational/training leave', true, 365, 0, true),
('Compassionate Leave', 'COMPASSIONATE', 'Leave for family emergencies', true, 7, 0, true),
('Unpaid Leave', 'UNPAID', 'Leave without pay', false, 90, 0, true),
('Casual Leave', 'CASUAL', 'Short-term personal leave', true, 12, 1.0, false),
('Examination Leave', 'EXAM', 'Leave for examinations', true, 5, 0, true),
('Pilgrimage Leave', 'PILGRIMAGE', 'Religious pilgrimage leave', true, 30, 0, true);

-- Function to calculate working days between two dates (excluding weekends)
CREATE OR REPLACE FUNCTION calculate_working_days(start_date date, end_date date)
RETURNS integer AS $$
DECLARE
  total_days integer;
  weekend_days integer;
BEGIN
  total_days := end_date - start_date + 1;
  
  -- Calculate weekend days (Saturday and Sunday)
  weekend_days := (
    SELECT COUNT(*)
    FROM generate_series(start_date, end_date, '1 day'::interval) AS day
    WHERE EXTRACT(dow FROM day) IN (0, 6) -- 0 = Sunday, 6 = Saturday
  );
  
  RETURN total_days - weekend_days;
END;
$$ LANGUAGE plpgsql;

-- Function to update leave balance after leave request approval
CREATE OR REPLACE FUNCTION update_leave_balance_on_approval()
RETURNS trigger AS $$
BEGIN
  -- Only process if status changed to approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Update or insert leave balance
    INSERT INTO staff_leave_balances (staff_id, leave_type_id, year, used_days, remaining_days)
    VALUES (
      NEW.staff_id,
      NEW.leave_type_id,
      EXTRACT(year FROM NEW.start_date)::integer,
      NEW.total_days,
      0 -- Will be calculated by trigger
    )
    ON CONFLICT (staff_id, leave_type_id, year)
    DO UPDATE SET
      used_days = staff_leave_balances.used_days + NEW.total_days,
      remaining_days = staff_leave_balances.accrued_days + staff_leave_balances.carried_forward - (staff_leave_balances.used_days + NEW.total_days),
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leave balances when leave is approved
CREATE TRIGGER update_leave_balance_trigger
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_approval();

-- Function to initialize leave balances for new staff
CREATE OR REPLACE FUNCTION initialize_staff_leave_balances(staff_id_param uuid)
RETURNS void AS $$
DECLARE
  leave_type_record record;
  current_year integer := EXTRACT(year FROM CURRENT_DATE);
BEGIN
  FOR leave_type_record IN 
    SELECT id, accrual_rate FROM leave_types WHERE is_active = true
  LOOP
    INSERT INTO staff_leave_balances (staff_id, leave_type_id, year, accrued_days, remaining_days)
    VALUES (
      staff_id_param,
      leave_type_record.id,
      current_year,
      leave_type_record.accrual_rate * EXTRACT(month FROM CURRENT_DATE), -- Pro-rated for current year
      leave_type_record.accrual_rate * EXTRACT(month FROM CURRENT_DATE)
    )
    ON CONFLICT (staff_id, leave_type_id, year) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to accrue monthly leave balances (to be called monthly)
CREATE OR REPLACE FUNCTION accrue_monthly_leave()
RETURNS void AS $$
DECLARE
  staff_record record;
  leave_type_record record;
  current_year integer := EXTRACT(year FROM CURRENT_DATE);
BEGIN
  FOR staff_record IN 
    SELECT id FROM staff WHERE status = 'active'
  LOOP
    FOR leave_type_record IN 
      SELECT id, accrual_rate FROM leave_types WHERE is_active = true AND accrual_rate > 0
    LOOP
      INSERT INTO staff_leave_balances (staff_id, leave_type_id, year, accrued_days, remaining_days)
      VALUES (
        staff_record.id,
        leave_type_record.id,
        current_year,
        leave_type_record.accrual_rate,
        leave_type_record.accrual_rate
      )
      ON CONFLICT (staff_id, leave_type_id, year)
      DO UPDATE SET
        accrued_days = staff_leave_balances.accrued_days + leave_type_record.accrual_rate,
        remaining_days = staff_leave_balances.accrued_days + leave_type_record.accrual_rate + staff_leave_balances.carried_forward - staff_leave_balances.used_days,
        updated_at = now();
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_staff_year ON staff_leave_balances(staff_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_type ON staff_leave_balances(leave_type_id);
/*
  # Payroll Validation and Reopen Functions

  1. New Functions
    - `check_payroll_exists_for_period` - Check if processed payroll exists for period/department
    - `get_processed_staff_for_period` - Get staff already processed in finalized payrolls
    - `can_reopen_payroll` - Validate if payroll can be reopened
    - `update_loan_balance` - Update loan deduction balances

  2. Security
    - Functions are SECURITY DEFINER to allow proper access control
    - Audit logging for payroll reopening actions
    - Validation to prevent duplicate processing

  3. Business Logic
    - Prevent duplicate payroll runs for same period/department
    - Track staff already processed to prevent double payments
    - Allow Super Admin to reopen processed payrolls
*/

-- Function to check if a processed payroll exists for a given period and department
CREATE OR REPLACE FUNCTION check_payroll_exists_for_period(
  p_period text,
  p_department_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM payroll_runs
    WHERE period = p_period
    AND (
      (p_department_id IS NULL AND department_id IS NULL) OR
      (department_id = p_department_id)
    )
    AND status = 'processed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get staff already processed in finalized payrolls for a period
CREATE OR REPLACE FUNCTION get_processed_staff_for_period(p_period text)
RETURNS TABLE(staff_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.staff_id
  FROM payslips p
  INNER JOIN payroll_runs pr ON p.payroll_run_id = pr.id
  WHERE p.period = p_period
  AND pr.status = 'processed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate if a payroll can be reopened
CREATE OR REPLACE FUNCTION can_reopen_payroll(
  p_payroll_run_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  user_role text;
  payroll_status text;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM users WHERE id = p_user_id;
  
  -- Get payroll status
  SELECT status INTO payroll_status FROM payroll_runs WHERE id = p_payroll_run_id;
  
  -- Only super admin can reopen processed payrolls
  IF user_role = 'super_admin' AND payroll_status = 'processed' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update loan deduction balances
CREATE OR REPLACE FUNCTION update_loan_balance(
  p_staff_id uuid,
  p_period text,
  p_type text,
  p_payment_amount decimal
)
RETURNS void AS $$
BEGIN
  UPDATE staff_individual_deductions
  SET 
    remaining_balance = GREATEST(0, COALESCE(remaining_balance, total_amount) - p_payment_amount),
    status = CASE 
      WHEN GREATEST(0, COALESCE(remaining_balance, total_amount) - p_payment_amount) <= 0 THEN 'paid_off'
      ELSE status
    END,
    updated_at = now()
  WHERE staff_id = p_staff_id
  AND period = p_period
  AND type = p_type
  AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate payroll run creation
CREATE OR REPLACE FUNCTION validate_payroll_run_creation()
RETURNS trigger AS $$
DECLARE
  existing_processed_count integer;
BEGIN
  -- Check if there's already a processed payroll for this period and department
  SELECT COUNT(*) INTO existing_processed_count
  FROM payroll_runs
  WHERE period = NEW.period
  AND (
    (NEW.department_id IS NULL AND department_id IS NULL) OR
    (department_id = NEW.department_id)
  )
  AND status = 'processed'
  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF existing_processed_count > 0 THEN
    RAISE EXCEPTION 'Payroll for period % and department is already finalized. Please reopen to make changes.', NEW.period;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate payroll run creation
DROP TRIGGER IF EXISTS validate_payroll_creation_trigger ON payroll_runs;
CREATE TRIGGER validate_payroll_creation_trigger
  BEFORE INSERT ON payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION validate_payroll_run_creation();

-- Function to log payroll reopening
CREATE OR REPLACE FUNCTION log_payroll_reopen()
RETURNS trigger AS $$
BEGIN
  -- Log when a processed payroll is reopened
  IF OLD.status = 'processed' AND NEW.status != 'processed' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource,
      resource_id,
      old_values,
      new_values
    ) VALUES (
      auth.uid(),
      'payroll_reopened',
      'payroll_runs',
      NEW.id::text,
      jsonb_build_object(
        'status', OLD.status,
        'processed_at', OLD.processed_at,
        'period', OLD.period,
        'department_id', OLD.department_id
      ),
      jsonb_build_object(
        'status', NEW.status,
        'processed_at', NEW.processed_at,
        'reopened_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payroll reopening audit
DROP TRIGGER IF EXISTS payroll_reopen_audit_trigger ON payroll_runs;
CREATE TRIGGER payroll_reopen_audit_trigger
  AFTER UPDATE ON payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION log_payroll_reopen();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period_dept_status ON payroll_runs(period, department_id, status);
CREATE INDEX IF NOT EXISTS idx_payslips_period_staff ON payslips(period, staff_id);

-- Add comments for documentation
COMMENT ON FUNCTION check_payroll_exists_for_period(text, uuid) IS 'Checks if a processed payroll exists for the given period and department';
COMMENT ON FUNCTION get_processed_staff_for_period(text) IS 'Returns staff IDs that have been processed in finalized payrolls for the given period';
COMMENT ON FUNCTION can_reopen_payroll(uuid, uuid) IS 'Validates if a user can reopen a specific payroll run';
COMMENT ON FUNCTION update_loan_balance(uuid, text, text, decimal) IS 'Updates loan deduction balances after payment processing';
COMMENT ON FUNCTION validate_payroll_run_creation() IS 'Prevents creation of duplicate payroll runs for processed periods';
COMMENT ON FUNCTION log_payroll_reopen() IS 'Logs payroll reopening actions for audit trail';
/*
  # Payroll Lock/Unlock Security Policies

  1. Security Updates
    - Prevent modification of processed payroll runs
    - Lock payslips once payroll is processed
    - Audit trail protection for processed payrolls
    - Super admin override capabilities

  2. Database Functions
    - Function to check if payroll is locked
    - Function to validate payroll modifications
    - Enhanced audit logging for locked payrolls

  3. RLS Policy Updates
    - Restrict updates to processed payroll runs
    - Protect payslips from modification after processing
    - Maintain data integrity for historical records
*/

-- Function to check if a payroll run is locked (processed)
CREATE OR REPLACE FUNCTION is_payroll_locked(payroll_run_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT status = 'processed' 
    FROM payroll_runs 
    WHERE id = payroll_run_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate payroll modifications
CREATE OR REPLACE FUNCTION can_modify_payroll(payroll_run_id uuid, user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role text;
  payroll_status text;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = user_id;
  SELECT status INTO payroll_status FROM payroll_runs WHERE id = payroll_run_id;
  
  -- Super admin can always modify (emergency override)
  IF user_role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- No one else can modify processed payrolls
  IF payroll_status = 'processed' THEN
    RETURN false;
  END IF;
  
  -- Regular admin rules apply for non-processed payrolls
  RETURN user_role IN ('account_admin', 'payroll_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced audit logging for payroll modifications
CREATE OR REPLACE FUNCTION log_payroll_modification()
RETURNS trigger AS $$
BEGIN
  -- Log any attempt to modify a processed payroll
  IF OLD.status = 'processed' AND NEW.status != OLD.status THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource,
      resource_id,
      old_values,
      new_values,
      ip_address,
      user_agent
    ) VALUES (
      auth.uid(),
      'payroll_unlock_attempt',
      'payroll_runs',
      NEW.id::text,
      to_jsonb(OLD),
      to_jsonb(NEW),
      inet_client_addr()::text,
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payroll modification logging
DROP TRIGGER IF EXISTS payroll_modification_audit_trigger ON payroll_runs;
CREATE TRIGGER payroll_modification_audit_trigger
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION log_payroll_modification();

-- Update RLS policies for enhanced payroll locking
DROP POLICY IF EXISTS "Payroll admins can update non-processed payroll runs" ON payroll_runs;
DROP POLICY IF EXISTS "Only super admin can delete payroll runs" ON payroll_runs;
DROP POLICY IF EXISTS "Payroll admins can manage non-processed payroll runs" ON payroll_runs;

-- New granular policies for payroll locking
CREATE POLICY "Payroll admins can update unlocked payroll runs" ON payroll_runs
  FOR UPDATE 
  USING (can_modify_payroll(id, auth.uid()));

CREATE POLICY "Super admin can delete any payroll run" ON payroll_runs
  FOR DELETE 
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Admins cannot delete processed payroll runs" ON payroll_runs
  FOR DELETE 
  USING (
    get_user_role(auth.uid()) IN ('account_admin', 'payroll_admin')
    AND status != 'processed'
  );

-- Protect payslips from modification once payroll is processed
DROP POLICY IF EXISTS "Payroll admins can manage payslips" ON payslips;

CREATE POLICY "Payroll admins can insert payslips" ON payslips
  FOR INSERT 
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));

CREATE POLICY "Payroll admins can update payslips for unlocked payrolls" ON payslips
  FOR UPDATE 
  USING (
    get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin')
    AND NOT is_payroll_locked(payroll_run_id)
  );

CREATE POLICY "Super admin can delete any payslip" ON payslips
  FOR DELETE 
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payslips_payroll_run_id ON payslips(payroll_run_id);

-- Add comments for documentation
COMMENT ON FUNCTION is_payroll_locked(uuid) IS 'Checks if a payroll run is locked (status = processed)';
COMMENT ON FUNCTION can_modify_payroll(uuid, uuid) IS 'Validates if a user can modify a specific payroll run';
COMMENT ON FUNCTION log_payroll_modification() IS 'Logs attempts to modify processed payroll runs for audit trail';
-- Updated Row Level Security (RLS) Policies for JSC Payroll Management System
-- Run this after the main schema to update/fix RLS policies

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own record" ON users;
DROP POLICY IF EXISTS "Staff can view all records" ON staff;
DROP POLICY IF EXISTS "Departments viewable by all authenticated users" ON departments;
DROP POLICY IF EXISTS "Payslips viewable by admins and own payslips" ON payslips;
DROP POLICY IF EXISTS "Payroll runs viewable by admins" ON payroll_runs;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Audit logs viewable by super admins" ON audit_logs;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_id) IN ('super_admin', 'account_admin', 'payroll_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table policies
CREATE POLICY "Users can view own record" ON users
  FOR SELECT 
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE 
  USING (is_admin(auth.uid()));

-- Staff table policies
CREATE POLICY "Staff records viewable by admins and self" ON staff
  FOR SELECT 
  USING (
    is_admin(auth.uid()) 
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can insert staff" ON staff
  FOR INSERT 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update staff" ON staff
  FOR UPDATE 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete staff" ON staff
  FOR DELETE 
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Departments table policies
CREATE POLICY "Departments viewable by authenticated users" ON departments
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL 
  USING (is_admin(auth.uid()));

-- Salary structure policies
CREATE POLICY "Salary structure viewable by all authenticated" ON salary_structure
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only super admin can modify salary structure" ON salary_structure
  FOR ALL 
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Allowances table policies
CREATE POLICY "Allowances viewable by all authenticated" ON allowances
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage allowances" ON allowances
  FOR ALL 
  USING (is_admin(auth.uid()));

-- Deductions table policies
CREATE POLICY "Deductions viewable by all authenticated" ON deductions
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage deductions" ON deductions
  FOR ALL 
  USING (is_admin(auth.uid()));

-- Payroll runs policies
CREATE POLICY "Payroll runs viewable by admins" ON payroll_runs
  FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Payroll admins can manage payroll runs" ON payroll_runs
  FOR ALL 
  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));

-- Payslips table policies
CREATE POLICY "Payslips viewable by admins and staff owner" ON payslips
  FOR SELECT 
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = payslips.staff_id 
      AND staff.user_id = auth.uid()
    )
  );

CREATE POLICY "Payroll admins can manage payslips" ON payslips
  FOR ALL 
  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));

-- Notifications table policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications" ON notifications
  FOR INSERT 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete notifications" ON notifications
  FOR DELETE 
  USING (is_admin(auth.uid()));

-- Audit logs table policies
CREATE POLICY "Audit logs viewable by super admins only" ON audit_logs
  FOR SELECT 
  USING (get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT 
  WITH CHECK (true); -- Allow system to log all actions

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
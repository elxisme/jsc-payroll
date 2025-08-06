@@ .. @@
 CREATE INDEX idx_payroll_runs_period ON payroll_runs(period);
 CREATE INDEX idx_notifications_user_id ON notifications(user_id);
 CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
+CREATE INDEX idx_staff_individual_allowances_staff_id ON staff_individual_allowances(staff_id);
+CREATE INDEX idx_staff_individual_allowances_period ON staff_individual_allowances(period);
+CREATE INDEX idx_staff_individual_deductions_staff_id ON staff_individual_deductions(staff_id);
+CREATE INDEX idx_staff_individual_deductions_period ON staff_individual_deductions(period);
 
 -- Row Level Security (RLS) Policies
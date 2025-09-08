@@ .. @@
 -- Payroll runs policies
 CREATE POLICY "Payroll runs viewable by admins" ON payroll_runs
   FOR SELECT 
   USING (is_admin(auth.uid()));
 
-CREATE POLICY "Payroll admins can manage payroll runs" ON payroll_runs
+CREATE POLICY "Payroll admins can insert payroll runs" ON payroll_runs
+  FOR INSERT 
+  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));
+
+CREATE POLICY "Payroll admins can update non-processed payroll runs" ON payroll_runs
+  FOR UPDATE 
+  USING (
+    get_user_role(auth.uid()) IN ('super_admin', 'account_admin', 'payroll_admin')
+    AND status != 'processed'
+  );
+
+CREATE POLICY "Only super admin can delete payroll runs" ON payroll_runs
+  FOR DELETE 
+  USING (
+    get_user_role(auth.uid()) = 'super_admin'
+    AND status != 'processed'
+  );
+
+-- Legacy policy for backward compatibility (remove this if not needed)
+CREATE POLICY "Payroll admins can manage non-processed payroll runs" ON payroll_runs
   FOR ALL 
-  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));
+  USING (
+    get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin')
+    AND (status != 'processed' OR current_setting('role') = 'super_admin')
+  );
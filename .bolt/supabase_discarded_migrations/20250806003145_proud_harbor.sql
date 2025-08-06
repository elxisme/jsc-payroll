@@ .. @@
 CREATE POLICY "System can insert audit logs" ON audit_logs
   FOR INSERT 
   WITH CHECK (true); -- Allow system to log all actions
 
+-- Staff individual allowances policies
+CREATE POLICY "Individual allowances viewable by admins and staff owner" ON staff_individual_allowances
+  FOR SELECT 
+  USING (
+    is_admin(auth.uid())
+    OR EXISTS (
+      SELECT 1 FROM staff 
+      WHERE staff.id = staff_individual_allowances.staff_id 
+      AND staff.user_id = auth.uid()
+    )
+  );
+
+CREATE POLICY "Payroll admins can manage individual allowances" ON staff_individual_allowances
+  FOR ALL 
+  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));
+
+-- Staff individual deductions policies
+CREATE POLICY "Individual deductions viewable by admins and staff owner" ON staff_individual_deductions
+  FOR SELECT 
+  USING (
+    is_admin(auth.uid())
+    OR EXISTS (
+      SELECT 1 FROM staff 
+      WHERE staff.id = staff_individual_deductions.staff_id 
+      AND staff.user_id = auth.uid()
+    )
+  );
+
+CREATE POLICY "Payroll admins can manage individual deductions" ON staff_individual_deductions
+  FOR ALL 
+  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));
+
 -- Grant necessary permissions
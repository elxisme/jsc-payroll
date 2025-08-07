 CREATE POLICY "System can insert audit logs" ON audit_logs
   FOR INSERT 
   WITH CHECK (true); -- Allow system to log all actions
+
+-- Leave Types table policies
+CREATE POLICY "Leave types viewable by all authenticated users" ON leave_types
+  FOR SELECT 
+  USING (auth.uid() IS NOT NULL);
+
+CREATE POLICY "Admins can manage leave types" ON leave_types
+  FOR ALL 
+  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));
+
+-- Leave Requests table policies
+CREATE POLICY "Staff can view own leave requests" ON leave_requests
+  FOR SELECT 
+  USING (
+    EXISTS (
+      SELECT 1 FROM staff 
+      WHERE staff.id = leave_requests.staff_id 
+      AND staff.user_id = auth.uid()
+    )
+    OR is_admin(auth.uid())
+  );
+
+CREATE POLICY "Staff can insert own leave requests" ON leave_requests
+  FOR INSERT 
+  WITH CHECK (
+    EXISTS (
+      SELECT 1 FROM staff 
+      WHERE staff.id = leave_requests.staff_id 
+      AND staff.user_id = auth.uid()
+    )
+  );
+
+CREATE POLICY "Staff can update own pending requests" ON leave_requests
+  FOR UPDATE 
+  USING (
+    EXISTS (
+      SELECT 1 FROM staff 
+      WHERE staff.id = leave_requests.staff_id 
+      AND staff.user_id = auth.uid()
+    )
+    AND status = 'pending'
+  );
+
+CREATE POLICY "Admins can manage all leave requests" ON leave_requests
+  FOR ALL 
+  USING (is_admin(auth.uid()));
+
+-- Staff Leave Balances table policies
+CREATE POLICY "Staff can view own leave balances" ON staff_leave_balances
+  FOR SELECT 
+  USING (
+    EXISTS (
+      SELECT 1 FROM staff 
+      WHERE staff.id = staff_leave_balances.staff_id 
+      AND staff.user_id = auth.uid()
+    )
+    OR is_admin(auth.uid())
+  );
+
+CREATE POLICY "Admins can manage leave balances" ON staff_leave_balances
+  FOR ALL 
+  USING (get_user_role(auth.uid()) IN ('super_admin', 'payroll_admin'));
 
 -- Grant necessary permissions
 GRANT USAGE ON SCHEMA public TO authenticated;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
 GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
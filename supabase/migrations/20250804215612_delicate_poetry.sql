@@ .. @@
 CREATE POLICY "Admins can update users" ON users
   FOR UPDATE 
   USING (is_admin(auth.uid()));

+-- Allow users to insert their own record during registration
+CREATE POLICY "Allow self-registration insert" ON users
+  FOR INSERT 
+  WITH CHECK (auth.uid() = id);
+
 -- Staff table policies
 CREATE POLICY "Staff records viewable by admins and self" ON staff
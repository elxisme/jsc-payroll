 -- Helper function to get user role
-CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
+CREATE OR REPLACE FUNCTION get_user_role(auth_user_id UUID)
 RETURNS TEXT AS $$
+DECLARE
+  user_email TEXT;
+  user_role TEXT;
 BEGIN
-  RETURN (SELECT role FROM users WHERE id = user_id);
+  -- Get email from auth.users using the auth user ID
+  SELECT email INTO user_email FROM auth.users WHERE id = auth_user_id;
+  
+  -- If no email found, return null
+  IF user_email IS NULL THEN
+    RETURN NULL;
+  END IF;
+  
+  -- Get role from public.users using the email
+  SELECT role INTO user_role FROM public.users WHERE email = user_email;
+  
+  RETURN user_role;
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;
 
 -- Helper function to check if user is admin
-CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
+CREATE OR REPLACE FUNCTION is_admin(auth_user_id UUID)
 RETURNS BOOLEAN AS $$
 BEGIN
-  RETURN get_user_role(user_id) IN ('super_admin', 'account_admin', 'payroll_admin');
+  RETURN get_user_role(auth_user_id) IN ('super_admin', 'account_admin', 'payroll_admin');
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;
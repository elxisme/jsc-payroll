-- Allow admins to update any user
CREATE POLICY "Admins can update users"
ON users
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow users to insert their own record (e.g., during registration)
CREATE POLICY "Allow self-registration insert"
ON users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Staff table policies

-- Allow admins and the staff member themselves to view a staff record
CREATE POLICY "Staff records viewable by admins and self"
ON staff
FOR SELECT
USING (
  is_admin(auth.uid()) OR auth.uid() = staff.id  -- Adjust this to match your schema
);

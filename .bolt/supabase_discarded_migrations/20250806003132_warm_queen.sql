@@ .. @@
 -- Audit logs table
 CREATE TABLE audit_logs (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id UUID REFERENCES users(id),
   action TEXT NOT NULL,
   resource TEXT NOT NULL,
   resource_id TEXT,
   old_values JSONB,
   new_values JSONB,
   ip_address TEXT,
   user_agent TEXT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 );
 
+-- Staff individual allowances table (for overtime, bonuses, etc.)
+CREATE TABLE staff_individual_allowances (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
+  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
+  type TEXT NOT NULL, -- 'overtime', 'bonus', 'commission', 'special_duty', etc.
+  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
+  period TEXT NOT NULL, -- '2025-01' format
+  description TEXT,
+  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'applied', 'cancelled'
+  created_by UUID REFERENCES users(id),
+  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
+  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
+);
+
+-- Staff individual deductions table (for loans, advances, fines, etc.)
+CREATE TABLE staff_individual_deductions (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
+  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
+  type TEXT NOT NULL, -- 'loan_repayment', 'salary_advance', 'fine', 'cooperative', etc.
+  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0), -- Amount for current period
+  total_amount DECIMAL(15,2), -- Total loan/advance amount (for tracking)
+  remaining_balance DECIMAL(15,2), -- Outstanding balance (for loans/advances)
+  period TEXT NOT NULL, -- '2025-01' format
+  start_period TEXT, -- When the deduction started
+  end_period TEXT, -- When the deduction should end (optional)
+  description TEXT,
+  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paid_off', 'cancelled'
+  created_by UUID REFERENCES users(id),
+  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
+  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
+);
+
 -- Insert Nigerian CONJUSS salary structure (Grade Level 1-17, Step 1-15)
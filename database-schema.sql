-- JSC Payroll Management System Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and roles
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff', -- super_admin, account_admin, payroll_admin, staff
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  head_of_department UUID, -- Will reference staff.id after staff table is created
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL UNIQUE, -- JSC/2025/00001
  user_id UUID REFERENCES users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  department_id UUID REFERENCES departments(id),
  position TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 17),
  step INTEGER NOT NULL CHECK (step >= 1 AND step <= 15),
  employment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, on_leave, retired, terminated
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  pension_pin TEXT,
  tax_pin TEXT,
  next_of_kin JSONB, -- JSON object with next of kin details
  documents JSONB, -- Array of document URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for head_of_department
ALTER TABLE departments ADD CONSTRAINT departments_head_of_department_fkey 
  FOREIGN KEY (head_of_department) REFERENCES staff(id);

-- Salary structure table (CONJUSS)
CREATE TABLE salary_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 17),
  step INTEGER NOT NULL CHECK (step >= 1 AND step <= 15),
  basic_salary DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(grade_level, step)
);

-- Allowances table
CREATE TABLE allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- percentage, fixed
  value DECIMAL(15,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deductions table
CREATE TABLE deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- percentage, fixed
  value DECIMAL(15,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payroll runs table
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL, -- "2025-01"
  department_id UUID REFERENCES departments(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, pending_review, approved, processed
  total_staff INTEGER,
  gross_amount DECIMAL(15,2),
  total_deductions DECIMAL(15,2),
  net_amount DECIMAL(15,2),
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payslips table
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  payroll_run_id UUID REFERENCES payroll_runs(id),
  period TEXT NOT NULL,
  basic_salary DECIMAL(15,2),
  allowances JSONB, -- JSON object with allowance breakdowns
  deductions JSONB, -- JSON object with deduction breakdowns
  gross_pay DECIMAL(15,2),
  total_deductions DECIMAL(15,2),
  net_pay DECIMAL(15,2),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- info, warning, error, success
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB, -- Additional data for the notification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Insert Nigerian CONJUSS salary structure (Grade Level 1-17, Step 1-15)
INSERT INTO salary_structure (grade_level, step, basic_salary) VALUES
-- Grade Level 1
(1, 1, 42000), (1, 2, 44000), (1, 3, 46000), (1, 4, 48000), (1, 5, 50000),
(1, 6, 52000), (1, 7, 54000), (1, 8, 56000), (1, 9, 58000), (1, 10, 60000),
(1, 11, 62000), (1, 12, 64000), (1, 13, 66000), (1, 14, 68000), (1, 15, 70000),

-- Grade Level 2
(2, 1, 48000), (2, 2, 50000), (2, 3, 52000), (2, 4, 54000), (2, 5, 56000),
(2, 6, 58000), (2, 7, 60000), (2, 8, 62000), (2, 9, 64000), (2, 10, 66000),
(2, 11, 68000), (2, 12, 70000), (2, 13, 72000), (2, 14, 74000), (2, 15, 76000),

-- Grade Level 3
(3, 1, 55000), (3, 2, 57000), (3, 3, 59000), (3, 4, 61000), (3, 5, 63000),
(3, 6, 65000), (3, 7, 67000), (3, 8, 69000), (3, 9, 71000), (3, 10, 73000),
(3, 11, 75000), (3, 12, 77000), (3, 13, 79000), (3, 14, 81000), (3, 15, 83000),

-- Grade Level 4
(4, 1, 62000), (4, 2, 64000), (4, 3, 66000), (4, 4, 68000), (4, 5, 70000),
(4, 6, 72000), (4, 7, 74000), (4, 8, 76000), (4, 9, 78000), (4, 10, 80000),
(4, 11, 82000), (4, 12, 84000), (4, 13, 86000), (4, 14, 88000), (4, 15, 90000),

-- Grade Level 5
(5, 1, 70000), (5, 2, 72000), (5, 3, 74000), (5, 4, 76000), (5, 5, 78000),
(5, 6, 80000), (5, 7, 82000), (5, 8, 84000), (5, 9, 86000), (5, 10, 88000),
(5, 11, 90000), (5, 12, 92000), (5, 13, 94000), (5, 14, 96000), (5, 15, 98000),

-- Grade Level 6
(6, 1, 78000), (6, 2, 80000), (6, 3, 82000), (6, 4, 84000), (6, 5, 86000),
(6, 6, 88000), (6, 7, 90000), (6, 8, 92000), (6, 9, 94000), (6, 10, 96000),
(6, 11, 98000), (6, 12, 100000), (6, 13, 102000), (6, 14, 104000), (6, 15, 106000),

-- Grade Level 7
(7, 1, 87000), (7, 2, 89000), (7, 3, 91000), (7, 4, 93000), (7, 5, 95000),
(7, 6, 97000), (7, 7, 99000), (7, 8, 101000), (7, 9, 103000), (7, 10, 105000),
(7, 11, 107000), (7, 12, 109000), (7, 13, 111000), (7, 14, 113000), (7, 15, 115000),

-- Grade Level 8
(8, 1, 96000), (8, 2, 98000), (8, 3, 100000), (8, 4, 102000), (8, 5, 104000),
(8, 6, 106000), (8, 7, 108000), (8, 8, 110000), (8, 9, 112000), (8, 10, 114000),
(8, 11, 116000), (8, 12, 118000), (8, 13, 120000), (8, 14, 122000), (8, 15, 124000),

-- Grade Level 9
(9, 1, 106000), (9, 2, 108000), (9, 3, 110000), (9, 4, 112000), (9, 5, 114000),
(9, 6, 116000), (9, 7, 118000), (9, 8, 120000), (9, 9, 122000), (9, 10, 124000),
(9, 11, 126000), (9, 12, 128000), (9, 13, 130000), (9, 14, 132000), (9, 15, 134000),

-- Grade Level 10
(10, 1, 116000), (10, 2, 118000), (10, 3, 120000), (10, 4, 122000), (10, 5, 124000),
(10, 6, 126000), (10, 7, 128000), (10, 8, 130000), (10, 9, 132000), (10, 10, 134000),
(10, 11, 136000), (10, 12, 138000), (10, 13, 140000), (10, 14, 142000), (10, 15, 144000),

-- Grade Level 11
(11, 1, 127000), (11, 2, 129000), (11, 3, 131000), (11, 4, 133000), (11, 5, 135000),
(11, 6, 137000), (11, 7, 139000), (11, 8, 141000), (11, 9, 143000), (11, 10, 145000),
(11, 11, 147000), (11, 12, 149000), (11, 13, 151000), (11, 14, 153000), (11, 15, 155000),

-- Grade Level 12
(12, 1, 138000), (12, 2, 140000), (12, 3, 142000), (12, 4, 144000), (12, 5, 146000),
(12, 6, 148000), (12, 7, 150000), (12, 8, 152000), (12, 9, 154000), (12, 10, 156000),
(12, 11, 158000), (12, 12, 160000), (12, 13, 162000), (12, 14, 164000), (12, 15, 166000),

-- Grade Level 13
(13, 1, 150000), (13, 2, 152000), (13, 3, 154000), (13, 4, 156000), (13, 5, 158000),
(13, 6, 160000), (13, 7, 162000), (13, 8, 164000), (13, 9, 166000), (13, 10, 168000),
(13, 11, 170000), (13, 12, 172000), (13, 13, 174000), (13, 14, 176000), (13, 15, 178000),

-- Grade Level 14
(14, 1, 162000), (14, 2, 164000), (14, 3, 166000), (14, 4, 168000), (14, 5, 170000),
(14, 6, 172000), (14, 7, 174000), (14, 8, 176000), (14, 9, 178000), (14, 10, 180000),
(14, 11, 182000), (14, 12, 184000), (14, 13, 186000), (14, 14, 188000), (14, 15, 190000),

-- Grade Level 15
(15, 1, 175000), (15, 2, 177000), (15, 3, 179000), (15, 4, 181000), (15, 5, 183000),
(15, 6, 185000), (15, 7, 187000), (15, 8, 189000), (15, 9, 191000), (15, 10, 193000),
(15, 11, 195000), (15, 12, 197000), (15, 13, 199000), (15, 14, 201000), (15, 15, 203000),

-- Grade Level 16
(16, 1, 188000), (16, 2, 190000), (16, 3, 192000), (16, 4, 194000), (16, 5, 196000),
(16, 6, 198000), (16, 7, 200000), (16, 8, 202000), (16, 9, 204000), (16, 10, 206000),
(16, 11, 208000), (16, 12, 210000), (16, 13, 212000), (16, 14, 214000), (16, 15, 216000),

-- Grade Level 17
(17, 1, 202000), (17, 2, 204000), (17, 3, 206000), (17, 4, 208000), (17, 5, 210000),
(17, 6, 212000), (17, 7, 214000), (17, 8, 216000), (17, 9, 218000), (17, 10, 220000),
(17, 11, 222000), (17, 12, 224000), (17, 13, 226000), (17, 14, 228000), (17, 15, 230000);

-- Insert standard allowances
INSERT INTO allowances (name, type, value, is_active) VALUES
('Housing Allowance', 'percentage', 40.0, TRUE),
('Transport Allowance', 'percentage', 20.0, TRUE),
('Medical Allowance', 'percentage', 10.0, TRUE),
('Judicial Allowance', 'percentage', 25.0, TRUE),
('Leave Allowance', 'percentage', 10.0, TRUE),
('Utility Allowance', 'fixed', 15000, TRUE),
('Special Allowance', 'fixed', 10000, TRUE);

-- Insert standard deductions
INSERT INTO deductions (name, type, value, is_active) VALUES
('Pension (Employee)', 'percentage', 8.0, TRUE),
('Tax (PAYE)', 'percentage', 7.5, TRUE),
('National Housing Fund', 'percentage', 2.5, TRUE),
('Union Dues', 'fixed', 1000, TRUE),
('Life Insurance', 'fixed', 500, TRUE);

-- Insert sample departments
INSERT INTO departments (name, code, description) VALUES
('Supreme Court', 'SC', 'Supreme Court of Nigeria'),
('Court of Appeal', 'CA', 'Court of Appeal'),
('Federal High Court', 'FHC', 'Federal High Court'),
('State High Court', 'SHC', 'State High Court'),
('Magistrate Court', 'MC', 'Magistrate Court'),
('Customary Court', 'CC', 'Customary Court'),
('Sharia Court', 'SHA', 'Sharia Court'),
('National Judicial Council', 'NJC', 'National Judicial Council'),
('Federal Judicial Service Committee', 'FJSC', 'Federal Judicial Service Committee'),
('Administration', 'ADMIN', 'Administrative Department'),
('Human Resources', 'HR', 'Human Resources Department'),
('Finance', 'FIN', 'Finance Department'),
('ICT', 'ICT', 'Information and Communication Technology'),
('Security', 'SEC', 'Security Department'),
('Registry', 'REG', 'Court Registry');

-- Insert test users (passwords should be hashed in production)
INSERT INTO users (email, role) VALUES
('superadmin@jsc.gov.ng', 'super_admin'),
('admin@jsc.gov.ng', 'account_admin'),
('payroll@jsc.gov.ng', 'payroll_admin'),
('staff@jsc.gov.ng', 'staff');

-- Create indexes for better performance
CREATE INDEX idx_staff_staff_id ON staff(staff_id);
CREATE INDEX idx_staff_department_id ON staff(department_id);
CREATE INDEX idx_staff_grade_level ON staff(grade_level);
CREATE INDEX idx_payslips_staff_id ON payslips(staff_id);
CREATE INDEX idx_payslips_period ON payslips(period);
CREATE INDEX idx_payroll_runs_period ON payroll_runs(period);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own record
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Staff policies
CREATE POLICY "Staff can view all records" ON staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.id = staff.user_id
    )
  );

-- Department policies
CREATE POLICY "Departments viewable by all authenticated users" ON departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Payslips policies
CREATE POLICY "Payslips viewable by admins and own payslips" ON payslips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
    OR 
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = payslips.staff_id 
      AND staff.user_id::text = auth.uid()::text
    )
  );

-- Payroll runs policies
CREATE POLICY "Payroll runs viewable by admins" ON payroll_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role IN ('super_admin', 'account_admin', 'payroll_admin')
    )
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Audit logs policies
CREATE POLICY "Audit logs viewable by super admins" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND users.role = 'super_admin'
    )
  );

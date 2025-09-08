/*
  # Staff Promotions Management System

  1. New Tables
    - `promotions`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, foreign key to staff)
      - `old_grade_level` (integer, previous grade level)
      - `old_step` (integer, previous step)
      - `new_grade_level` (integer, new grade level)
      - `new_step` (integer, new step)
      - `effective_date` (date, when promotion takes effect)
      - `promotion_type` (text, type of promotion)
      - `reason` (text, reason for promotion)
      - `approved_by` (uuid, foreign key to users)
      - `approved_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on promotions table
    - Add policies for admin access only
    - Audit trail for all promotion actions

  3. Business Logic
    - Validate promotion logic (no demotions without reason)
    - Ensure effective dates are logical
    - Track promotion history for payroll proration
    - Support different promotion types (regular, acting, temporary)

  4. Integration Points
    - Links to staff table for grade/step updates
    - Supports payroll proration calculations
    - Audit logging for compliance
*/

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  old_grade_level integer NOT NULL CHECK (old_grade_level >= 1 AND old_grade_level <= 17),
  old_step integer NOT NULL CHECK (old_step >= 1 AND old_step <= 15),
  new_grade_level integer NOT NULL CHECK (new_grade_level >= 1 AND new_grade_level <= 17),
  new_step integer NOT NULL CHECK (new_step >= 1 AND new_step <= 15),
  effective_date date NOT NULL,
  promotion_type text NOT NULL DEFAULT 'regular', -- regular, acting, temporary, demotion
  reason text,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Business logic constraints
  CONSTRAINT valid_promotion_dates CHECK (effective_date <= CURRENT_DATE + INTERVAL '1 year'),
  CONSTRAINT valid_promotion_type CHECK (promotion_type IN ('regular', 'acting', 'temporary', 'demotion'))
);

-- Enable Row Level Security
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotions table
CREATE POLICY "Admins can view all promotions" ON promotions
  FOR SELECT 
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert promotions" ON promotions
  FOR INSERT 
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update promotions" ON promotions
  FOR UPDATE 
  USING (is_admin(auth.uid()));

CREATE POLICY "Super admin can delete promotions" ON promotions
  FOR DELETE 
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Function to automatically update staff grade/step when promotion is approved
CREATE OR REPLACE FUNCTION update_staff_on_promotion()
RETURNS trigger AS $$
BEGIN
  -- Only update staff record if promotion is being approved (approved_at is being set)
  IF NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL THEN
    -- Update the staff member's current grade level and step
    UPDATE staff 
    SET 
      grade_level = NEW.new_grade_level,
      step = NEW.new_step,
      updated_at = now()
    WHERE id = NEW.staff_id;
    
    -- Log the promotion in audit logs
    INSERT INTO audit_logs (
      user_id,
      action,
      resource,
      resource_id,
      old_values,
      new_values
    ) VALUES (
      NEW.approved_by,
      'staff_promoted',
      'staff',
      NEW.staff_id::text,
      jsonb_build_object(
        'grade_level', NEW.old_grade_level,
        'step', NEW.old_step
      ),
      jsonb_build_object(
        'grade_level', NEW.new_grade_level,
        'step', NEW.new_step,
        'effective_date', NEW.effective_date,
        'promotion_type', NEW.promotion_type
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update staff on promotion approval
CREATE TRIGGER update_staff_on_promotion_trigger
  AFTER UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_on_promotion();

-- Function to get staff grade/step for a specific date (for payroll proration)
CREATE OR REPLACE FUNCTION get_staff_grade_on_date(
  p_staff_id uuid,
  p_date date
)
RETURNS TABLE(grade_level integer, step integer) AS $$
BEGIN
  -- Get the most recent promotion that was effective on or before the given date
  RETURN QUERY
  SELECT 
    COALESCE(p.new_grade_level, s.grade_level) as grade_level,
    COALESCE(p.new_step, s.step) as step
  FROM staff s
  LEFT JOIN promotions p ON s.id = p.staff_id 
    AND p.effective_date <= p_date 
    AND p.approved_at IS NOT NULL
  WHERE s.id = p_staff_id
  ORDER BY p.effective_date DESC, p.approved_at DESC
  LIMIT 1;
  
  -- If no promotion found, return current staff grade/step
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT s.grade_level, s.step
    FROM staff s
    WHERE s.id = p_staff_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all grade changes within a date range (for payroll proration)
CREATE OR REPLACE FUNCTION get_staff_grade_changes_in_period(
  p_staff_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  effective_date date,
  grade_level integer,
  step integer,
  days_in_grade integer
) AS $$
DECLARE
  promotion_record record;
  current_date date;
  next_date date;
  current_grade integer;
  current_step integer;
BEGIN
  -- Get initial grade/step at start of period
  SELECT g.grade_level, g.step INTO current_grade, current_step
  FROM get_staff_grade_on_date(p_staff_id, p_start_date) g;
  
  current_date := p_start_date;
  
  -- Loop through all promotions in the period
  FOR promotion_record IN
    SELECT effective_date, new_grade_level, new_step
    FROM promotions
    WHERE staff_id = p_staff_id
    AND effective_date BETWEEN p_start_date AND p_end_date
    AND approved_at IS NOT NULL
    ORDER BY effective_date
  LOOP
    -- Return the current grade for days before this promotion
    IF promotion_record.effective_date > current_date THEN
      RETURN QUERY SELECT 
        current_date,
        current_grade,
        current_step,
        (promotion_record.effective_date - current_date)::integer;
    END IF;
    
    -- Update to new grade/step
    current_grade := promotion_record.new_grade_level;
    current_step := promotion_record.new_step;
    current_date := promotion_record.effective_date;
  END LOOP;
  
  -- Return remaining days in period with final grade/step
  IF current_date <= p_end_date THEN
    RETURN QUERY SELECT 
      current_date,
      current_grade,
      current_step,
      (p_end_date - current_date + 1)::integer;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate promotion logic
CREATE OR REPLACE FUNCTION validate_promotion()
RETURNS trigger AS $$
BEGIN
  -- Ensure effective date is not in the past (allow same day)
  IF NEW.effective_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Promotion effective date cannot be in the past';
  END IF;
  
  -- Ensure the promotion represents an actual change
  IF NEW.old_grade_level = NEW.new_grade_level AND NEW.old_step = NEW.new_step THEN
    RAISE EXCEPTION 'Promotion must represent a change in grade level or step';
  END IF;
  
  -- For demotions, ensure reason is provided
  IF (NEW.new_grade_level < NEW.old_grade_level OR 
      (NEW.new_grade_level = NEW.old_grade_level AND NEW.new_step < NEW.old_step)) 
     AND NEW.promotion_type != 'demotion' THEN
    RAISE EXCEPTION 'Reduction in grade/step must be marked as demotion type';
  END IF;
  
  IF NEW.promotion_type = 'demotion' AND (NEW.reason IS NULL OR LENGTH(TRIM(NEW.reason)) < 10) THEN
    RAISE EXCEPTION 'Demotion requires a detailed reason (minimum 10 characters)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for promotion validation
CREATE TRIGGER validate_promotion_trigger
  BEFORE INSERT OR UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION validate_promotion();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promotions_staff_id ON promotions(staff_id);
CREATE INDEX IF NOT EXISTS idx_promotions_effective_date ON promotions(effective_date);
CREATE INDEX IF NOT EXISTS idx_promotions_approved_at ON promotions(approved_at);
CREATE INDEX IF NOT EXISTS idx_promotions_staff_effective ON promotions(staff_id, effective_date);

-- Insert sample promotion types for reference
INSERT INTO promotions (
  staff_id, 
  old_grade_level, 
  old_step, 
  new_grade_level, 
  new_step, 
  effective_date, 
  promotion_type, 
  reason,
  approved_by,
  approved_at
) 
SELECT 
  s.id,
  s.grade_level,
  s.step,
  LEAST(s.grade_level + 1, 17), -- Promote by one grade level, max 17
  1, -- Reset to step 1 on grade promotion
  CURRENT_DATE + INTERVAL '1 month', -- Effective next month
  'regular',
  'Annual performance-based promotion',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  now()
FROM staff s
WHERE s.status = 'active'
AND s.grade_level < 17 -- Only promote those not at max grade
AND s.id IN (
  SELECT id FROM staff 
  WHERE status = 'active' 
  ORDER BY RANDOM() 
  LIMIT 3 -- Sample promotions for 3 random staff
)
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE promotions IS 'Tracks staff promotions and grade level changes for payroll proration';
COMMENT ON FUNCTION get_staff_grade_on_date(uuid, date) IS 'Returns staff grade level and step for a specific date';
COMMENT ON FUNCTION get_staff_grade_changes_in_period(uuid, date, date) IS 'Returns all grade changes within a date range for payroll proration';
COMMENT ON FUNCTION validate_promotion() IS 'Validates promotion business rules before insertion/update';
COMMENT ON FUNCTION update_staff_on_promotion() IS 'Automatically updates staff grade/step when promotion is approved';
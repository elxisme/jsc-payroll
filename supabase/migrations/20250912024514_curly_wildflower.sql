/*
  # Fix PostgreSQL Syntax Error in Loan Management Functions

  1. Function Updates
    - Fix `get_staff_grade_changes_in_period` function
    - Rename `current_date` variable to avoid PostgreSQL reserved keyword conflict
    - Maintain all existing functionality

  2. Error Resolution
    - Resolves ERROR 42601: syntax error at or near "current_date"
    - PostgreSQL treats `current_date` as reserved keyword/function
    - Variable renamed to `v_current_date` for clarity

  3. No Breaking Changes
    - Function signature remains identical
    - Return type unchanged
    - Business logic preserved
*/

-- Drop and recreate the function with corrected variable names
DROP FUNCTION IF EXISTS get_staff_grade_changes_in_period(uuid, text);

-- Function to get staff grade changes in period (corrected version)
CREATE OR REPLACE FUNCTION get_staff_grade_changes_in_period(
  p_staff_id uuid,
  period_date text
)
RETURNS TABLE(
  grade_level integer,
  step integer,
  days_in_period integer
) AS $$
DECLARE
  period_start date;
  period_end date;
  promotion_record record;
  v_current_date date; -- Renamed from current_date to avoid PostgreSQL reserved keyword
  next_date date;
  current_grade integer;
  current_step integer;
BEGIN
  -- Parse period (YYYY-MM format) to get start and end dates
  period_start := (period_date || '-01')::date;
  period_end := (period_start + INTERVAL '1 month - 1 day')::date;
  
  -- Get initial grade/step at start of period
  SELECT s.grade_level, s.step INTO current_grade, current_step
  FROM staff s
  WHERE s.id = p_staff_id;
  
  v_current_date := period_start; -- Renamed variable
  
  -- Check for any promotions that became effective during this period
  FOR promotion_record IN
    SELECT effective_date, new_grade_level, new_step
    FROM promotions
    WHERE staff_id = p_staff_id
    AND effective_date BETWEEN period_start AND period_end
    AND approved_at IS NOT NULL
    ORDER BY effective_date
  LOOP
    -- Return the current grade for days before this promotion
    IF promotion_record.effective_date > v_current_date THEN
      RETURN QUERY SELECT 
        current_grade,
        current_step,
        (promotion_record.effective_date - v_current_date)::integer;
    END IF;
    
    -- Update to new grade/step
    current_grade := promotion_record.new_grade_level;
    current_step := promotion_record.new_step;
    v_current_date := promotion_record.effective_date; -- Renamed variable
  END LOOP;
  
  -- Return remaining days in period with final grade/step
  IF v_current_date <= period_end THEN
    RETURN QUERY SELECT 
      current_grade,
      current_step,
      (period_end - v_current_date + 1)::integer;
  END IF;
  
  -- If no promotions in period, return full month with current grade/step
  IF NOT EXISTS (
    SELECT 1 FROM promotions
    WHERE staff_id = p_staff_id
    AND effective_date BETWEEN period_start AND period_end
    AND approved_at IS NOT NULL
  ) THEN
    RETURN QUERY SELECT 
      current_grade,
      current_step,
      EXTRACT(DAY FROM period_end)::integer;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION get_staff_grade_changes_in_period(uuid, text) IS 'Returns staff grade changes within a period for payroll proration (fixed syntax)';
/*
  # Add end date and update project calculations

  1. New Columns
    - `end_date` (date) - Project end date
    - `days_remaining` (integer) - Calculated remaining days

  2. Functions
    - Create function to calculate remaining days
    - Create function to update achievement rate

  3. Triggers
    - Add trigger to automatically update days_remaining
    - Add trigger to automatically update achievement_rate
*/

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN end_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'days_remaining'
  ) THEN
    ALTER TABLE projects ADD COLUMN days_remaining integer DEFAULT 0;
  END IF;
END $$;

-- Create function to calculate remaining days
CREATE OR REPLACE FUNCTION calculate_days_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_remaining = 
    CASE 
      WHEN NEW.end_date IS NULL THEN 0
      WHEN NEW.end_date < CURRENT_DATE THEN 0
      ELSE (NEW.end_date - CURRENT_DATE)::integer
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate achievement rate
CREATE OR REPLACE FUNCTION calculate_achievement_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_amount > 0 THEN
    NEW.achievement_rate = ROUND((NEW.amount_achieved::float / NEW.target_amount::float) * 100);
  ELSE
    NEW.achievement_rate = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for days remaining calculation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_days_remaining'
  ) THEN
    CREATE TRIGGER update_days_remaining
      BEFORE INSERT OR UPDATE ON projects
      FOR EACH ROW
      EXECUTE FUNCTION calculate_days_remaining();
  END IF;
END $$;

-- Create trigger for achievement rate calculation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_achievement_rate'
  ) THEN
    CREATE TRIGGER update_achievement_rate
      BEFORE INSERT OR UPDATE OF amount_achieved, target_amount ON projects
      FOR EACH ROW
      EXECUTE FUNCTION calculate_achievement_rate();
  END IF;
END $$;
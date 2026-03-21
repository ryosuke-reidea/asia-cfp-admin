/*
  # Add publication start date to projects

  1. Changes
    - Add `start_date` (date) column to projects table
    - Default value: current date
    - Not null constraint

  2. Data Protection
    - Existing records will have start_date set to current date
    - No data loss during migration
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN start_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;
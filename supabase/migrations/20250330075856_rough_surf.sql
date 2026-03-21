/*
  # Add featured flag to projects table

  1. Changes
    - Add `is_featured` boolean column to projects table
      - Default value: false
      - Not null constraint

  2. Data Protection
    - Existing records will have is_featured set to false
    - No data loss during migration
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;
END $$;
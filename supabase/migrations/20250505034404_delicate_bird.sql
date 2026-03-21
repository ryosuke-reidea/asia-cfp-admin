/*
  # Add project visibility toggle

  1. Changes
    - Add `is_public` boolean column to projects table
      - Default value: true (backwards compatibility)
      - Not null constraint

  2. Data Protection
    - Existing records will be public by default
    - No data loss during migration
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN is_public boolean NOT NULL DEFAULT true;
  END IF;
END $$;
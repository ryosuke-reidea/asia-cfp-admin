/*
  # Add creator description to projects table

  1. New Columns
    - `creator_description` (text) - 製作者の説明

  2. Data Protection
    - Existing records will have creator_description set to null
    - No data loss during migration
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'creator_description'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN creator_description text;
  END IF;
END $$;
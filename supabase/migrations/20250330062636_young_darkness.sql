/*
  # Update projects table description column

  1. Changes
    - Modify the description column to use TEXT type with no length limit
    - This allows for storing rich text content with HTML markup

  2. Data Protection
    - Existing data is preserved
    - No data loss during migration
*/

DO $$ 
BEGIN
  -- Update description column to TEXT type if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects'
    AND column_name = 'description'
  ) THEN
    -- ALTER the column type to TEXT
    ALTER TABLE projects
    ALTER COLUMN description TYPE TEXT;
  END IF;
END $$;
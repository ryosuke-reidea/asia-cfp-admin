/*
  # Add project type selection

  1. Changes
    - Update `project_type` column default value to 'media'
    - Update check constraint to allow 'media' and 'crowdfunding' values
    - Add index for better query performance

  2. Security
    - No RLS changes needed as existing policies cover the new field
*/

-- Update the check constraint to allow 'media' and 'crowdfunding'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_type_check 
  CHECK (project_type = ANY (ARRAY['media'::text, 'crowdfunding'::text]));

-- Update default value to 'media'
ALTER TABLE projects ALTER COLUMN project_type SET DEFAULT 'media'::text;

-- Update existing records to have 'media' as default if they have 'crowdfunding'
UPDATE projects SET project_type = 'media' WHERE project_type = 'crowdfunding';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_project_type_media ON projects (project_type);
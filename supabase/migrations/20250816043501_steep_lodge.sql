/*
  # Add reward links functionality

  1. Database Changes
    - Add `link_url` column to `rewards` table
    - Set default value to project's link_url
    - Add index for performance

  2. Security
    - No RLS changes needed (existing policies cover new column)

  3. Notes
    - Each reward can have its own specific link
    - Defaults to project's main link for consistency
    - Allows customization per reward
*/

-- Add link_url column to rewards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'link_url'
  ) THEN
    ALTER TABLE rewards ADD COLUMN link_url text;
  END IF;
END $$;

-- Add index for link_url column for better performance
CREATE INDEX IF NOT EXISTS idx_rewards_link_url ON rewards(link_url);

-- Update existing rewards to use their project's link_url as default
UPDATE rewards 
SET link_url = projects.link_url
FROM projects 
WHERE rewards.project_id = projects.id 
AND rewards.link_url IS NULL;
/*
  # Add category sort order to projects

  1. Changes
    - Add `category_sort_order` column to projects table
    - Set default value to 0
    - Add index for efficient sorting by category and sort order

  2. Notes
    - Lower numbers will appear first in the category
    - Projects with the same sort order will be sorted by creation date
*/

-- Add category_sort_order column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'category_sort_order'
  ) THEN
    ALTER TABLE projects ADD COLUMN category_sort_order integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_projects_category_sort 
ON projects (category_id, category_sort_order, created_at);

-- Add comment to explain the column
COMMENT ON COLUMN projects.category_sort_order IS 'Sort order within category (lower numbers appear first)';
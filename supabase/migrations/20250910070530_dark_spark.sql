/*
  # Auto-update category sort order for new projects

  1. New Functions
    - `update_category_sort_order()` - Automatically updates sort order when projects are added
    
  2. New Triggers
    - Trigger on INSERT to projects table to automatically manage sort order
    
  3. Logic
    - When a new project is inserted, it gets sort_order = 0
    - All existing projects in the same category get their sort_order incremented by 1
    - This ensures the newest project always appears first in the category
*/

-- Function to update category sort order
CREATE OR REPLACE FUNCTION update_category_sort_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this is an INSERT operation and category_id is set
  IF TG_OP = 'INSERT' AND NEW.category_id IS NOT NULL THEN
    -- Increment sort_order for all existing projects in the same category
    UPDATE projects 
    SET category_sort_order = category_sort_order + 1
    WHERE category_id = NEW.category_id 
    AND id != NEW.id;
    
    -- Set the new project's sort_order to 0 (top position)
    NEW.category_sort_order = 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update category sort order on insert
DROP TRIGGER IF EXISTS auto_update_category_sort_order ON projects;
CREATE TRIGGER auto_update_category_sort_order
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_category_sort_order();
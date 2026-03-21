/*
  # Add video support to projects

  1. Changes
    - Add `video_url` (text) column to projects table
      - Optional field for project videos
      - Can be YouTube, Vimeo, or other video URLs

  2. Data Protection
    - Existing records will have video_url set to null
    - No data loss during migration
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN video_url text;
  END IF;
END $$;
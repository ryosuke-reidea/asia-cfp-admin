/*
  # プロジェクトコメント機能の追加

  1. New Tables
    - `project_comments`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `commenter_name` (text, コメント投稿者名)
      - `commenter_email` (text, コメント投稿者メール)
      - `comment_text` (text, コメント内容)
      - `rating` (integer, 評価 1-5)
      - `is_approved` (boolean, 承認状態)
      - `is_featured` (boolean, 注目コメント)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `project_comments` table
    - Add policies for authenticated users to manage comments
    - Add policy for public to view approved comments
*/

CREATE TABLE IF NOT EXISTS project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commenter_name text NOT NULL,
  commenter_email text NOT NULL,
  comment_text text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  is_approved boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin users can manage all comments"
  ON project_comments
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Public can view approved comments"
  ON project_comments
  FOR SELECT
  TO public
  USING (is_approved = true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_approved ON project_comments(is_approved);
CREATE INDEX IF NOT EXISTS idx_project_comments_featured ON project_comments(is_featured);

-- Update trigger
CREATE OR REPLACE FUNCTION update_project_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_comments_updated_at
  BEFORE UPDATE ON project_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_project_comments_updated_at();
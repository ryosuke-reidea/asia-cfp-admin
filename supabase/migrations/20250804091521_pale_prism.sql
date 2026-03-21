/*
  # Create rewards table for project returns

  1. New Tables
    - `rewards`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `title` (text, reward title)
      - `description` (text, reward description)
      - `price` (integer, price in yen)
      - `estimated_delivery` (text, estimated delivery date)
      - `quantity_available` (integer, available quantity, null for unlimited)
      - `quantity_claimed` (integer, claimed quantity, default 0)
      - `image_url` (text, reward image URL)
      - `is_available` (boolean, availability status, default true)
      - `sort_order` (integer, display order, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `rewards` table
    - Add policies for authenticated users to manage rewards
    - Add policy for public to view rewards of public projects

  3. Triggers
    - Add trigger to update updated_at column
*/

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  estimated_delivery text,
  quantity_available integer,
  quantity_claimed integer NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Policies for rewards
CREATE POLICY "Admin users can manage all rewards"
  ON rewards
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

CREATE POLICY "Authenticated users can manage rewards"
  ON rewards
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can view rewards of public projects"
  ON rewards
  FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = rewards.project_id 
    AND projects.is_public = true
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_rewards_project_id ON rewards(project_id);
CREATE INDEX IF NOT EXISTS idx_rewards_sort_order ON rewards(project_id, sort_order);
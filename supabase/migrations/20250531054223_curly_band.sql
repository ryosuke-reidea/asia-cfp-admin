-- Create newsletters table if it doesn't exist
CREATE TABLE IF NOT EXISTS newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  delivery_date timestamptz NOT NULL,
  sent_at timestamptz,
  is_sending boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT newsletters_delivery_date_check CHECK (delivery_date > now())
);

-- Enable RLS if not already enabled
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DO $$ 
BEGIN
  -- Drop the policy if it exists
  DROP POLICY IF EXISTS "Admin users can manage newsletters" ON newsletters;
  
  -- Create the policy
  CREATE POLICY "Admin users can manage newsletters"
    ON newsletters
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.id = auth.uid()
    ));
END $$;

-- Create trigger for updating updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_newsletters_updated_at'
  ) THEN
    CREATE TRIGGER update_newsletters_updated_at
      BEFORE UPDATE ON newsletters
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
-- Create newsletters table
CREATE TABLE IF NOT EXISTS newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  delivery_date timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT newsletters_delivery_date_check CHECK (delivery_date > now())
);

-- Enable RLS
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin users can manage newsletters"
  ON newsletters
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

-- Create trigger for updating updated_at
CREATE TRIGGER update_newsletters_updated_at
  BEFORE UPDATE ON newsletters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function for sending newsletters
CREATE OR REPLACE FUNCTION send_scheduled_newsletters()
RETURNS void AS $$
BEGIN
  -- Update sent_at for newsletters that should be sent
  UPDATE newsletters
  SET sent_at = now()
  WHERE delivery_date <= now()
    AND sent_at IS NULL;
END;
$$ LANGUAGE plpgsql;
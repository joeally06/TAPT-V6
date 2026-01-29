-- Create regional luncheon settings table
CREATE TABLE IF NOT EXISTS regional_luncheon_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_deadline timestamptz NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index to ensure only one active settings record
CREATE UNIQUE INDEX IF NOT EXISTS regional_luncheon_settings_active_idx 
ON regional_luncheon_settings (is_active) 
WHERE is_active = true;

-- Enable RLS
ALTER TABLE regional_luncheon_settings ENABLE ROW LEVEL SECURITY;

-- Admin full access policy
CREATE POLICY "Admins have full access to regional luncheon settings"
  ON regional_luncheon_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Public read-only access to active settings
CREATE POLICY "Public can read active regional luncheon settings"
  ON regional_luncheon_settings
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create a trigger to update the updated_at column
CREATE TRIGGER update_regional_luncheon_settings_updated_at
  BEFORE UPDATE ON regional_luncheon_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add event_id foreign key to registrations table
ALTER TABLE regional_luncheon_registrations 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES regional_luncheon_settings(id);

-- Create index for event_id lookups
CREATE INDEX IF NOT EXISTS idx_regional_luncheon_registrations_event_id 
ON regional_luncheon_registrations(event_id);

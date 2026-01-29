-- Create regional luncheon registrations table
CREATE TABLE IF NOT EXISTS regional_luncheon_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  district_organization text NOT NULL,
  number_of_attendees integer NOT NULL CHECK (number_of_attendees >= 1 AND number_of_attendees <= 3),
  preferred_region text NOT NULL CHECK (preferred_region IN ('West Region', 'Middle Region', 'Cookeville Region', 'Greeneville Region', 'East Region')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE regional_luncheon_registrations ENABLE ROW LEVEL SECURITY;

-- All regional luncheon registrations must be submitted via secure Edge Functions with validation and rate limiting.
-- No public or anon insert policy exists.

-- Admin read access
CREATE POLICY "Admins can read all regional luncheon registrations"
  ON regional_luncheon_registrations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Admin delete access (for data management)
CREATE POLICY "Admins can delete regional luncheon registrations"
  ON regional_luncheon_registrations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create a trigger to update the updated_at column
CREATE TRIGGER update_regional_luncheon_registrations_updated_at
  BEFORE UPDATE ON regional_luncheon_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_regional_luncheon_registrations_created_at 
  ON regional_luncheon_registrations(created_at DESC);
CREATE INDEX idx_regional_luncheon_registrations_preferred_region 
  ON regional_luncheon_registrations(preferred_region);

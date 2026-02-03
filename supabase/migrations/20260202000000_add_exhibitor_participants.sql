-- Migration: Add exhibitor_participants table
-- Description: Allows multiple booth participants per exhibitor registration without additional cost
-- Fields: first_name, last_name, role (optional)

-- Create the exhibitor_participants table
CREATE TABLE IF NOT EXISTS exhibitor_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibitor_registration_id UUID NOT NULL REFERENCES exhibitor_registrations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT, -- e.g., "Sales Representative", "Technical Support"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by registration ID
CREATE INDEX IF NOT EXISTS idx_exhibitor_participants_registration_id 
ON exhibitor_participants(exhibitor_registration_id);

-- Enable Row Level Security
ALTER TABLE exhibitor_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all participants
CREATE POLICY "Admins can manage all participants"
ON exhibitor_participants
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

-- Policy: Service role can manage participants (for Edge Functions)
CREATE POLICY "Service role can manage participants"
ON exhibitor_participants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER update_exhibitor_participants_updated_at
BEFORE UPDATE ON exhibitor_participants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE exhibitor_participants IS 'Stores additional booth participants for exhibitor registrations. Each participant is linked to a single exhibitor registration.';
COMMENT ON COLUMN exhibitor_participants.role IS 'Optional role or title of the participant, e.g., Sales Representative, Technical Support';

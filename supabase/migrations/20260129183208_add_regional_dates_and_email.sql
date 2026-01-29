-- Add regional_dates JSON field to regional_luncheon_settings
ALTER TABLE regional_luncheon_settings 
ADD COLUMN IF NOT EXISTS regional_dates jsonb DEFAULT '[]'::jsonb;

-- Add email field to regional_luncheon_registrations
ALTER TABLE regional_luncheon_registrations 
ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

-- Add email validation constraint
ALTER TABLE regional_luncheon_registrations
ADD CONSTRAINT email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_regional_luncheon_registrations_email 
ON regional_luncheon_registrations(email);

-- Add comment to explain regional_dates structure
COMMENT ON COLUMN regional_luncheon_settings.regional_dates IS 
'JSON array of regional luncheon dates. Format: [{"region": "West Region", "date": "2026-04-02", "time": "10:30 AM CST", "venue": "Venue Name"}]';

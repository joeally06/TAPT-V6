-- Create site settings table for simple key-value configuration
-- This table stores editable settings like payment addresses, contact info, etc.
-- Security: RLS enforced with admin-only write access

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints for data integrity
  CONSTRAINT key_not_empty CHECK (char_length(key) > 0),
  CONSTRAINT value_not_empty CHECK (char_length(value) > 0),
  CONSTRAINT category_not_empty CHECK (char_length(category) > 0),
  CONSTRAINT key_lowercase CHECK (key = lower(key)),
  CONSTRAINT value_max_length CHECK (char_length(value) <= 2000)
);

-- Create indexes for better query performance
CREATE INDEX idx_site_settings_category ON site_settings(category);
CREATE INDEX idx_site_settings_updated_at ON site_settings(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all settings
-- This is safe because settings don't contain sensitive data
CREATE POLICY "Settings readable by authenticated users"
  ON site_settings FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can insert new settings
CREATE POLICY "Settings insertable by admins only"
  ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Only admins can update settings
CREATE POLICY "Settings updatable by admins only"
  ON site_settings FOR UPDATE
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

-- Policy: Only admins can delete settings
CREATE POLICY "Settings deletable by admins only"
  ON site_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to auto-update timestamp and track who made the change
CREATE OR REPLACE FUNCTION update_site_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the timestamp function
CREATE TRIGGER update_site_settings_timestamp
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_timestamp();

-- Insert default payment-related settings
-- These are the values that will appear in email receipts
INSERT INTO site_settings (key, value, category, description) VALUES
  ('payment_remittance_name', 'Tennessee Association of Pupil Transportation', 'payment', 'Organization name for payment remittance'),
  ('payment_remittance_address_line1', '123 Main Street', 'payment', 'Payment mailing address - Line 1'),
  ('payment_remittance_address_line2', 'Suite 100', 'payment', 'Payment mailing address - Line 2 (leave empty if not needed)'),
  ('payment_remittance_city', 'Nashville', 'payment', 'Payment mailing address - City'),
  ('payment_remittance_state', 'TN', 'payment', 'Payment mailing address - State'),
  ('payment_remittance_zip', '37201', 'payment', 'Payment mailing address - ZIP code'),
  ('payment_contact_email', 'info@tapt.org', 'payment', 'Contact email for payment inquiries'),
  ('payment_contact_phone', '(615) 555-0100', 'payment', 'Contact phone for payment inquiries'),
  ('payment_receipt_footer', 'Thank you for your payment. Please keep this receipt for your records.', 'payment', 'Footer text displayed in payment receipt emails'),
  ('payment_receipt_subject', 'Payment Receipt - TAPT {{event_name}}', 'payment', 'Email subject line for payment receipts (use {{event_name}} variable)'),
  
  -- General contact settings
  ('site_support_email', 'support@tapt.org', 'general', 'General support email address'),
  ('site_support_phone', '(615) 555-0100', 'general', 'General support phone number'),
  ('site_organization_name', 'Tennessee Association of Pupil Transportation', 'general', 'Full organization name');

-- Add comment to table for documentation
COMMENT ON TABLE site_settings IS 'Stores editable site-wide settings. Only admins can modify. All authenticated users can read.';

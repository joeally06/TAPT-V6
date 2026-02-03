-- Add admin_notification_email to site_settings
-- This setting controls where registration notification emails are sent to
-- Can be updated via Admin Panel > Email Settings

-- Insert the admin notification email setting if it doesn't exist
INSERT INTO site_settings (setting_key, setting_value, updated_at)
VALUES (
  'admin_notification_email',
  '"info@tapt.org"'::jsonb,
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add a comment to document the setting
COMMENT ON TABLE site_settings IS 'Stores editable site-wide settings including payment info and admin notification email. Only admins can modify.';

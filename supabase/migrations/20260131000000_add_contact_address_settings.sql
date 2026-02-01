-- Add contact address settings to site_settings table
-- These settings allow admins to manage the organization's mailing address from the Site Settings page

INSERT INTO site_settings (setting_key, setting_value, created_at, updated_at)
VALUES 
  ('contact_address_line1', '"P.O. Box 700"', NOW(), NOW()),
  ('contact_address_line2', '""', NOW(), NOW()),
  ('contact_city', '"Portland"', NOW(), NOW()),
  ('contact_state', '"TN"', NOW(), NOW()),
  ('contact_zip', '"37148"', NOW(), NOW())
ON CONFLICT (setting_key) DO NOTHING;

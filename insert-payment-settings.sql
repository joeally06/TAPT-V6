-- Insert payment email settings into existing site_settings table
-- Run this in Supabase SQL Editor to add payment email template variables

-- First, check if any payment settings already exist
-- You can run: SELECT * FROM site_settings WHERE setting_key LIKE 'payment_%';

-- Insert payment settings (will error if they already exist due to unique constraint)
INSERT INTO site_settings (id, setting_key, setting_value, created_at, updated_at) VALUES
  (gen_random_uuid(), 'payment_remittance_name', '"Tennessee Association of Pupil Transportation"', now(), now()),
  (gen_random_uuid(), 'payment_remittance_address_line1', '"123 Main Street"', now(), now()),
  (gen_random_uuid(), 'payment_remittance_address_line2', '"Suite 100"', now(), now()),
  (gen_random_uuid(), 'payment_remittance_city', '"Nashville"', now(), now()),
  (gen_random_uuid(), 'payment_remittance_state', '"TN"', now(), now()),
  (gen_random_uuid(), 'payment_remittance_zip', '"37201"', now(), now()),
  (gen_random_uuid(), 'payment_contact_email', '"info@tapt.org"', now(), now()),
  (gen_random_uuid(), 'payment_contact_phone', '"(615) 555-0100"', now(), now()),
  (gen_random_uuid(), 'payment_receipt_footer', '"Thank you for your payment. Please keep this receipt for your records."', now(), now()),
  (gen_random_uuid(), 'payment_receipt_subject', '"Payment Receipt - TAPT {{event_name}}"', now(), now())
ON CONFLICT (setting_key) DO NOTHING;

-- Verify the settings were inserted
SELECT setting_key, setting_value FROM site_settings WHERE setting_key LIKE 'payment_%' ORDER BY setting_key;

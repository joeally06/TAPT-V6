/*
  # Add Business Hours to Site Settings

  1. Changes
    - Add default entries for business hours days and time
    - These will be used in the Contact page and Footer
    
  2. Purpose
    - Allow admins to configure business hours displayed on the site
    - Maintain consistent contact information across the site
*/

-- Insert default business hours settings
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES 
  ('business_hours_days', to_jsonb('Monday – Friday'::text)),
  ('business_hours_time', to_jsonb('8:00 AM – 4:30 PM CST'::text))
ON CONFLICT (setting_key) DO NOTHING;
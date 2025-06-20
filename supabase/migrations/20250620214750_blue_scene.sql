-- Create site_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on site_settings table
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Allow public read access to site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow admin full access to site settings" ON public.site_settings;

-- Create policies
CREATE POLICY "Allow public read access to site settings"
  ON public.site_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow admin full access to site settings"
  ON public.site_settings
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

-- Insert a default hero image setting if it doesn't exist
-- Use to_jsonb to properly convert the string to JSONB format
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES ('hero_image_url', to_jsonb('https://images.pexels.com/photos/5905700/pexels-photo-5905700.jpeg'::text))
ON CONFLICT (setting_key) DO NOTHING;

-- Create or replace the function to update the updated_at column
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON public.site_settings;

-- Create the trigger
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION update_site_settings_updated_at();
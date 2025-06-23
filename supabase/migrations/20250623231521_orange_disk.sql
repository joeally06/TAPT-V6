/*
  # Create Exhibitor Registration Tables

  1. New Tables
    - `exhibitor_settings`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `start_date` (timestamptz, not null)
      - `end_date` (timestamptz, not null)
      - `registration_end_date` (timestamptz, not null)
      - `location` (text, not null)
      - `venue` (text, not null)
      - `fee` (numeric, not null)
      - `payment_instructions` (text, not null)
      - `description` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `is_active` (boolean)

    - `exhibitor_registrations`
      - `id` (uuid, primary key)
      - `business_name` (text, not null)
      - `first_name` (text, not null)
      - `last_name` (text, not null)
      - `street_address` (text, not null)
      - `street_address2` (text)
      - `city` (text, not null)
      - `state` (text, not null)
      - `zip_code` (text, not null)
      - `email` (text, not null)
      - `phone` (text, not null)
      - `mobile_phone` (text)
      - `booth_requirements` (text)
      - `products_description` (text)
      - `additional_comments` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `user_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on both tables
    - Add policies for admin access
    - Add policies for public read access to settings
*/

-- Create exhibitor settings table
CREATE TABLE IF NOT EXISTS exhibitor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  registration_end_date timestamptz NOT NULL,
  location text NOT NULL,
  venue text NOT NULL,
  fee numeric NOT NULL,
  payment_instructions text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create unique index to ensure only one active settings record
CREATE UNIQUE INDEX IF NOT EXISTS exhibitor_settings_active_idx 
ON exhibitor_settings (is_active) 
WHERE is_active = true;

-- Create exhibitor registrations table
CREATE TABLE IF NOT EXISTS exhibitor_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  street_address text NOT NULL,
  street_address2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  mobile_phone text,
  booth_requirements text,
  products_description text,
  additional_comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

-- Create exhibitor registrations archive table
CREATE TABLE IF NOT EXISTS exhibitor_registrations_archive (
  LIKE exhibitor_registrations INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_id uuid
);

-- Enable RLS on all tables
ALTER TABLE exhibitor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibitor_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibitor_registrations_archive ENABLE ROW LEVEL SECURITY;

-- Create policies for exhibitor_settings
CREATE POLICY "Allow admin to manage exhibitor settings"
  ON exhibitor_settings
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

CREATE POLICY "Allow public to read exhibitor settings"
  ON exhibitor_settings
  FOR SELECT
  TO public
  USING (true);

-- Create policies for exhibitor_registrations
CREATE POLICY "Allow admin full access to exhibitor registrations"
  ON exhibitor_registrations
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

CREATE POLICY "Users can read own exhibitor registrations"
  ON exhibitor_registrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policies for exhibitor_registrations_archive
CREATE POLICY "Admin users can access all archived exhibitor registrations"
  ON exhibitor_registrations_archive
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create updated_at triggers
CREATE TRIGGER update_exhibitor_settings_updated_at
  BEFORE UPDATE ON exhibitor_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exhibitor_registrations_updated_at
  BEFORE UPDATE ON exhibitor_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exhibitor_registrations_created_at
  ON exhibitor_registrations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exhibitor_registrations_email
  ON exhibitor_registrations (email);

CREATE INDEX IF NOT EXISTS idx_exhibitor_registrations_business_name
  ON exhibitor_registrations (business_name);

-- Function to archive exhibitor registrations
CREATE OR REPLACE FUNCTION archive_exhibitor_registrations()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archive_id uuid;
BEGIN
  -- Generate a new archive ID
  archive_id := gen_random_uuid();
  
  -- Copy registrations to archive
  INSERT INTO exhibitor_registrations_archive (
    SELECT r.*, now(), archive_id, r.id
    FROM exhibitor_registrations r
  );
  
  -- Clear main table
  DELETE FROM exhibitor_registrations;
  
  RETURN archive_id;
END;
$$;
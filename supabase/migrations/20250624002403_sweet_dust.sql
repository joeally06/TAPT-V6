-- Create student_scholarship_settings table
CREATE TABLE IF NOT EXISTS student_scholarship_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  application_deadline timestamptz NOT NULL,
  description text,
  eligibility_criteria text,
  instructions text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create student_scholarship_applications table
CREATE TABLE IF NOT EXISTS student_scholarship_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name jsonb NOT NULL,
  birthdate date NOT NULL,
  gender text,
  is_us_citizen boolean,
  application_status text NOT NULL,
  is_first_gen boolean,
  major_area text,
  career_objective text,
  high_school text NOT NULL,
  school_district text NOT NULL,
  graduation_year text NOT NULL,
  gpa text,
  activities text,
  act_year text,
  act_score text,
  essay text,
  home_address jsonb NOT NULL,
  mobile_phone text NOT NULL,
  email text NOT NULL,
  signature text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

-- Create student_scholarship_applications_archive table
CREATE TABLE IF NOT EXISTS student_scholarship_applications_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name jsonb NOT NULL,
  birthdate date NOT NULL,
  gender text,
  is_us_citizen boolean,
  application_status text NOT NULL,
  is_first_gen boolean,
  major_area text,
  career_objective text,
  high_school text NOT NULL,
  school_district text NOT NULL,
  graduation_year text NOT NULL,
  gpa text,
  activities text,
  act_year text,
  act_score text,
  essay text,
  home_address jsonb NOT NULL,
  mobile_phone text NOT NULL,
  email text NOT NULL,
  signature text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid,
  archived_at timestamptz DEFAULT now() NOT NULL,
  archive_id uuid NOT NULL,
  original_id uuid
);

-- Create unique index for active settings
CREATE UNIQUE INDEX student_scholarship_settings_active_idx ON student_scholarship_settings (is_active) WHERE (is_active = true);

-- Create index for archive dates
CREATE INDEX idx_student_scholarship_archive_dates ON student_scholarship_applications_archive (archived_at, created_at);

-- Create index for application dates
CREATE INDEX idx_student_scholarship_applications_created_at ON student_scholarship_applications (created_at DESC);

-- Create index for email search
CREATE INDEX idx_student_scholarship_applications_email ON student_scholarship_applications (email);

-- Enable Row Level Security
ALTER TABLE student_scholarship_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scholarship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scholarship_applications_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for student_scholarship_settings
CREATE POLICY "Allow admin to manage scholarship settings" 
  ON student_scholarship_settings
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Allow public to read scholarship settings" 
  ON student_scholarship_settings
  FOR SELECT
  TO public
  USING (true);

-- Create RLS policies for student_scholarship_applications
CREATE POLICY "Allow admin full access to scholarship applications" 
  ON student_scholarship_applications
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Allow public to insert scholarship applications" 
  ON student_scholarship_applications
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow users to read own scholarship applications" 
  ON student_scholarship_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create RLS policies for student_scholarship_applications_archive
CREATE POLICY "Admin users can access all archived scholarship applications" 
  ON student_scholarship_applications_archive
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_student_scholarship_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_scholarship_settings_updated_at
BEFORE UPDATE ON student_scholarship_settings
FOR EACH ROW
EXECUTE FUNCTION update_student_scholarship_settings_updated_at();

CREATE OR REPLACE FUNCTION update_student_scholarship_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_scholarship_applications_updated_at
BEFORE UPDATE ON student_scholarship_applications
FOR EACH ROW
EXECUTE FUNCTION update_student_scholarship_applications_updated_at();
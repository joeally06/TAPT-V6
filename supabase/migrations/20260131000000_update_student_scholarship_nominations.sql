-- Migration: Update Student Scholarship Applications for Nomination-Based System
-- Date: 2026-01-31
-- Description: Transform student scholarship applications from self-application to nomination-based system
--              where transportation directors nominate students for scholarships

-- Step 1: Add new nominator fields
ALTER TABLE student_scholarship_applications
ADD COLUMN IF NOT EXISTS nominator_first_name TEXT,
ADD COLUMN IF NOT EXISTS nominator_last_name TEXT,
ADD COLUMN IF NOT EXISTS nominator_title TEXT,
ADD COLUMN IF NOT EXISTS nominator_email TEXT,
ADD COLUMN IF NOT EXISTS nominator_phone TEXT,
ADD COLUMN IF NOT EXISTS nominator_district TEXT,
ADD COLUMN IF NOT EXISTS region TEXT;

-- Step 2: Add check constraint for region values (East, Middle, West Tennessee)
ALTER TABLE student_scholarship_applications
ADD CONSTRAINT valid_region CHECK (region IS NULL OR region IN ('East', 'Middle', 'West'));

-- Step 3: Make previously required fields nullable (these are being removed from the form)
-- Keep the columns for historical data but allow NULL for new submissions
ALTER TABLE student_scholarship_applications
ALTER COLUMN birthdate DROP NOT NULL,
ALTER COLUMN gender DROP NOT NULL,
ALTER COLUMN is_us_citizen DROP NOT NULL,
ALTER COLUMN is_first_gen DROP NOT NULL,
ALTER COLUMN major_area DROP NOT NULL,
ALTER COLUMN career_objective DROP NOT NULL,
ALTER COLUMN gpa DROP NOT NULL,
ALTER COLUMN activities DROP NOT NULL,
ALTER COLUMN act_year DROP NOT NULL,
ALTER COLUMN act_score DROP NOT NULL,
ALTER COLUMN application_status DROP NOT NULL,
ALTER COLUMN signature DROP NOT NULL;

-- Step 4: Make student contact info optional
ALTER TABLE student_scholarship_applications
ALTER COLUMN mobile_phone DROP NOT NULL;

-- Note: email remains required as it's used for rate limiting and contact

-- Step 5: Create index for region filtering (for admin queries)
CREATE INDEX IF NOT EXISTS idx_student_scholarship_applications_region 
ON student_scholarship_applications(region);

-- Step 6: Create index for nominator email (for duplicate checks)
CREATE INDEX IF NOT EXISTS idx_student_scholarship_applications_nominator_email 
ON student_scholarship_applications(nominator_email);

-- Step 7: Add comment to table explaining the new nomination system
COMMENT ON TABLE student_scholarship_applications IS 
'Student scholarship nominations submitted by transportation directors. 
As of 2026, this is a nomination-based system where directors nominate students rather than students self-applying.
Historical records from self-application system are preserved with nullable fields.';

-- Step 8: Add comments to new columns
COMMENT ON COLUMN student_scholarship_applications.nominator_first_name IS 'First name of the transportation director nominating the student';
COMMENT ON COLUMN student_scholarship_applications.nominator_last_name IS 'Last name of the transportation director nominating the student';
COMMENT ON COLUMN student_scholarship_applications.nominator_title IS 'Job title/position of the nominator (e.g., Director of Transportation)';
COMMENT ON COLUMN student_scholarship_applications.nominator_email IS 'Email address of the nominator for confirmation and communication';
COMMENT ON COLUMN student_scholarship_applications.nominator_phone IS 'Phone number of the nominator';
COMMENT ON COLUMN student_scholarship_applications.nominator_district IS 'School district of the nominator';
COMMENT ON COLUMN student_scholarship_applications.region IS 'Tennessee region: East, Middle, or West';

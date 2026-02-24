-- Add approval/rejection workflow columns to student_scholarship_applications
ALTER TABLE student_scholarship_applications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_verified_by uuid,
  ADD COLUMN IF NOT EXISTS admin_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_student_scholarship_status ON student_scholarship_applications(status);

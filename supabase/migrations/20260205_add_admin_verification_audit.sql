-- Add admin verification audit columns to hall_of_fame_nominations table
-- Records who verified the nomination and when

ALTER TABLE hall_of_fame_nominations 
ADD COLUMN IF NOT EXISTS admin_verified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS admin_verified_at timestamptz;

-- Add comments for documentation
COMMENT ON COLUMN hall_of_fame_nominations.admin_verified_by IS 'The admin user who verified and approved this nomination';
COMMENT ON COLUMN hall_of_fame_nominations.admin_verified_at IS 'Timestamp when the admin verified and approved this nomination';

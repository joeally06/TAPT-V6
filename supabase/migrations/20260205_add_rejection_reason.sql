-- Add rejection reason column to hall_of_fame_nominations table
-- Stores the reason when a nomination is rejected

ALTER TABLE hall_of_fame_nominations 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add comment for documentation
COMMENT ON COLUMN hall_of_fame_nominations.rejection_reason IS 'The reason provided by admin when rejecting a nomination';

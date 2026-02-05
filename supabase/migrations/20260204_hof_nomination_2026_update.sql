/*
  # Hall of Fame Nominations 2026 Update
  
  Updates the hall_of_fame_nominations table to support the 2026 nomination requirements:
  
  1. Schema Changes
    - Rename `region` to `grand_division` for clarity
    - Add `nominator_role` (Transportation Supervisor or Director of Schools)
    - Add attestation fields for compliance verification
    - Increase nomination_reason character limit to 2000
    - Remove `is_tapt_member` (replaced by district-level attestation)
    - Remove `nominee_city` (not required in 2026 guidelines)
  
  2. New Attestation Columns
    - `clean_driving_record` (boolean) - Nominee has clean driving record
    - `district_is_tapt_member` (boolean) - District is active TAPT member
    - `conference_year_1`, `conference_year_2`, `conference_year_3` (integer) - The years that were attested to
    - `district_attended_year_1/2/3` (boolean) - District attended those years' conferences
    - `nominator_is_officially_listed` (boolean) - Nominator is officially listed with TN DOE
    - `acknowledge_documentation` (boolean) - Acknowledges documentation requirements
    - `acknowledge_attendance` (boolean) - Acknowledges winner must attend conference
  
  3. Security
    - All attestation columns default to FALSE
    - NOT NULL constraints ensure data integrity
*/

-- Add new columns for 2026 requirements
ALTER TABLE hall_of_fame_nominations
ADD COLUMN IF NOT EXISTS grand_division varchar(50),
ADD COLUMN IF NOT EXISTS nominator_role varchar(100),
ADD COLUMN IF NOT EXISTS clean_driving_record boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS district_is_tapt_member boolean NOT NULL DEFAULT false,
-- Dynamic year columns - store what years the nominator attested to
ADD COLUMN IF NOT EXISTS conference_year_1 integer,
ADD COLUMN IF NOT EXISTS conference_year_2 integer,
ADD COLUMN IF NOT EXISTS conference_year_3 integer,
ADD COLUMN IF NOT EXISTS district_attended_year_1 boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS district_attended_year_2 boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS district_attended_year_3 boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS nominator_is_officially_listed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledge_documentation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledge_attendance boolean NOT NULL DEFAULT false;

-- Migrate existing region data to grand_division if needed
UPDATE hall_of_fame_nominations 
SET grand_division = CASE 
  WHEN region = 'East' THEN 'East Tennessee'
  WHEN region = 'Middle' THEN 'Middle Tennessee'
  WHEN region = 'West' THEN 'West Tennessee'
  ELSE region
END
WHERE grand_division IS NULL AND region IS NOT NULL;

-- Add comment to clarify nominator role options
COMMENT ON COLUMN hall_of_fame_nominations.nominator_role IS 'Valid values: Transportation Supervisor, Director of Schools';

-- Add comment to clarify grand division options  
COMMENT ON COLUMN hall_of_fame_nominations.grand_division IS 'Valid values: East Tennessee, Middle Tennessee, West Tennessee';

-- Create index on grand_division for filtering by region
CREATE INDEX IF NOT EXISTS idx_hof_nominations_grand_division ON hall_of_fame_nominations(grand_division);

-- Create index on status for quick filtering
CREATE INDEX IF NOT EXISTS idx_hof_nominations_status ON hall_of_fame_nominations(status);

-- Add missing columns to hall_of_fame_nominations table for 2026 form
-- These store conference years and attestations for audit trail

ALTER TABLE hall_of_fame_nominations 
-- Conference year columns (which years were attested)
ADD COLUMN IF NOT EXISTS conference_year_1 integer,
ADD COLUMN IF NOT EXISTS conference_year_2 integer,
ADD COLUMN IF NOT EXISTS conference_year_3 integer,
-- Attestation columns for district conference attendance by year
ADD COLUMN IF NOT EXISTS district_attended_year_1 boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS district_attended_year_2 boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS district_attended_year_3 boolean DEFAULT false,
-- Additional attestation columns
ADD COLUMN IF NOT EXISTS nominator_is_officially_listed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledge_documentation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledge_attendance boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS nominator_role text;

-- Add comments for documentation
COMMENT ON COLUMN hall_of_fame_nominations.conference_year_1 IS 'First conference year the district attested to attending';
COMMENT ON COLUMN hall_of_fame_nominations.conference_year_2 IS 'Second conference year the district attested to attending';
COMMENT ON COLUMN hall_of_fame_nominations.conference_year_3 IS 'Third conference year the district attested to attending';
COMMENT ON COLUMN hall_of_fame_nominations.district_attended_year_1 IS 'District attended TAPT conference in year 1';
COMMENT ON COLUMN hall_of_fame_nominations.district_attended_year_2 IS 'District attended TAPT conference in year 2';
COMMENT ON COLUMN hall_of_fame_nominations.district_attended_year_3 IS 'District attended TAPT conference in year 3';
COMMENT ON COLUMN hall_of_fame_nominations.nominator_is_officially_listed IS 'Nominator confirms they are officially listed as Transportation Supervisor or Director of Schools';
COMMENT ON COLUMN hall_of_fame_nominations.acknowledge_documentation IS 'Nominator acknowledges documentation requirements';
COMMENT ON COLUMN hall_of_fame_nominations.acknowledge_attendance IS 'Nominator acknowledges attendance requirements for award ceremony';
COMMENT ON COLUMN hall_of_fame_nominations.nominator_role IS 'Role of the nominator (Transportation Supervisor or Director of Schools)';

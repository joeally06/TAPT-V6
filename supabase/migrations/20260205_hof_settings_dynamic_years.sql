-- Add dynamic year configuration to hall_of_fame_settings
-- This allows admins to configure which years appear in the nomination form

-- Add conference attendance year columns (3 consecutive years required)
ALTER TABLE hall_of_fame_settings 
ADD COLUMN IF NOT EXISTS conference_year_1 integer NOT NULL DEFAULT 2023,
ADD COLUMN IF NOT EXISTS conference_year_2 integer NOT NULL DEFAULT 2024,
ADD COLUMN IF NOT EXISTS conference_year_3 integer NOT NULL DEFAULT 2025,
ADD COLUMN IF NOT EXISTS award_year integer NOT NULL DEFAULT 2026;

-- Add comments for documentation
COMMENT ON COLUMN hall_of_fame_settings.conference_year_1 IS 'First year of required conference attendance';
COMMENT ON COLUMN hall_of_fame_settings.conference_year_2 IS 'Second year of required conference attendance';
COMMENT ON COLUMN hall_of_fame_settings.conference_year_3 IS 'Third year of required conference attendance';
COMMENT ON COLUMN hall_of_fame_settings.award_year IS 'Year the award will be presented at the TAPT Annual Conference';

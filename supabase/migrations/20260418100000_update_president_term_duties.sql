-- Update Term & Duties Acknowledgement section for President Nominations
-- Replace acknowledge_term / acknowledge_duties with three specific attestations
-- Add adjustable term_duration to settings

-- Add term_duration to settings
ALTER TABLE president_nomination_settings
ADD COLUMN IF NOT EXISTS term_duration varchar(100) DEFAULT '3';

-- Add new attestation columns
ALTER TABLE president_nominations
ADD COLUMN IF NOT EXISTS elected_by_membership boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS serves_term boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS understands_commitment boolean NOT NULL DEFAULT false;

-- Drop old columns
ALTER TABLE president_nominations
DROP COLUMN IF EXISTS acknowledge_term,
DROP COLUMN IF EXISTS acknowledge_duties;

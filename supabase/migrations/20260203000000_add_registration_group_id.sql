-- Migration: Add selected_regions JSONB array for multi-region registrations
-- This stores multiple regions in a single row instead of creating separate rows
-- Created: 2026-02-03

-- Add new column for storing multiple regions as JSONB array
ALTER TABLE regional_luncheon_registrations 
ADD COLUMN IF NOT EXISTS selected_regions JSONB DEFAULT '[]'::jsonb;

-- Migrate existing data: Convert preferred_region to array format
-- This preserves backward compatibility with existing single-region registrations
UPDATE regional_luncheon_registrations 
SET selected_regions = jsonb_build_array(preferred_region)
WHERE (selected_regions IS NULL OR selected_regions = '[]'::jsonb)
  AND preferred_region IS NOT NULL;

-- Add GIN index for efficient JSONB array queries (e.g., "find all registrations containing 'East Region'")
CREATE INDEX IF NOT EXISTS idx_regional_luncheon_selected_regions 
ON regional_luncheon_registrations USING GIN (selected_regions);

-- Add index for email lookups (useful for checking existing registrations)
CREATE INDEX IF NOT EXISTS idx_regional_luncheon_registrations_email 
ON regional_luncheon_registrations(email);

-- Add composite index for duplicate checking (email + event_id)
-- This helps prevent the same person from registering twice for the same event
CREATE INDEX IF NOT EXISTS idx_regional_luncheon_registrations_email_event 
ON regional_luncheon_registrations(email, event_id);

-- Add index on event_id for filtering registrations by event
CREATE INDEX IF NOT EXISTS idx_regional_luncheon_registrations_event_id 
ON regional_luncheon_registrations(event_id);

-- Add check constraint to ensure selected_regions is an array (not null, object, etc.)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_selected_regions_is_array'
  ) THEN
    ALTER TABLE regional_luncheon_registrations
    ADD CONSTRAINT chk_selected_regions_is_array 
    CHECK (selected_regions IS NULL OR jsonb_typeof(selected_regions) = 'array');
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN regional_luncheon_registrations.selected_regions IS 
'JSONB array of region names the user registered for. Example: ["East Region", "Middle Region", "West Region"]. Single row per registration, even for multiple regions.';

-- Note: preferred_region column is kept for backward compatibility with existing reports/queries
-- It will store the first selected region for legacy support

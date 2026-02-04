-- Migration: Consolidate existing multi-row registrations into single rows with JSONB array
-- This merges registrations with the same email + event_id into one row
-- Created: 2026-02-03

-- Step 1: Create a temp table with aggregated regions per email+event
CREATE TEMP TABLE aggregated_regions AS
SELECT 
  LOWER(email) as email_lower,
  event_id,
  jsonb_agg(DISTINCT preferred_region) as all_regions
FROM regional_luncheon_registrations
WHERE preferred_region IS NOT NULL
GROUP BY LOWER(email), event_id;

-- Step 2: Create a temp table identifying which registration to keep (earliest) for each email+event
CREATE TEMP TABLE registrations_to_keep AS
SELECT DISTINCT ON (LOWER(email), event_id)
  id,
  LOWER(email) as email_lower,
  event_id
FROM regional_luncheon_registrations
ORDER BY LOWER(email), event_id, created_at ASC;

-- Step 3: Update the kept registrations with consolidated regions
UPDATE regional_luncheon_registrations r
SET selected_regions = ar.all_regions
FROM registrations_to_keep rtk
JOIN aggregated_regions ar ON rtk.email_lower = ar.email_lower 
  AND (rtk.event_id = ar.event_id OR (rtk.event_id IS NULL AND ar.event_id IS NULL))
WHERE r.id = rtk.id;

-- Step 4: Delete duplicate registrations (those not in registrations_to_keep)
DELETE FROM regional_luncheon_registrations
WHERE id NOT IN (SELECT id FROM registrations_to_keep);

-- Step 5: Ensure any remaining single registrations have selected_regions populated
UPDATE regional_luncheon_registrations
SET selected_regions = jsonb_build_array(preferred_region)
WHERE (selected_regions IS NULL OR selected_regions = '[]'::jsonb)
  AND preferred_region IS NOT NULL;

-- Step 6: Clean up temp tables
DROP TABLE aggregated_regions;
DROP TABLE registrations_to_keep;

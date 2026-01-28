-- Add year_taken field to conference_gallery_images
-- This allows tagging photos with the year they were taken, independent of conference_settings
-- Useful for uploading historical photos without creating full conference records

ALTER TABLE conference_gallery_images
ADD COLUMN year_taken INTEGER CHECK (year_taken >= 1900 AND year_taken <= 2100);

-- Add index for year-based queries
CREATE INDEX idx_conference_gallery_year_taken 
  ON conference_gallery_images(year_taken) 
  WHERE year_taken IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN conference_gallery_images.year_taken IS 
  'Optional override for the year these photos were taken. If null, use the conference year from conference_settings.';

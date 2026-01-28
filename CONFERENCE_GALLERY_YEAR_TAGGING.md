# Conference Gallery Year Tagging Feature

## Overview
The conference gallery now supports tagging photos with a specific year they were taken, independent of the conference record. This is especially useful for uploading historical photos from past conferences.

## How It Works

### Database Schema
A new `year_taken` column has been added to the `conference_gallery_images` table:
- **Type**: Integer (nullable)
- **Range**: 1900 to 2100
- **Purpose**: Override the conference year for historical photos
- **Behavior**: If null, the photo is associated with the conference's year. If specified, this year is displayed instead.

### Admin Upload Interface
When uploading photos in the Gallery Management admin page:

1. **Select Image**: Choose the photo file to upload
2. **Year Taken (Optional)**: Enter the year the photo was actually taken
   - Leave blank to use the conference year
   - Enter a specific year (e.g., 2015) for historical photos
   - Accepts years from 1900 to 2100

### Public Display
On the public conference gallery page:
- Photos display in the grid with their thumbnails
- When viewing a photo in the lightbox, the year is shown if specified:
  - "Photo X of Y • Year: 2015 • Uploaded MM/DD/YYYY"

## Use Cases

### Example 1: Current Conference Photos
Uploading photos for the active 2026 conference:
- **Year Taken**: Leave blank
- **Result**: Photos are associated with the 2026 conference

### Example 2: Historical Archive Photos
Uploading photos from the 2010 conference:
1. Create or select a conference record for 2010
2. Upload photos and enter **Year Taken: 2010**
3. Photos are correctly tagged as 2010, even if uploaded in 2026

### Example 3: Mixed Year Gallery
You can create a conference record and upload photos from multiple years:
- Conference: "50th Anniversary Gallery"
- Upload photos from 1975, 1985, 1995, etc., each tagged with their respective years

## Implementation Details

### Migration
File: `supabase/migrations/20260128000000_add_gallery_year_taken.sql`
- Adds `year_taken` column with validation constraint
- Creates index for efficient year-based queries
- Adds documentation comment

### Code Changes
1. **conferenceGallery.ts**
   - Updated `GalleryImage` interface to include `year_taken?: number`
   - Modified `uploadConferenceImage()` to accept `yearTaken` parameter
   - Updated `saveImageMetadata()` to store year in database

2. **AdminConferenceGallery.tsx**
   - Added year input field in upload form
   - Displays year in image metadata grid
   - Highlights year in blue for easy identification

3. **ConferenceGallery.tsx**
   - Shows year in lightbox metadata when viewing full-size photo
   - Format: "Year: YYYY"

## Benefits

1. **Flexibility**: Upload historical photos without creating full conference records
2. **Accuracy**: Tag photos with their actual year, not when they were uploaded
3. **Organization**: Build archives spanning multiple decades
4. **User-Friendly**: Optional field - only fill it out when needed

## Database Query

To apply the migration manually via Supabase Dashboard:

```sql
-- Add year_taken field to conference_gallery_images
ALTER TABLE conference_gallery_images
ADD COLUMN year_taken INTEGER CHECK (year_taken >= 1900 AND year_taken <= 2100);

-- Add index for year-based queries
CREATE INDEX idx_conference_gallery_year_taken 
  ON conference_gallery_images(year_taken) 
  WHERE year_taken IS NOT NULL;

-- Add comment
COMMENT ON COLUMN conference_gallery_images.year_taken IS 
  'Optional override for the year these photos were taken. If null, use the conference year from conference_settings.';
```

## Future Enhancements (Optional)

- **Year Filter**: Add dropdown to filter gallery by year
- **Bulk Year Update**: Allow updating year for multiple photos at once
- **Year Validation**: Warn if year is in the future
- **Smart Defaults**: Pre-fill year based on EXIF data from photo metadata

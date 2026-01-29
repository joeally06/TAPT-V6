/*
  # Add file support to content table

  1. Changes
    - Add `file_url` column to store file URLs
    - Add `file_type` column to store MIME type
    - Add `file_size` column to store file size in bytes
  
  2. Security
    - Maintains existing RLS policies
    - Files stored in public bucket with proper validation
*/

-- Add file support columns to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_type text,
ADD COLUMN IF NOT EXISTS file_size bigint;

-- Add comment for documentation
COMMENT ON COLUMN content.file_url IS 'URL to associated file in Supabase storage (for announcements with attachments)';
COMMENT ON COLUMN content.file_type IS 'MIME type of the attached file';
COMMENT ON COLUMN content.file_size IS 'Size of the attached file in bytes';

-- Conference Photo Albums
-- Lightweight albums for organizing conference photos by name and year
-- Replaces dependency on conference_settings for gallery organization

CREATE TABLE IF NOT EXISTS conference_photo_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2100),
  description TEXT,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_visible BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(name, year)
);

-- Index for year-based queries
CREATE INDEX idx_photo_albums_year ON conference_photo_albums(year DESC);
CREATE INDEX idx_photo_albums_visible ON conference_photo_albums(is_visible, year DESC);

-- Updated timestamp trigger
CREATE TRIGGER update_photo_albums_updated_at
  BEFORE UPDATE ON conference_photo_albums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE conference_photo_albums ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for visible albums
CREATE POLICY "Photo albums are publicly readable if visible"
  ON conference_photo_albums
  FOR SELECT
  USING (is_visible = true);

-- RLS Policy: Admin-only management
CREATE POLICY "Only admins can manage photo albums"
  ON conference_photo_albums
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Migrate existing gallery images to use album system
-- First, create albums from existing conference_settings that have gallery images
INSERT INTO conference_photo_albums (id, name, year, description, display_order)
SELECT DISTINCT 
  cs.id,
  cs.name,
  EXTRACT(YEAR FROM cs.start_date)::INTEGER,
  cs.description,
  0
FROM conference_settings cs
INNER JOIN conference_gallery_images cgi ON cgi.conference_id = cs.id
WHERE cs.id NOT IN (SELECT id FROM conference_photo_albums)
ON CONFLICT (name, year) DO NOTHING;

-- Rename conference_id to album_id for clarity
ALTER TABLE conference_gallery_images 
  RENAME COLUMN conference_id TO album_id;

-- Update foreign key constraint
ALTER TABLE conference_gallery_images
  DROP CONSTRAINT IF EXISTS conference_gallery_images_conference_id_fkey;

ALTER TABLE conference_gallery_images
  ADD CONSTRAINT conference_gallery_images_album_id_fkey
  FOREIGN KEY (album_id) REFERENCES conference_photo_albums(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_conference_gallery_conference_id;
CREATE INDEX idx_conference_gallery_album_id ON conference_gallery_images(album_id);

DROP INDEX IF EXISTS idx_conference_gallery_display_order;
CREATE INDEX idx_conference_gallery_display_order ON conference_gallery_images(album_id, display_order);

-- Remove year_taken column since album now has the year
ALTER TABLE conference_gallery_images DROP COLUMN IF EXISTS year_taken;

-- Add comment
COMMENT ON TABLE conference_photo_albums IS 
  'Photo albums for conference galleries. Each album has a name and year, independent of conference_settings.';

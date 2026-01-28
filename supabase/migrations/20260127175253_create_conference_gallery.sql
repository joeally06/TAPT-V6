-- Conference Gallery Images Table
-- Stores photo gallery for each conference with compressed images and thumbnails
-- Implements RLS for public read, admin-only write access

CREATE TABLE IF NOT EXISTS conference_gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conference_settings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  caption TEXT CHECK (length(caption) <= 500),
  display_order INTEGER DEFAULT 0 NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_conference_gallery_conference_id 
  ON conference_gallery_images(conference_id);

CREATE INDEX idx_conference_gallery_display_order 
  ON conference_gallery_images(conference_id, display_order);

CREATE INDEX idx_conference_gallery_created_at 
  ON conference_gallery_images(created_at DESC);

-- Updated timestamp trigger
CREATE TRIGGER update_conference_gallery_images_updated_at
  BEFORE UPDATE ON conference_gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE conference_gallery_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
-- Anyone can view gallery images
CREATE POLICY "Gallery images are publicly readable"
  ON conference_gallery_images
  FOR SELECT
  USING (true);

-- RLS Policy: Admin-only insert
-- Only authenticated admin users can upload images
CREATE POLICY "Only admins can upload gallery images"
  ON conference_gallery_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Admin-only update
-- Only authenticated admin users can update captions/order
CREATE POLICY "Only admins can update gallery images"
  ON conference_gallery_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Admin-only delete
-- Only authenticated admin users can delete images
CREATE POLICY "Only admins can delete gallery images"
  ON conference_gallery_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Comments for documentation
COMMENT ON TABLE conference_gallery_images IS 'Photo gallery for conference events with compressed images and thumbnails';
COMMENT ON COLUMN conference_gallery_images.image_url IS 'Public URL to full-size compressed image (1920px max, ~500KB)';
COMMENT ON COLUMN conference_gallery_images.thumbnail_url IS 'Public URL to thumbnail (400px max, ~50KB)';
COMMENT ON COLUMN conference_gallery_images.file_size_bytes IS 'Size of compressed full image in bytes';
COMMENT ON COLUMN conference_gallery_images.caption IS 'Optional caption text (max 500 chars, HTML stripped)';
COMMENT ON COLUMN conference_gallery_images.display_order IS 'Sort order for gallery display (lower numbers first)';

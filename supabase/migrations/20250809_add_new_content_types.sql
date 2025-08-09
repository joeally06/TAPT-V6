-- Update content type constraint to include new types
ALTER TABLE content DROP CONSTRAINT IF EXISTS valid_content_type;

ALTER TABLE content ADD CONSTRAINT valid_content_type CHECK (
  type IN ('event', 'announcement', 'resource', 'news', 'links', 'resources-page')
);

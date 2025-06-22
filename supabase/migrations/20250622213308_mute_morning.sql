-- Add linked_form_type column to content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS linked_form_type text;

-- Add check constraint to ensure valid form types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_linked_form_type'
  ) THEN
    ALTER TABLE content ADD CONSTRAINT valid_linked_form_type 
      CHECK (linked_form_type IS NULL OR linked_form_type = ANY (ARRAY['conference', 'tech-conference', 'hall-of-fame']));
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_linked_form_type ON content(linked_form_type) WHERE linked_form_type IS NOT NULL;
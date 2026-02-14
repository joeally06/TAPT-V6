-- Add external_url column to resources table for external link resources
ALTER TABLE resources ADD COLUMN IF NOT EXISTS external_url TEXT DEFAULT NULL;

-- Make file columns nullable so external link resources don't need files
ALTER TABLE resources ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE resources ALTER COLUMN file_type DROP NOT NULL;
ALTER TABLE resources ALTER COLUMN file_size DROP NOT NULL;

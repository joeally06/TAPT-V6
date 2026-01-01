-- Migration: Add request_id tracking to audit logs
-- Description: Adds request_id column to admin_logs table for request tracing
-- Created: 2026-01-01

-- Add request_id column to admin_logs table
ALTER TABLE admin_logs 
ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Add index for faster request_id lookups
CREATE INDEX IF NOT EXISTS idx_admin_logs_request_id 
ON admin_logs(request_id) 
WHERE request_id IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN admin_logs.request_id IS 'Unique identifier for tracking requests across frontend and backend';

-- Update existing rows to have a placeholder (optional - can be left NULL)
-- UPDATE admin_logs SET request_id = 'migration_' || id::text WHERE request_id IS NULL;

-- Display summary
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added request_id column to admin_logs table';
  RAISE NOTICE 'Index created: idx_admin_logs_request_id';
END $$;

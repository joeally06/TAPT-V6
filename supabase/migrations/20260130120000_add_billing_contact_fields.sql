-- Migration: Add billing contact fields to conference registration tables
-- Purpose: Separate billing/invoice contact from attendee information
-- This allows bookkeepers/finance directors to receive invoices while attendees receive event details

-- Add billing contact fields to conference_registrations
ALTER TABLE conference_registrations
ADD COLUMN IF NOT EXISTS billing_first_name text,
ADD COLUMN IF NOT EXISTS billing_last_name text,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_phone text,
ADD COLUMN IF NOT EXISTS registrant_is_attendee boolean DEFAULT true;

-- Add billing contact fields to tech_conference_registrations
ALTER TABLE tech_conference_registrations
ADD COLUMN IF NOT EXISTS billing_first_name text,
ADD COLUMN IF NOT EXISTS billing_last_name text,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_phone text,
ADD COLUMN IF NOT EXISTS registrant_is_attendee boolean DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN conference_registrations.billing_first_name IS 'First name of person handling registration/payment (may differ from attendee)';
COMMENT ON COLUMN conference_registrations.billing_last_name IS 'Last name of person handling registration/payment';
COMMENT ON COLUMN conference_registrations.billing_email IS 'Email for invoices and payment confirmations';
COMMENT ON COLUMN conference_registrations.billing_phone IS 'Phone number for billing contact';
COMMENT ON COLUMN conference_registrations.registrant_is_attendee IS 'True if the billing contact is also the primary attendee';

COMMENT ON COLUMN tech_conference_registrations.billing_first_name IS 'First name of person handling registration/payment (may differ from attendee)';
COMMENT ON COLUMN tech_conference_registrations.billing_last_name IS 'Last name of person handling registration/payment';
COMMENT ON COLUMN tech_conference_registrations.billing_email IS 'Email for invoices and payment confirmations';
COMMENT ON COLUMN tech_conference_registrations.billing_phone IS 'Phone number for billing contact';
COMMENT ON COLUMN tech_conference_registrations.registrant_is_attendee IS 'True if the billing contact is also the primary attendee';

-- Create indexes for billing email lookups (useful for invoice queries)
CREATE INDEX IF NOT EXISTS idx_conference_registrations_billing_email 
ON conference_registrations(billing_email) 
WHERE billing_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tech_conference_registrations_billing_email 
ON tech_conference_registrations(billing_email) 
WHERE billing_email IS NOT NULL;

-- Backfill existing records: set billing fields from existing contact info
-- This ensures backward compatibility with existing registrations
UPDATE conference_registrations
SET 
  billing_first_name = first_name,
  billing_last_name = last_name,
  billing_email = email,
  billing_phone = phone,
  registrant_is_attendee = true
WHERE billing_email IS NULL;

UPDATE tech_conference_registrations
SET 
  billing_first_name = first_name,
  billing_last_name = last_name,
  billing_email = email,
  billing_phone = phone,
  registrant_is_attendee = true
WHERE billing_email IS NULL;

-- Add payment fields to archive tables that are missing them

-- Add payment fields to tech_conference_registrations_archive
ALTER TABLE tech_conference_registrations_archive 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('po', 'paypal')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add payment fields to conference_registrations_archive
ALTER TABLE conference_registrations_archive 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('po', 'paypal')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add payment fields to exhibitor_registrations_archive
ALTER TABLE exhibitor_registrations_archive 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('po', 'paypal')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

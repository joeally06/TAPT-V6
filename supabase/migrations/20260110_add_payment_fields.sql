-- Add payment fields to conference_registrations
ALTER TABLE conference_registrations 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('po', 'paypal')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add payment fields to tech_conference_registrations
ALTER TABLE tech_conference_registrations 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('po', 'paypal')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add payment fields to exhibitor_registrations
ALTER TABLE exhibitor_registrations 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('po', 'paypal')),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS paypal_payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Add indexes for payment lookups
CREATE INDEX IF NOT EXISTS idx_conference_payment_status ON conference_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_conference_payment_method ON conference_registrations(payment_method);
CREATE INDEX IF NOT EXISTS idx_tech_conference_payment_status ON tech_conference_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_tech_conference_payment_method ON tech_conference_registrations(payment_method);
CREATE INDEX IF NOT EXISTS idx_exhibitor_payment_status ON exhibitor_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_exhibitor_payment_method ON exhibitor_registrations(payment_method);

-- Add indexes for PayPal transaction lookups
CREATE INDEX IF NOT EXISTS idx_conference_paypal_transaction ON conference_registrations(paypal_transaction_id) WHERE paypal_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tech_conference_paypal_transaction ON tech_conference_registrations(paypal_transaction_id) WHERE paypal_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exhibitor_paypal_transaction ON exhibitor_registrations(paypal_transaction_id) WHERE paypal_transaction_id IS NOT NULL;

-- Comment on payment columns
COMMENT ON COLUMN conference_registrations.payment_method IS 'Payment method used: po (Purchase Order) or paypal';
COMMENT ON COLUMN conference_registrations.payment_status IS 'Current payment status: pending, completed, failed, or refunded';
COMMENT ON COLUMN conference_registrations.po_number IS 'Purchase Order number if payment_method is po';
COMMENT ON COLUMN conference_registrations.paypal_transaction_id IS 'PayPal transaction ID if payment_method is paypal';
COMMENT ON COLUMN conference_registrations.paypal_payer_email IS 'PayPal payer email address';
COMMENT ON COLUMN conference_registrations.payment_completed_at IS 'Timestamp when payment was completed (for PayPal payments)';

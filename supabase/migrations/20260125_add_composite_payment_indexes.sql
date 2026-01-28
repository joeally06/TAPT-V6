-- Add composite indexes for payment management queries
-- These indexes optimize the query: WHERE payment_method = 'po' AND payment_status = 'pending'

-- Drop old single-column indexes and create better composite indexes
DROP INDEX IF EXISTS idx_conference_payment_status;
DROP INDEX IF EXISTS idx_conference_payment_method;
DROP INDEX IF EXISTS idx_tech_conference_payment_status;
DROP INDEX IF EXISTS idx_tech_conference_payment_method;
DROP INDEX IF EXISTS idx_exhibitor_payment_status;
DROP INDEX IF EXISTS idx_exhibitor_payment_method;

-- Conference registrations: composite index for pending PO payments
CREATE INDEX IF NOT EXISTS idx_conference_pending_po_payments 
ON conference_registrations(payment_method, payment_status, created_at DESC)
WHERE payment_method = 'po' AND payment_status = 'pending';

-- Conference registrations: general payment lookups
CREATE INDEX IF NOT EXISTS idx_conference_payment_lookup 
ON conference_registrations(payment_status, payment_method, created_at DESC);

-- Tech conference registrations: composite index for pending PO payments
CREATE INDEX IF NOT EXISTS idx_tech_conference_pending_po_payments 
ON tech_conference_registrations(payment_method, payment_status, created_at DESC)
WHERE payment_method = 'po' AND payment_status = 'pending';

-- Tech conference registrations: general payment lookups
CREATE INDEX IF NOT EXISTS idx_tech_conference_payment_lookup 
ON tech_conference_registrations(payment_status, payment_method, created_at DESC);

-- Exhibitor registrations: composite index for pending PO payments
CREATE INDEX IF NOT EXISTS idx_exhibitor_pending_po_payments 
ON exhibitor_registrations(payment_method, payment_status, created_at DESC)
WHERE payment_method = 'po' AND payment_status = 'pending';

-- Exhibitor registrations: general payment lookups
CREATE INDEX IF NOT EXISTS idx_exhibitor_payment_lookup 
ON exhibitor_registrations(payment_status, payment_method, created_at DESC);

-- Add index on payment_completed_at for reporting queries
CREATE INDEX IF NOT EXISTS idx_conference_payment_completed 
ON conference_registrations(payment_completed_at DESC)
WHERE payment_completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tech_conference_payment_completed 
ON tech_conference_registrations(payment_completed_at DESC)
WHERE payment_completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exhibitor_payment_completed 
ON exhibitor_registrations(payment_completed_at DESC)
WHERE payment_completed_at IS NOT NULL;

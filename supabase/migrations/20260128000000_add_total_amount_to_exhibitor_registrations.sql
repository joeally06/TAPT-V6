-- Add total_amount field to exhibitor_registrations table
-- This ensures payment amounts are properly recorded and displayed in the payment management system

ALTER TABLE exhibitor_registrations 
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);

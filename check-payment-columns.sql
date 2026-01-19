-- Check if payment columns exist in conference_registrations table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conference_registrations' 
  AND column_name IN ('payment_method', 'payment_status', 'po_number', 'paypal_transaction_id', 'paypal_payer_email', 'payment_completed_at')
ORDER BY column_name;

-- Check if payment columns exist in tech_conference_registrations table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tech_conference_registrations' 
  AND column_name IN ('payment_method', 'payment_status', 'po_number', 'paypal_transaction_id', 'paypal_payer_email', 'payment_completed_at')
ORDER BY column_name;

-- Check if payment columns exist in exhibitor_registrations table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'exhibitor_registrations' 
  AND column_name IN ('payment_method', 'payment_status', 'po_number', 'paypal_transaction_id', 'paypal_payer_email', 'payment_completed_at')
ORDER BY column_name;

/*
  # Registration email history

  The admin registration pages show a timeline for each registration ("Reminder sent Feb 17"). Nothing recorded when
  an email was sent, so this table does. The edge functions that send confirmations, payment reminders and receipts
  add a row for each attempt (sent or failed).

  - Written only by edge functions (service role). There is no INSERT, UPDATE or DELETE policy.
  - Admins can read it (the admin pages read it with the signed-in admin's session).
  - Not readable by the public or by signed-in users who are not admins.
  - `registration_id` points at a row of the table named by `registration_type`. There is no foreign key because it
    can point at four different tables, and the history is kept when a registration is deleted or archived.

  Apply BEFORE deploying the functions and the site. Safe to run more than once.
*/

CREATE TABLE IF NOT EXISTS public.registration_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_type text NOT NULL,
  registration_id uuid NOT NULL,
  kind text NOT NULL,
  recipient text,
  status text NOT NULL,
  error text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_email_log_type_check
    CHECK (registration_type IN ('conference', 'tech_conference', 'exhibitor', 'regional_luncheon')),
  CONSTRAINT registration_email_log_kind_check
    CHECK (kind IN ('confirmation', 'reminder', 'receipt')),
  CONSTRAINT registration_email_log_status_check
    CHECK (status IN ('sent', 'failed'))
);

COMMENT ON TABLE public.registration_email_log IS
  'One row per confirmation, payment reminder or receipt email attempt for a registration. Written by edge functions.';
COMMENT ON COLUMN public.registration_email_log.sent_by IS
  'The admin who triggered the email (null when the sending function does not know, for example receipts).';

-- The panel reads one registration's history, newest first
CREATE INDEX IF NOT EXISTS idx_registration_email_log_registration
  ON public.registration_email_log (registration_type, registration_id, created_at DESC);

ALTER TABLE public.registration_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read registration email log" ON public.registration_email_log;
CREATE POLICY "Admins can read registration email log"
  ON public.registration_email_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Supabase grants table access to the API roles by default; the policy above is what limits reads, and writes
-- are not granted to them at all.
REVOKE ALL ON public.registration_email_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.registration_email_log TO authenticated;

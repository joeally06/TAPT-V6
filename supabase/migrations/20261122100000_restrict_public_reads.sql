/*
  # Close public read access on two tables that hold personal data

  The migrations that built these tables gave everyone with the public site key (the "anon" key that ships
  in the website) permission to read EVERY row:

    hall_of_fame_nominations   policy "Allow public to read nominations"          FOR SELECT TO public USING (true)
    membership_applications    policy "Enable read access for all users"          FOR SELECT TO public USING (true)

  Those rows contain names, emails and phone numbers of nominators, nominees and applicants. Nothing in the
  website reads these tables with the public key: the admin pages read them while signed in as an admin
  (admin policies "Allow admin full access..."), and the edge functions use the service role, which ignores
  these policies. So removing the public read policies changes nothing for admins or for visitors.

  This file is separate from the rollover migrations on purpose: apply it on its own, after running the check
  below.

  What it does
  1. Drops every policy on those two tables that lets "public" or "anon" SELECT with the condition `true`.
  2. If a table is left without any admin policy (which would lock the admin pages out), it adds an
     admin-only read policy.

  Safe to run more than once.

  ---------------------------------------------------------------------------------------
  CHECK BEFORE APPLYING (read-only). A row whose roles contain {public} or {anon}, whose cmd is SELECT or ALL
  and whose qual is "true" is open to everyone:

    SELECT tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('membership_applications', 'hall_of_fame_nominations')
    ORDER BY tablename, policyname;

  CHECK AFTER APPLYING: run the same query. No row should be open to {public}/{anon} with qual "true", and each
  table should still show an admin policy.
  ---------------------------------------------------------------------------------------
*/

DO $$
DECLARE
  pol record;
  t text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('hall_of_fame_nominations', 'membership_applications')
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['public', 'anon']::name[]
      AND btrim(coalesce(qual, ''), '() ') = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped public read policy "%" on %', pol.policyname, pol.tablename;
  END LOOP;

  -- Never leave admins without read access
  FOREACH t IN ARRAY ARRAY['hall_of_fame_nominations', 'membership_applications']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t
        AND p.cmd IN ('SELECT', 'ALL')
        AND p.roles && ARRAY['authenticated', 'public']::name[]
        AND coalesce(p.qual, '') ILIKE '%admin%'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins can read all ' || t, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
           USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ''admin''))',
        'Admins can read all ' || t, t);
      RAISE NOTICE 'Added admin read policy on %', t;
    END IF;
  END LOOP;
END
$$;

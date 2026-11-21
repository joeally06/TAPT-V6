/*
  # Safe year-end rollover

  Replaces the multi-step rollover done by the `rollover` edge function with ONE database
  function, `rollover_cycle`, that runs as a single transaction: it either archives
  everything and starts the new cycle, or changes nothing.

  What this migration does
  1. Brings every archive table back in line with its live table (columns added since 2025
     were never added to the archives, and some archive columns are still NOT NULL after the
     live column was relaxed). Archives become plain, constraint-free copies of the live rows.
  2. Adds `archived_settings_id` to each archive table, so an archive batch can be linked to
     the settings row (cycle) it belonged to.
  3. Adds `exhibitor_participants_archive`. Exhibitor participants are deleted with their
     registration (ON DELETE CASCADE) and were never archived before.
  4. Drops four old `archive_*` SQL functions. They are SECURITY DEFINER, empty whole tables,
     are executable by the public API roles, and nothing calls them any more.
  5. Creates `rollover_cycle(p_type, p_expected_settings_id, p_settings)`, callable only with
     the service role (the `rollover` edge function checks the caller is an admin first).

  Safe to run more than once.

  ---------------------------------------------------------------------------------------
  OPTIONAL, READ-ONLY: run this in the SQL editor BEFORE applying to see what is missing
  from the archive tables today (one row per missing column; no rows = no drift):

    SELECT p.archive_name, a.attname AS missing_in_archive
    FROM (VALUES
      ('conference_registrations_archive',          'conference_registrations'),
      ('conference_attendees_archive',              'conference_attendees'),
      ('tech_conference_registrations_archive',     'tech_conference_registrations'),
      ('tech_conference_attendees_archive',         'tech_conference_attendees'),
      ('exhibitor_registrations_archive',           'exhibitor_registrations'),
      ('hall_of_fame_nominations_archive',          'hall_of_fame_nominations'),
      ('student_scholarship_applications_archive',  'student_scholarship_applications')
    ) AS p(archive_name, live_name)
    JOIN pg_attribute a
      ON a.attrelid = to_regclass('public.' || p.live_name)
     AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> 'id'
    WHERE to_regclass('public.' || p.archive_name) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_attribute b
        WHERE b.attrelid = to_regclass('public.' || p.archive_name)
          AND b.attnum > 0 AND NOT b.attisdropped AND b.attname = a.attname)
    ORDER BY 1, 2;
  ---------------------------------------------------------------------------------------
*/

-- 1. Exhibitor participants archive (created only if the live table exists) ---------------

DO $$
BEGIN
  IF to_regclass('public.exhibitor_participants') IS NOT NULL
     AND to_regclass('public.exhibitor_participants_archive') IS NULL THEN
    EXECUTE 'CREATE TABLE public.exhibitor_participants_archive (
      LIKE public.exhibitor_participants INCLUDING ALL,
      archived_at timestamptz NOT NULL DEFAULT now(),
      archive_id uuid NOT NULL,
      original_id uuid,
      archived_settings_id uuid
    )';
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.exhibitor_participants_archive ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.exhibitor_participants_archive') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admin users can access all archived exhibitor participants"
      ON public.exhibitor_participants_archive;
    CREATE POLICY "Admin users can access all archived exhibitor participants"
      ON public.exhibitor_participants_archive
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END
$$;

-- 2. Bring archive tables in line with their live tables ---------------------------------

DO $$
DECLARE
  pair record;
  col record;
  v_live regclass;
  v_archive regclass;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('conference_registrations_archive',          'conference_registrations'),
      ('conference_attendees_archive',              'conference_attendees'),
      ('tech_conference_registrations_archive',     'tech_conference_registrations'),
      ('tech_conference_attendees_archive',         'tech_conference_attendees'),
      ('exhibitor_registrations_archive',           'exhibitor_registrations'),
      ('exhibitor_participants_archive',            'exhibitor_participants'),
      ('hall_of_fame_nominations_archive',          'hall_of_fame_nominations'),
      ('student_scholarship_applications_archive',  'student_scholarship_applications')
    ) AS t(archive_name, live_name)
  LOOP
    v_live := to_regclass('public.' || pair.live_name);
    v_archive := to_regclass('public.' || pair.archive_name);
    IF v_live IS NULL OR v_archive IS NULL THEN
      RAISE NOTICE 'Skipping % (table missing)', pair.archive_name;
      CONTINUE;
    END IF;

    -- Columns the live table has that the archive lacks (added with the same type, nullable)
    FOR col IN
      SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS col_type
      FROM pg_attribute a
      WHERE a.attrelid = v_live AND a.attnum > 0 AND NOT a.attisdropped
        AND NOT EXISTS (
          SELECT 1 FROM pg_attribute b
          WHERE b.attrelid = v_archive AND b.attnum > 0 AND NOT b.attisdropped
            AND b.attname = a.attname)
    LOOP
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s',
                     pair.archive_name, col.attname, col.col_type);
    END LOOP;

    -- Link to the settings row (cycle) that was active when the batch was archived
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS archived_settings_id uuid',
                   pair.archive_name);

    -- The original (pre-rollover) id of each archived row
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS original_id uuid',
                   pair.archive_name);

    -- An archive stores whatever the live row held, so no column except the keys may be NOT NULL
    FOR col IN
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = v_archive AND a.attnum > 0 AND NOT a.attisdropped AND a.attnotnull
        AND a.attname NOT IN ('id', 'archive_id', 'archived_at')
    LOOP
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL',
                     pair.archive_name, col.attname);
    END LOOP;

    -- CHECK constraints copied from the live table in 2025 may reject newer values; the live table
    -- keeps enforcing them, the archive is a passive copy
    FOR col IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = v_archive AND c.contype = 'c'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
                     pair.archive_name, col.conname);
    END LOOP;
  END LOOP;
END
$$;

-- 3. Old archive functions: SECURITY DEFINER, no admin check, executable through the API ------

DROP FUNCTION IF EXISTS public.archive_conference_registrations();
DROP FUNCTION IF EXISTS public.archive_tech_conference_registrations();
DROP FUNCTION IF EXISTS public.archive_hall_of_fame_nominations();
DROP FUNCTION IF EXISTS public.archive_exhibitor_registrations();

-- 4. Helper: move every row of one live table into its archive table ----------------------
-- Archive and delete are ONE statement (DELETE ... RETURNING feeding INSERT), so a row can
-- never be deleted without being archived. Refuses to run if the live table has a column the
-- archive table lacks, so nothing is ever silently dropped.

CREATE OR REPLACE FUNCTION public.rollover_move_rows(
  p_live text,
  p_archive text,
  p_archive_id uuid,
  p_settings_id uuid,
  p_now timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_live regclass := to_regclass(format('public.%I', p_live));
  v_archive regclass := to_regclass(format('public.%I', p_archive));
  v_cols text;
  v_select text;
  v_missing text;
  v_control text;
  v_count integer;
BEGIN
  IF v_live IS NULL OR v_archive IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = format('[missing_table] Table %s or %s does not exist.', p_live, p_archive),
      ERRCODE = 'RO002';
  END IF;

  -- Archive columns that this function fills itself must exist
  SELECT string_agg(c.name, ', ')
    INTO v_control
  FROM unnest(ARRAY['id', 'original_id', 'archived_at', 'archive_id', 'archived_settings_id']) AS c(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute b
    WHERE b.attrelid = v_archive AND b.attnum > 0 AND NOT b.attisdropped AND b.attname = c.name);
  IF v_control IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = format('[archive_columns_missing] %s is missing columns: %s.', p_archive, v_control),
      ERRCODE = 'RO002';
  END IF;

  -- Live columns the archive does not have
  SELECT string_agg(a.attname, ', ' ORDER BY a.attname)
    INTO v_missing
  FROM pg_attribute a
  WHERE a.attrelid = v_live AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> 'id'
    AND NOT EXISTS (
      SELECT 1 FROM pg_attribute b
      WHERE b.attrelid = v_archive AND b.attnum > 0 AND NOT b.attisdropped AND b.attname = a.attname);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = format('[archive_columns_missing] %s is missing columns: %s.', p_archive, v_missing),
      ERRCODE = 'RO002';
  END IF;

  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
         string_agg('moved.' || quote_ident(a.attname), ', ' ORDER BY a.attnum)
    INTO v_cols, v_select
  FROM pg_attribute a
  WHERE a.attrelid = v_live AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> 'id';

  EXECUTE format(
    'WITH moved AS (DELETE FROM public.%1$I RETURNING *) '
    'INSERT INTO public.%2$I (id, original_id, archived_at, archive_id, archived_settings_id, %3$s) '
    'SELECT gen_random_uuid(), moved.id, $1, $2, $3, %4$s FROM moved',
    p_live, p_archive, v_cols, v_select)
  USING p_now, p_archive_id, p_settings_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

-- 5. The rollover itself -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rollover_cycle(
  p_type text,
  p_expected_settings_id uuid,
  p_settings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent text;
  v_child text;
  v_settings_table text;
  v_prev jsonb;
  v_active_id uuid;
  v_new_id uuid := gen_random_uuid();
  v_archive_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_parent_count integer := 0;
  v_child_count integer := 0;
  v_remaining bigint;
  v_merged jsonb;
BEGIN
  CASE p_type
    WHEN 'conference' THEN
      v_parent := 'conference_registrations';
      v_child := 'conference_attendees';
      v_settings_table := 'conference_settings';
    WHEN 'tech-conference' THEN
      v_parent := 'tech_conference_registrations';
      v_child := 'tech_conference_attendees';
      v_settings_table := 'tech_conference_settings';
    WHEN 'exhibitor' THEN
      v_parent := 'exhibitor_registrations';
      v_child := 'exhibitor_participants';
      v_settings_table := 'exhibitor_settings';
    WHEN 'hall-of-fame' THEN
      v_parent := 'hall_of_fame_nominations';
      v_child := NULL;
      v_settings_table := 'hall_of_fame_settings';
    WHEN 'student-scholarship' THEN
      v_parent := 'student_scholarship_applications';
      v_child := NULL;
      v_settings_table := 'student_scholarship_settings';
    ELSE
      RAISE EXCEPTION USING
        MESSAGE = '[invalid_type] Unknown rollover type.',
        ERRCODE = 'RO003';
  END CASE;

  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION USING
      MESSAGE = '[invalid_settings] Settings must be a JSON object.',
      ERRCODE = 'RO003';
  END IF;

  -- One rollover per form at a time; never wait forever for a table lock
  PERFORM pg_advisory_xact_lock(hashtext('rollover:' || p_type));
  PERFORM set_config('lock_timeout', '10s', true);

  -- New submissions wait here until the rollover commits, then land in the new cycle
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', v_parent);
  IF v_child IS NOT NULL THEN
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', v_child);
  END IF;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', v_settings_table);

  -- The page must still be looking at the active settings (also stops a double click)
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.is_active LIMIT 1', v_settings_table)
    INTO v_prev;
  v_active_id := (v_prev ->> 'id')::uuid;
  IF v_active_id IS NOT NULL AND v_active_id IS DISTINCT FROM p_expected_settings_id THEN
    RAISE EXCEPTION USING
      MESSAGE = '[stale_settings] The active settings changed since this page was loaded. Reload the page and check before rolling over.',
      ERRCODE = 'RO001';
  END IF;

  -- Move related rows first (attendees, participants), then the registrations themselves
  IF v_child IS NOT NULL THEN
    v_child_count := public.rollover_move_rows(v_child, v_child || '_archive', v_archive_id, v_active_id, v_now);
  END IF;
  v_parent_count := public.rollover_move_rows(v_parent, v_parent || '_archive', v_archive_id, v_active_id, v_now);

  -- Nothing may be left behind
  EXECUTE format('SELECT count(*) FROM public.%I', v_parent) INTO v_remaining;
  IF v_remaining > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format('[not_empty] %s rows were left in %s.', v_remaining, v_parent),
      ERRCODE = 'RO004';
  END IF;
  IF v_child IS NOT NULL THEN
    EXECUTE format('SELECT count(*) FROM public.%I', v_child) INTO v_remaining;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION USING
        MESSAGE = format('[not_empty] %s rows were left in %s.', v_remaining, v_child),
        ERRCODE = 'RO004';
    END IF;
  END IF;

  -- Keep last year's settings (inactive) and add the new cycle. The new row starts from the
  -- active row, so any column the page did not send keeps its value.
  EXECUTE format('UPDATE public.%I SET is_active = false WHERE is_active', v_settings_table);
  v_merged := coalesce(v_prev, '{}'::jsonb)
    || (p_settings - 'id' - 'is_active' - 'created_at' - 'updated_at')
    || jsonb_build_object('id', v_new_id, 'is_active', true, 'created_at', v_now, 'updated_at', v_now);
  EXECUTE format(
    'INSERT INTO public.%1$I SELECT * FROM jsonb_populate_record(null::public.%1$I, $1)',
    v_settings_table)
  USING v_merged;

  RETURN jsonb_build_object(
    'archive_id', CASE WHEN v_parent_count + v_child_count > 0 THEN v_archive_id ELSE NULL END,
    'settings_id', v_new_id,
    'previous_settings_id', v_active_id,
    'archived_rows', v_parent_count,
    'archived_related_rows', v_child_count
  );
END
$$;

-- Only the service role (the `rollover` edge function, after its admin check) may call these.
-- Supabase also grants new functions to anon/authenticated by name, so revoke those explicitly.
REVOKE ALL ON FUNCTION public.rollover_move_rows(text, text, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rollover_cycle(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollover_cycle(text, uuid, jsonb) TO service_role;

/*
  Optional check after applying (read-only):

    -- should return no rows (drift healed)
    -- run the OPTIONAL query from the top of this file again

    -- should list rollover_cycle with service_role only, and no archive_* legacy functions
    SELECT p.proname, p.proacl FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'rollover%' OR p.proname LIKE 'archive\_%');
*/

/*
  # Rollover for President nominations, Regional Director nominations and Regional Luncheon

  Extends the year-end rollover (migration 20261121000000_rollover_cycle.sql) to three more forms.
  The first rollover migration is not edited; this one replaces the `rollover_cycle` function with the same
  body plus three new CASE branches.

  What this migration does
  1. Makes sure only ONE settings row can be active for the president and regional director nomination
     settings (the other settings tables already have this). If two rows are active today, only the newest
     stays active. A partial unique index then keeps it that way.
  2. Creates the archive tables president_nominations_archive, regional_director_nominations_archive and
     regional_luncheon_registrations_archive (plain, constraint-free copies, like the other archives).
  3. Replaces `rollover_cycle` so it also accepts 'president-nomination', 'regional-director-nomination'
     and 'regional-luncheon'.

  Safe to run more than once.

  ---------------------------------------------------------------------------------------
  OPTIONAL, READ-ONLY: run this BEFORE applying. Each count should be 0 or 1; a 2 or more means two
  settings rows are active (the public form already misbehaves in that state) and this migration will
  keep only the newest one active:

    SELECT 'president_nomination_settings' AS settings_table, count(*) AS active_rows
    FROM president_nomination_settings WHERE is_active
    UNION ALL
    SELECT 'regional_director_nomination_settings', count(*)
    FROM regional_director_nomination_settings WHERE is_active;
  ---------------------------------------------------------------------------------------
*/

-- 1. Only one active settings row ----------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['president_nomination_settings', 'regional_director_nomination_settings']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skipping % (table missing)', t;
      CONTINUE;
    END IF;

    -- Keep only the newest active row active (does nothing when there is one or none)
    EXECUTE format(
      'UPDATE public.%1$I SET is_active = false
        WHERE is_active
          AND id <> (SELECT s.id FROM public.%1$I s WHERE s.is_active ORDER BY s.created_at DESC NULLS LAST, s.id DESC LIMIT 1)',
      t);

    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (is_active) WHERE is_active = true',
                   t || '_active_idx', t);
  END LOOP;
END
$$;

-- 2. Archive tables ------------------------------------------------------------------------

DO $$
DECLARE
  pair record;
  col record;
  v_live regclass;
  v_archive regclass;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('president_nominations_archive',          'president_nominations'),
      ('regional_director_nominations_archive',  'regional_director_nominations'),
      ('regional_luncheon_registrations_archive', 'regional_luncheon_registrations')
    ) AS t(archive_name, live_name)
  LOOP
    v_live := to_regclass('public.' || pair.live_name);
    IF v_live IS NULL THEN
      RAISE NOTICE 'Skipping % (live table missing)', pair.archive_name;
      CONTINUE;
    END IF;

    IF to_regclass('public.' || pair.archive_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE public.%I (
           LIKE public.%I INCLUDING ALL,
           archived_at timestamptz NOT NULL DEFAULT now(),
           archive_id uuid NOT NULL,
           original_id uuid,
           archived_settings_id uuid
         )', pair.archive_name, pair.live_name);
    END IF;
    v_archive := to_regclass('public.' || pair.archive_name);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', pair.archive_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   'Admin users can access all ' || pair.archive_name, pair.archive_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ''admin''))',
      'Admin users can access all ' || pair.archive_name, pair.archive_name);

    -- Same housekeeping as the other archives: columns the live table gained, relaxed NOT NULL, no CHECKs
    FOR col IN
      SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS col_type
      FROM pg_attribute a
      WHERE a.attrelid = v_live AND a.attnum > 0 AND NOT a.attisdropped
        AND NOT EXISTS (
          SELECT 1 FROM pg_attribute b
          WHERE b.attrelid = v_archive AND b.attnum > 0 AND NOT b.attisdropped AND b.attname = a.attname)
    LOOP
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s',
                     pair.archive_name, col.attname, col.col_type);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS archived_settings_id uuid', pair.archive_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS original_id uuid', pair.archive_name);

    FOR col IN
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = v_archive AND a.attnum > 0 AND NOT a.attisdropped AND a.attnotnull
        AND a.attname NOT IN ('id', 'archive_id', 'archived_at')
    LOOP
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', pair.archive_name, col.attname);
    END LOOP;

    FOR col IN
      SELECT c.conname FROM pg_constraint c WHERE c.conrelid = v_archive AND c.contype = 'c'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', pair.archive_name, col.conname);
    END LOOP;
  END LOOP;
END
$$;

-- 3. The rollover function, now with three more forms ---------------------------------------
-- (identical to migration 20261121000000 except for the three new WHEN branches)

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
    WHEN 'president-nomination' THEN
      v_parent := 'president_nominations';
      v_child := NULL;
      v_settings_table := 'president_nomination_settings';
    WHEN 'regional-director-nomination' THEN
      v_parent := 'regional_director_nominations';
      v_child := NULL;
      v_settings_table := 'regional_director_nomination_settings';
    WHEN 'regional-luncheon' THEN
      v_parent := 'regional_luncheon_registrations';
      v_child := NULL;
      v_settings_table := 'regional_luncheon_settings';
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

-- Only the service role (the `rollover` edge function, after its admin check) may call this.
REVOKE ALL ON FUNCTION public.rollover_cycle(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollover_cycle(text, uuid, jsonb) TO service_role;

/*
  Optional check after applying (read-only): run the OPTIONAL query from the top again (each count 0 or 1), and

    SELECT p.proname, p.proacl FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'rollover%';
*/

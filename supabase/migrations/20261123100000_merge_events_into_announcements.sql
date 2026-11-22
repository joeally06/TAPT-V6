/*
  # Merge Events into announcements

  Events were their own kind of item. From now on an event is an announcement in the "Event" category that has a
  date (and, if you want, a link to one of the registration forms). The admin edits it in the same editor.

  1. Existing events are converted to announcements in the Event category. Date, form link, custom link, image,
     title, text and the "show on the home page" flag are kept. They get no publish time and no end time, so they
     show exactly as before. They are never pinned (only announcements other than events can be pinned).
  2. The "no more than 10 featured items" rule is applied to events and to the other announcements separately, so
     the limit stays 10 + 10 as it is today.
  3. A copy of the original event rows is kept in `content_events_backup_20261123` (not readable through the
     website or the public API). Drop it once you are satisfied:  DROP TABLE content_events_backup_20261123;

  Apply this AFTER 20261123000000_merge_news_into_announcements.sql, and AFTER deploying the admin-content and
  get-dashboard-stats functions and the site. The new site shows events whether or not this migration has run, but
  the OLD Events page and home page only read the old event type, so running this first would empty them until the
  new site is live. Between the site deploy and this migration, old events cannot be edited in the admin (there is
  no Events tab any more), so run it right after the deploy. Safe to run more than once.

  ---------------------------------------------------------------------------------------
  READ-ONLY CHECKS: run these first and look at the numbers.

  -- (a) the events that will be converted; "without_a_date" ones will no longer be listed on the Events page
  SELECT count(*)                                         AS events,
         count(*) FILTER (WHERE is_featured OR featured)  AS featured_events,
         count(*) FILTER (WHERE date IS NULL)             AS without_a_date
  FROM content
  WHERE type = 'event';

  -- (b) announcements already in the Event category (including old news that was filed under "events");
  --     the ones with a date will start showing on the Events page
  SELECT count(*)                                     AS event_category_announcements,
         count(*) FILTER (WHERE is_featured)          AS featured,
         count(*) FILTER (WHERE date IS NOT NULL)     AS with_a_date
  FROM content
  WHERE type = 'announcement' AND category = 'event';

  -- (c) featured events after the merge; this must be 10 or fewer, or the migration stops without changing anything
  SELECT count(*) AS featured_events_after_merge
  FROM content
  WHERE is_featured
    AND (expires_at IS NULL OR expires_at > now())
    AND (type = 'event' OR (type = 'announcement' AND category = 'event'));

  CHECK AFTER APPLYING (should return 0 rows):
    SELECT id, title FROM content WHERE type = 'event';
  ---------------------------------------------------------------------------------------
*/

-- 1. Featured limit: events and the other announcements are counted separately -------------------------

CREATE OR REPLACE FUNCTION check_featured_events_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = TRUE AND (NEW.expires_at IS NULL OR NEW.expires_at > now()) THEN
    IF (
      SELECT COUNT(*)
      FROM content
      WHERE type = NEW.type
      AND (COALESCE(category, '') = 'event') = (COALESCE(NEW.category, '') = 'event')
      AND is_featured = TRUE
      AND id != NEW.id
      AND (expires_at IS NULL OR expires_at > now())
    ) >= 10 THEN
      RAISE EXCEPTION 'Cannot have more than 10 featured items of the same type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Keep a copy of the event rows before they change ------------------------------------------------

CREATE TABLE IF NOT EXISTS content_events_backup_20261123 AS
  SELECT * FROM content WITH NO DATA;

INSERT INTO content_events_backup_20261123
  SELECT c.*
  FROM content c
  WHERE c.type = 'event'
    AND NOT EXISTS (SELECT 1 FROM content_events_backup_20261123 b WHERE b.id = c.id);

-- Row level security with no policy: nobody but the service role and the table owner can read it
ALTER TABLE content_events_backup_20261123 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON content_events_backup_20261123 FROM PUBLIC, anon, authenticated;

-- 3. Convert the events ------------------------------------------------------------------------------

UPDATE content
SET type = 'announcement',
    category = 'event',
    is_pinned = false,
    publish_at = NULL,
    expires_at = NULL
WHERE type = 'event';

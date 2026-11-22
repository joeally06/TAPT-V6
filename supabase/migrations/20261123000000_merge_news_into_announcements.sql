/*
  # Merge News into Announcements

  The admin had separate "Announcements" and "News" tabs, while the public News page already showed both
  together. From now on there is one kind of item, an announcement, with a category.

  1. Announcement categories become: general, event, deadline, safety, regulations, industry
     (the four announcement categories plus the news-only ones).
  2. Existing news items are converted to announcements:
       - category: announcements -> general, events -> event; safety, regulations and industry stay as they are
       - `date` becomes `publish_at` when it is set and already in the past, so the date shown on the site
         does not change
       - they are NOT featured on the home page. News never appeared there; without this the converted items
         would suddenly show on it.
  3. A copy of the original news rows is kept in `content_news_backup_20261123` (not readable through the
     website or the public API). Drop it once you are satisfied:  DROP TABLE content_news_backup_20261123;

  Apply this BEFORE deploying the admin-content function and the site. Safe to run more than once.

  ---------------------------------------------------------------------------------------
  OPTIONAL, READ-ONLY: run this first to see what will be converted:

    SELECT category,
           count(*)                                  AS items,
           count(*) FILTER (WHERE is_featured OR featured) AS featured_items,
           count(*) FILTER (WHERE date IS NOT NULL)  AS with_a_date
    FROM content
    WHERE type = 'news'
    GROUP BY category
    ORDER BY category;

  CHECK AFTER APPLYING (should return 0 rows):
    SELECT id, title FROM content WHERE type = 'news';
  ---------------------------------------------------------------------------------------
*/

-- 1. Announcements may carry the news categories too ---------------------------------------

ALTER TABLE content DROP CONSTRAINT IF EXISTS valid_announcement_category;
ALTER TABLE content ADD CONSTRAINT valid_announcement_category
  CHECK (
    type <> 'announcement'
    OR category IS NULL
    OR category IN ('general', 'event', 'deadline', 'safety', 'regulations', 'industry')
  );

-- 2. Keep a copy of the news rows before they change ----------------------------------------

CREATE TABLE IF NOT EXISTS content_news_backup_20261123 AS
  SELECT * FROM content WITH NO DATA;

INSERT INTO content_news_backup_20261123
  SELECT c.*
  FROM content c
  WHERE c.type = 'news'
    AND NOT EXISTS (SELECT 1 FROM content_news_backup_20261123 b WHERE b.id = c.id);

-- Row level security with no policy: nobody but the service role and the table owner can read it
ALTER TABLE content_news_backup_20261123 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON content_news_backup_20261123 FROM PUBLIC, anon, authenticated;

-- 3. Convert the news rows ---------------------------------------------------------------------

UPDATE content
SET type = 'announcement',
    category = CASE category
                 WHEN 'announcements' THEN 'general'
                 WHEN 'events' THEN 'event'
                 ELSE category
               END,
    is_featured = false,
    featured = false,
    publish_at = CASE WHEN date IS NOT NULL AND date <= now() THEN date ELSE NULL END
WHERE type = 'news';

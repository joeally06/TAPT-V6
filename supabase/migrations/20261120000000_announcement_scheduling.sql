/*
  # Announcement scheduling, pinning and categories (apply before deploying the admin-content function and the site)

  1. Changes
    - `content.publish_at`  when an item becomes visible to the public (null = as soon as it is published)
    - `content.expires_at`  when an item leaves the home page (null = never); the item stays in the archive
    - `content.is_pinned`   one pinned announcement leads the home page
    - Announcements reuse the existing `category` column: event, deadline, safety, general (or null)

  2. Security
    - Public read policy now also requires `publish_at` to have passed, so scheduled items
      cannot be read through the site or the normal table API early (see the note on tapt_search_content below).
      Expiry is deliberately NOT part of the policy.
    - Admin policy is unchanged.

  3. Featured limit
    - Expired items no longer count toward the 10 featured items per type.

  Before applying, see which announcements will have a stale category cleared (they show as General afterwards):
    select id, title, category from content where type = 'announcement' and category is not null;
*/

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN content.publish_at IS 'Item is hidden from the public until this time (null = visible as soon as status is published)';
COMMENT ON COLUMN content.expires_at IS 'Announcements leave the home page at this time (null = never); the item stays in the news archive';
COMMENT ON COLUMN content.is_pinned IS 'Pinned announcement leads the home page. Only one announcement can be pinned.';

-- Announcement categories (news categories are validated by valid_content_category).
-- Older announcements may carry a stale news category such as 'announcements' (the old editor kept
-- the category from the News form); clear those so the constraint can be added and the rows stay editable.
UPDATE content
SET category = NULL
WHERE type = 'announcement'
  AND category IS NOT NULL
  AND category NOT IN ('event', 'deadline', 'safety', 'general');

ALTER TABLE content DROP CONSTRAINT IF EXISTS valid_announcement_category;
ALTER TABLE content ADD CONSTRAINT valid_announcement_category
  CHECK (
    type <> 'announcement'
    OR category IS NULL
    OR category IN ('event', 'deadline', 'safety', 'general')
  );

-- Only announcements can be pinned
ALTER TABLE content DROP CONSTRAINT IF EXISTS pinned_announcements_only;
ALTER TABLE content ADD CONSTRAINT pinned_announcements_only
  CHECK (NOT is_pinned OR type = 'announcement');

-- The end date must be after the start date
ALTER TABLE content DROP CONSTRAINT IF EXISTS valid_publish_window;
ALTER TABLE content ADD CONSTRAINT valid_publish_window
  CHECK (publish_at IS NULL OR expires_at IS NULL OR expires_at > publish_at);

-- At most one pinned item (the CHECK above limits pinning to announcements)
CREATE UNIQUE INDEX IF NOT EXISTS content_one_pinned_announcement
  ON content (type)
  WHERE is_pinned;

-- Public read: published and already past its publish time
DROP POLICY IF EXISTS "Allow public to read published content" ON public.content;
CREATE POLICY "Allow public to read published content"
  ON public.content
  FOR SELECT
  TO public
  USING (status = 'published' AND (publish_at IS NULL OR publish_at <= now()));

-- NOTE: the function tapt_search_content(...) (migration 20250526222400_steep_forest.sql) is SECURITY DEFINER
-- and executable by anon, so it can return draft and scheduled rows regardless of the policy above.
-- Nothing in this repository calls it. If you agree it is unused, close it with:
--   REVOKE EXECUTE ON FUNCTION tapt_search_content(text, text, text, text) FROM anon, authenticated, public;

-- Featured limit: expired items do not count, and an expired item can still be edited
CREATE OR REPLACE FUNCTION check_featured_events_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = TRUE AND (NEW.expires_at IS NULL OR NEW.expires_at > now()) THEN
    IF (
      SELECT COUNT(*)
      FROM content
      WHERE type = NEW.type
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

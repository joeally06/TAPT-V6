-- Increase featured items limit from 3 to 4 per content type

-- Drop and recreate the trigger function with new limit
CREATE OR REPLACE FUNCTION check_featured_events_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = TRUE THEN
    IF (
      SELECT COUNT(*)
      FROM content
      WHERE type = NEW.type 
      AND is_featured = TRUE 
      AND id != NEW.id
    ) >= 4 THEN
      RAISE EXCEPTION 'Cannot have more than 4 featured items of the same type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

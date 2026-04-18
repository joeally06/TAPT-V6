-- Increase featured items limit from 6 to 10 per content type

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
    ) >= 10 THEN
      RAISE EXCEPTION 'Cannot have more than 10 featured items of the same type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Increase featured items limit from 3 to 4 per content type

-- Drop and recreate the trigger function with new limit
CREATE OR REPLACE FUNCTION check_featured_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true THEN
    IF (
      SELECT COUNT(*) 
      FROM content 
      WHERE type = NEW.type 
        AND is_featured = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 4 THEN
      RAISE EXCEPTION 'Cannot have more than 4 featured items of the same type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

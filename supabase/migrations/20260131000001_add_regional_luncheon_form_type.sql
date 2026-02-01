-- Update valid_linked_form_type constraint to include regional-luncheon
-- This allows events to link to the Regional Luncheon registration form

-- Drop the old constraint
ALTER TABLE content DROP CONSTRAINT IF EXISTS valid_linked_form_type;

-- Add updated constraint with all valid form types
ALTER TABLE content ADD CONSTRAINT valid_linked_form_type 
  CHECK (linked_form_type IS NULL OR linked_form_type = ANY (ARRAY[
    'conference', 
    'tech-conference', 
    'regional-luncheon',
    'hall-of-fame', 
    'student-scholarship', 
    'exhibitor'
  ]));

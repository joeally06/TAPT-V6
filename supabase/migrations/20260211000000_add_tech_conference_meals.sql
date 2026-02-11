-- Migration: Add meal ticket support to tech conference
-- Date: 2026-02-11
-- Description: Adds meal_price and meals_available columns to tech_conference_settings,
--              and meal_selections, meal_total, all_meals_selected columns to tech_conference_registrations.

-- ============================================================================
-- 1. Add meal configuration to settings table
-- ============================================================================
ALTER TABLE tech_conference_settings 
ADD COLUMN IF NOT EXISTS meal_price DECIMAL(10,2) NOT NULL DEFAULT 40.00,
ADD COLUMN IF NOT EXISTS meals_available JSONB NOT NULL DEFAULT '[
  {"id": "wednesday_dinner", "label": "Wednesday Dinner", "enabled": true},
  {"id": "thursday_breakfast", "label": "Thursday Breakfast", "enabled": true},
  {"id": "thursday_lunch", "label": "Thursday Lunch", "enabled": true},
  {"id": "thursday_dinner", "label": "Thursday Dinner", "enabled": true},
  {"id": "friday_breakfast", "label": "Friday Breakfast", "enabled": true}
]'::jsonb;

-- Add constraints for data integrity
ALTER TABLE tech_conference_settings 
ADD CONSTRAINT chk_meal_price_non_negative CHECK (meal_price >= 0);

-- ============================================================================
-- 2. Add meal selection fields to registrations table
-- ============================================================================
ALTER TABLE tech_conference_registrations
ADD COLUMN IF NOT EXISTS meal_selections JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS meal_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS all_meals_selected BOOLEAN NOT NULL DEFAULT false;

-- Add constraint for meal total
ALTER TABLE tech_conference_registrations 
ADD CONSTRAINT chk_meal_total_non_negative CHECK (meal_total >= 0);

-- ============================================================================
-- 3. Add descriptive comments
-- ============================================================================
COMMENT ON COLUMN tech_conference_settings.meal_price IS 'Price per meal ticket in dollars, applied uniformly to all meals';
COMMENT ON COLUMN tech_conference_settings.meals_available IS 'JSON array of available meals: [{id, label, enabled}]';
COMMENT ON COLUMN tech_conference_registrations.meal_selections IS 'JSON array of selected meals: [{id, label, price}]';
COMMENT ON COLUMN tech_conference_registrations.meal_total IS 'Total cost of all selected meals for this registration';
COMMENT ON COLUMN tech_conference_registrations.all_meals_selected IS 'Whether the registrant opted for all available meals';

-- ============================================================================
-- 4. Create index for meal-related queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tech_conf_reg_meal_total 
  ON tech_conference_registrations (meal_total) 
  WHERE meal_total > 0;

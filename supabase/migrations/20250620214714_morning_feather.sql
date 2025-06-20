/*
  # Fix Hero Image URL Format

  1. Changes
    - Updates the hero_image_url setting in site_settings table
    - Corrects the JSON format to prevent parsing errors
    
  2. Purpose
    - Fixes the "Unexpected token 'h', "https://im"... is not valid JSON" error
    - Ensures the URL is stored as a proper JSON string
*/

-- Update the hero_image_url setting to use proper JSONB format
UPDATE public.site_settings
SET setting_value = to_jsonb('https://images.pexels.com/photos/5905700/pexels-photo-5905700.jpeg'::text)
WHERE setting_key = 'hero_image_url';
-- Fix conference_registrations RLS policy to use get_user_role() function
-- This avoids RLS recursion issues when checking user roles

-- Drop the existing policy that causes recursion
DROP POLICY IF EXISTS "Admin users can access all registrations" ON public.conference_registrations;

-- Recreate with get_user_role() function to avoid RLS recursion
CREATE POLICY "Admin users can access all registrations"
  ON public.conference_registrations
  FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Add comment explaining the fix
COMMENT ON POLICY "Admin users can access all registrations" ON public.conference_registrations IS 
  'Uses get_user_role() function to avoid RLS recursion. Admin users have full access to all conference registrations.';

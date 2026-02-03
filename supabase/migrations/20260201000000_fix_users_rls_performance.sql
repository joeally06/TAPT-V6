/*
  # Fix RLS Performance Warning on Users Table
  
  This migration fixes the Supabase Linter warning:
  "Table public.users has a row level security policy that re-evaluates 
  auth.<function>() for each row"
  
  Solution: Wrap auth.uid() in a subquery so it's evaluated once per query
  instead of once per row.
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can read own data" ON public.users;

-- Recreate with optimized subquery pattern
-- The (SELECT auth.uid()) ensures auth.uid() is evaluated only once
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

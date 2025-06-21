/*
  # Create contact messages table

  1. New Tables
    - `contact_messages`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `email` (text, not null)
      - `phone` (text, nullable)
      - `district` (text, nullable)
      - `message` (text, not null)
      - `created_at` (timestamptz, default now())
      - `read_status` (boolean, default false)

  2. Security
    - Enable RLS on `contact_messages` table
    - Add policy for service role to insert messages
    - Add policy for admin users to read/manage messages
*/

-- Create contact messages table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  district text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_status boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service role can insert messages"
  ON public.contact_messages
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admin users can manage messages"
  ON public.contact_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_read_status
  ON public.contact_messages (read_status);
/*
  # Create Regional Director Nomination tables

  1. New Tables
    - `regional_director_nomination_settings`
      - `id` (uuid, primary key)
      - `name` (varchar) - display name for the nomination period
      - `start_date` (date) - nomination period start
      - `end_date` (date) - nomination period end
      - `description` (text) - description shown on the form
      - `nomination_instructions` (text)
      - `is_active` (boolean)
      - `created_at` / `updated_at` (timestamptz)

    - `regional_director_nominations`
      - Candidate info, nominator info, certifications, attestations
      - Status tracking with admin verification

  2. Security
    - Enable RLS on both tables
    - Admin full access policy
    - Service role insert policy for edge functions
    - Updated_at trigger
*/

-- =============================================
-- Settings Table
-- =============================================
CREATE TABLE IF NOT EXISTS regional_director_nomination_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text,
  nomination_instructions text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE regional_director_nomination_settings ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Allow admin full access to regional director nomination settings"
  ON regional_director_nomination_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role bypass (for edge functions)
CREATE POLICY "Allow service role full access to regional director nomination settings"
  ON regional_director_nomination_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Public read for active settings (so the form can fetch settings)
CREATE POLICY "Allow public to read active regional director nomination settings"
  ON regional_director_nomination_settings
  FOR SELECT
  USING (is_active = true);

-- =============================================
-- Nominations Table
-- =============================================
CREATE TABLE IF NOT EXISTS regional_director_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Candidate Information
  candidate_first_name varchar(100) NOT NULL,
  candidate_last_name varchar(100) NOT NULL,
  candidate_title varchar(200),
  candidate_school_district varchar(200) NOT NULL,
  candidate_region varchar(50) NOT NULL,
  candidate_email varchar(255) NOT NULL,
  candidate_phone varchar(20) NOT NULL,

  -- Nominator Information
  nominator_first_name varchar(100) NOT NULL,
  nominator_last_name varchar(100) NOT NULL,
  nominator_title varchar(200) NOT NULL,
  nominator_school_district varchar(200) NOT NULL,
  nominator_email varchar(255) NOT NULL,
  nominator_phone varchar(20) NOT NULL,

  -- Certifications & Attestations
  nominator_certification boolean NOT NULL DEFAULT false,
  active_member_good_standing boolean NOT NULL DEFAULT false,
  affiliated_with_district_in_region boolean NOT NULL DEFAULT false,
  district_approval_and_support boolean NOT NULL DEFAULT false,
  travel_expenses_assumed boolean NOT NULL DEFAULT false,
  commits_to_three_year_term boolean NOT NULL DEFAULT false,
  impartial_regarding_vendors boolean NOT NULL DEFAULT false,
  candidate_certification boolean NOT NULL DEFAULT false,
  candidate_signature_name varchar(200),
  candidate_signature_date date,

  -- Status & Admin
  status varchar(50) NOT NULL DEFAULT 'pending',
  rejection_reason text,
  admin_verified_by uuid,
  admin_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE regional_director_nominations ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Allow admin full access to regional director nominations"
  ON regional_director_nominations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role bypass (for edge functions)
CREATE POLICY "Allow service role full access to regional director nominations"
  ON regional_director_nominations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Triggers for updated_at
CREATE TRIGGER update_regional_director_nomination_settings_updated_at
  BEFORE UPDATE ON regional_director_nomination_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_regional_director_nominations_updated_at
  BEFORE UPDATE ON regional_director_nominations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

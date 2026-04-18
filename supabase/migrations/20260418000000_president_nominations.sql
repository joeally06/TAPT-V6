/*
  # Create President Nomination tables

  1. New Tables
    - `president_nomination_settings`
      - `id` (uuid, primary key)
      - `name` (varchar) - display name for the nomination period
      - `start_date` (date) - nomination period start
      - `end_date` (date) - nomination period end
      - `description` (text) - description shown on the form
      - `nomination_instructions` (text)
      - `term_label` (varchar) - e.g. "26-27"
      - `is_active` (boolean)
      - `created_at` / `updated_at` (timestamptz)

    - `president_nominations`
      - Nominee info, nominator info, certifications, attestations
      - Statement of interest
      - Dual signatures (nominee + nominator)
      - Status tracking with admin verification

  2. Security
    - Enable RLS on both tables
    - Admin full access policy
    - Service role insert policy for edge functions
    - Public read for active settings
    - Updated_at trigger
*/

-- =============================================
-- Settings Table
-- =============================================
CREATE TABLE IF NOT EXISTS president_nomination_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  description text,
  nomination_instructions text,
  term_label varchar(100) DEFAULT '26-27',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE president_nomination_settings ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Allow admin full access to president nomination settings"
  ON president_nomination_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role bypass (for edge functions)
CREATE POLICY "Allow service role full access to president nomination settings"
  ON president_nomination_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Public read for active settings
CREATE POLICY "Allow public to read active president nomination settings"
  ON president_nomination_settings
  FOR SELECT
  USING (is_active = true);

-- =============================================
-- Nominations Table
-- =============================================
CREATE TABLE IF NOT EXISTS president_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nominee Information
  nominee_first_name varchar(100) NOT NULL,
  nominee_last_name varchar(100) NOT NULL,
  nominee_title varchar(200),
  nominee_school_district varchar(200) NOT NULL,
  nominee_region varchar(50) NOT NULL,
  nominee_email varchar(255) NOT NULL,
  nominee_phone varchar(20) NOT NULL,

  -- Nominator Information
  nominator_first_name varchar(100) NOT NULL,
  nominator_last_name varchar(100) NOT NULL,
  nominator_title varchar(200) NOT NULL,
  nominator_school_district varchar(200) NOT NULL,
  nominator_email varchar(255) NOT NULL,
  nominator_phone varchar(20) NOT NULL,

  -- Certifications
  nominator_certification boolean NOT NULL DEFAULT false,

  -- Eligibility & Membership
  current_member_good_standing boolean NOT NULL DEFAULT false,
  district_supports_nomination boolean NOT NULL DEFAULT false,
  district_allows_travel boolean NOT NULL DEFAULT false,
  district_assumes_expenses boolean NOT NULL DEFAULT false,

  -- Term & Duties Acknowledgement
  acknowledge_term boolean NOT NULL DEFAULT false,
  acknowledge_duties boolean NOT NULL DEFAULT false,

  -- Ethical Standards
  impartial_regarding_vendors boolean NOT NULL DEFAULT false,
  disclose_conflicts boolean NOT NULL DEFAULT false,
  professionalism_integrity boolean NOT NULL DEFAULT false,
  team_player boolean NOT NULL DEFAULT false,
  no_personal_recognition boolean NOT NULL DEFAULT false,

  -- Statement of Interest
  statement_of_interest text NOT NULL,

  -- Signatures
  nominee_signature_name varchar(200),
  nominee_signature_date date,
  nominator_signature_name varchar(200),
  nominator_signature_date date,

  -- Status & Admin
  status varchar(50) NOT NULL DEFAULT 'pending',
  rejection_reason text,
  admin_verified_by uuid,
  admin_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE president_nominations ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Allow admin full access to president nominations"
  ON president_nominations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role bypass (for edge functions)
CREATE POLICY "Allow service role full access to president nominations"
  ON president_nominations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Triggers for updated_at
CREATE TRIGGER update_president_nomination_settings_updated_at
  BEFORE UPDATE ON president_nomination_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_president_nominations_updated_at
  BEFORE UPDATE ON president_nominations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

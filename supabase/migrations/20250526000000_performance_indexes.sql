-- Performance Indexes for Conference Registrations and Attendees
-- Created: 2025-05-26

-- Index for sorting/pagination by created_at
CREATE INDEX IF NOT EXISTS idx_conference_registrations_created_at
  ON conference_registrations (created_at);

-- Index for filtering by conference_id
CREATE INDEX IF NOT EXISTS idx_conference_registrations_conference_id
  ON conference_registrations (conference_id);

-- Composite index for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_conference_registrations_conference_id_created_at
  ON conference_registrations (conference_id, created_at);

-- Index for joining attendees to registrations
CREATE INDEX IF NOT EXISTS idx_conference_attendees_registration_id
  ON conference_attendees (registration_id);

-- Index for attendee email lookups
CREATE INDEX IF NOT EXISTS idx_conference_attendees_email
  ON conference_attendees (email);

-- Indexes for resources table (if not already present)
CREATE INDEX IF NOT EXISTS idx_resources_category
  ON resources (category);

CREATE INDEX IF NOT EXISTS idx_resources_created_at
  ON resources (created_at);

-- Additional high-priority indexes for performance improvements

-- Status/Type indexes
CREATE INDEX IF NOT EXISTS idx_nominations_status ON hall_of_fame_nominations(status);
CREATE INDEX IF NOT EXISTS idx_content_type_status ON content(type, status);
CREATE INDEX IF NOT EXISTS idx_membership_applications_status ON membership_applications(status);

-- Email and lookup indexes
CREATE INDEX IF NOT EXISTS idx_membership_applications_email ON membership_applications(email);
CREATE INDEX IF NOT EXISTS idx_tech_conference_attendees_email ON tech_conference_attendees(email);

-- Timestamp and sorting indexes
CREATE INDEX IF NOT EXISTS idx_tech_registrations_created_at ON tech_conference_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_members_induction ON hall_of_fame_members(induction_year DESC);

-- Archive table indexes
CREATE INDEX IF NOT EXISTS idx_conf_reg_archive_dates ON conference_registrations_archive(archived_at, created_at);
CREATE INDEX IF NOT EXISTS idx_tech_conf_archive_dates ON tech_conference_registrations_archive(archived_at, created_at);
CREATE INDEX IF NOT EXISTS idx_nominations_archive_dates ON hall_of_fame_nominations_archive(archived_at, created_at);

-- Composite indexes for common joins
CREATE INDEX IF NOT EXISTS idx_tech_attendees_reg_id_email ON tech_conference_attendees(registration_id, email);

# TAPT Nomination Forms Implementation Plan

## Overview

Two new nomination forms following the existing registration/nomination patterns (Hall of Fame, Conference Registration, etc.) with full security (Cloudflare Turnstile, CORS, input sanitization) and admin management.

1. **TAPT Regional Director / Board Member Nomination**
2. **TAPT President 26-27 Nomination**

---

## Form 1: Regional Director / Board Member Nomination

### Public Form Page: `src/pages/RegionalDirectorNomination.tsx`

| Section | Fields |
|---|---|
| **Candidate Info** | Name, Title/Position, School District/Organization, Region (West/Middle/East), Email, Phone |
| **Nominator Info** | Name, Title/Position (Director of Schools / District Pupil Transportation Supervisor / Pupil Transportation Staff Member), School District, Email, Phone |
| **Nominator Certification** | Checkbox: "I certify that I am a Director of Schools, District Pupil Transportation Supervisor, or pupil transportation staff member and have been a member of the organization for the previous two (2) consecutive years" |
| **Eligibility Confirmations** (checkboxes) | Active member in good standing (attendance at 2 consecutive conferences), Affiliated with school district in the region, District approval and support (including limited travel), All travel expenses assumed by candidate's district, Commits to 3-year term, Impartial regarding all vendors |
| **Candidate Certification** | Checkbox: "I certify that the above statements are true and accurate" + Candidate Name (typed as signature) + Date |

**Informational display**: Nomination counts by region — West (2), Middle (3), East (2).

---

## Form 2: TAPT President 26-27 Nomination

### Public Form Page: `src/pages/PresidentNomination.tsx`

| Section | Fields |
|---|---|
| **Nominee Info** | Name, Title/Position, School District/Organization, Region (West/Middle/East), Email, Phone |
| **Nominator Info** | Name, Title/Position, School District, Email, Phone |
| **Nominator Certification** | Checkbox: "I certify that I am a Director of Schools, District Pupil Transportation Supervisor, or pupil transportation staff member and have been a member of the organization for the previous two (2) consecutive years" |
| **Eligibility & Membership** (checkboxes) | Current member in good standing, District administration supports nomination, District agrees to allow necessary travel, District will assume all travel and related expenses |
| **Term & Election Acknowledgement** | Checkbox: "I acknowledge and accept the term and expectations of service" (Elected at Annual Conference, 3-year term, significant leadership commitment) |
| **Duties Acknowledgement** | Checkbox: "I acknowledge and accept the duties and responsibilities of the presidency" (Create/oversee Annual Conference agenda, preside over conference, preside alongside Board Chair, leadership in goals, collaborative work, additional duties) |
| **Ethical Standards** (checkboxes) | Impartial regarding vendors, Disclose conflicts of interest, Professionalism/integrity/fairness, Team player, Not solicit personal recognition |
| **Statement of Interest** | Textarea (max ~500 words) describing qualifications, leadership experience, and vision |
| **Signatures** | Nominee Name (typed) + Date, Nominator Name (typed) + Date |

---

## Backend Components

### Database Tables (SQL Migration)

#### Regional Director Nominations
```sql
-- Settings table
CREATE TABLE regional_director_nomination_settings (
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

-- Nominations table
CREATE TABLE regional_director_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Candidate Info
  candidate_first_name varchar(100) NOT NULL,
  candidate_last_name varchar(100) NOT NULL,
  candidate_title varchar(200),
  candidate_school_district varchar(200) NOT NULL,
  candidate_region varchar(50) NOT NULL,  -- West, Middle, East
  candidate_email varchar(255) NOT NULL,
  candidate_phone varchar(20) NOT NULL,
  -- Nominator Info
  nominator_first_name varchar(100) NOT NULL,
  nominator_last_name varchar(100) NOT NULL,
  nominator_title varchar(200) NOT NULL,  -- Director of Schools / District Pupil Transportation Supervisor / Staff Member
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
  -- Status
  status varchar(50) NOT NULL DEFAULT 'pending',
  rejection_reason text,
  admin_verified_by uuid,
  admin_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### President Nominations
```sql
-- Settings table
CREATE TABLE president_nomination_settings (
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

-- Nominations table
CREATE TABLE president_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nominee Info
  nominee_first_name varchar(100) NOT NULL,
  nominee_last_name varchar(100) NOT NULL,
  nominee_title varchar(200),
  nominee_school_district varchar(200) NOT NULL,
  nominee_region varchar(50) NOT NULL,
  nominee_email varchar(255) NOT NULL,
  nominee_phone varchar(20) NOT NULL,
  -- Nominator Info
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
  -- Term Acknowledgement
  acknowledge_term boolean NOT NULL DEFAULT false,
  -- Duties Acknowledgement
  acknowledge_duties boolean NOT NULL DEFAULT false,
  -- Ethical Standards
  impartial_regarding_vendors boolean NOT NULL DEFAULT false,
  disclose_conflicts boolean NOT NULL DEFAULT false,
  professionalism_integrity boolean NOT NULL DEFAULT false,
  team_player boolean NOT NULL DEFAULT false,
  no_personal_recognition boolean NOT NULL DEFAULT false,
  acknowledge_ethical_standards boolean NOT NULL DEFAULT false,
  -- Statement of Interest
  statement_of_interest text NOT NULL,
  -- Signatures
  nominee_signature_name varchar(200),
  nominee_signature_date date,
  nominator_signature_name varchar(200),
  nominator_signature_date date,
  -- Status
  status varchar(50) NOT NULL DEFAULT 'pending',
  rejection_reason text,
  admin_verified_by uuid,
  admin_verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Both tables will have:
- RLS enabled
- Admin full access policy
- Service role insert policy (for edge functions)
- `update_updated_at` trigger

---

### Supabase Edge Functions

| Function | Purpose |
|---|---|
| `supabase/functions/submit-regional-director-nomination/index.ts` | CORS validation, Turnstile verification, input sanitization, insert into DB, confirmation email |
| `supabase/functions/submit-president-nomination/index.ts` | Same pattern as above |
| `supabase/functions/admin-regional-director-nomination/index.ts` | Admin status updates (approve/reject/pending) |
| `supabase/functions/admin-president-nomination/index.ts` | Admin status updates |

Each follows the established edge function pattern:
- Hardcoded `allowedOrigins` array
- `securityHeaders` on all responses
- `sanitizeError()` for safe error messages
- `sanitizeInput()` for all text fields
- Turnstile token verification via Cloudflare API
- Service role Supabase client for DB operations
- HTML confirmation email via `_shared/email.ts`

---

### Frontend Pages (6 new files)

| File | Purpose |
|---|---|
| `src/pages/RegionalDirectorNomination.tsx` | Public form — `SecureForm` wrapper, fetches settings, validates fields, submits to edge function, success modal |
| `src/pages/AdminRegionalDirectorNominations.tsx` | Admin table — search, sort, pagination, detail modal, status management (approve/reject), PDF export |
| `src/pages/AdminRegionalDirectorNominationSettings.tsx` | Admin settings — name, dates, is_active toggle, description |
| `src/pages/PresidentNomination.tsx` | Public form — same pattern as above |
| `src/pages/AdminPresidentNominations.tsx` | Admin table — same pattern |
| `src/pages/AdminPresidentNominationSettings.tsx` | Admin settings — same pattern, includes term_label field |

---

### Routing (App.tsx)

Add 6 new routes:

```tsx
// Public routes
<Route path="/regional-director-nomination" element={<RegionalDirectorNomination />} />
<Route path="/president-nomination" element={<PresidentNomination />} />

// Admin routes
<Route path="/admin/regional-director-nominations" element={
  <ProtectedRoute requireAdmin><AdminRegionalDirectorNominations /></ProtectedRoute>
} />
<Route path="/admin/regional-director-nomination-settings" element={
  <ProtectedRoute requireAdmin><AdminRegionalDirectorNominationSettings /></ProtectedRoute>
} />
<Route path="/admin/president-nominations" element={
  <ProtectedRoute requireAdmin><AdminPresidentNominations /></ProtectedRoute>
} />
<Route path="/admin/president-nomination-settings" element={
  <ProtectedRoute requireAdmin><AdminPresidentNominationSettings /></ProtectedRoute>
} />
```

---

### Navigation Updates

#### Navbar.tsx
Add links under an "Elections" or "Nominations" section:
- Regional Director Nomination
- President Nomination

#### AdminLayout.tsx
Add sidebar links under a "Nominations" section:
- Regional Director Nominations
- Regional Director Settings
- President Nominations
- President Settings

---

## Security Compliance (existing patterns)

- [x] `SecureForm` wrapper with Cloudflare Turnstile on both public forms
- [x] Server-side Turnstile token verification in edge functions
- [x] Input sanitization (strip HTML/script tags) in edge functions
- [x] CORS origin validation (hardcoded allowed origins array)
- [x] Rate limiting (5 attempts/15 min via Turnstile utils)
- [x] `sanitizeError()` to prevent information leakage
- [x] Service role client for RLS bypass in edge functions
- [x] Admin pages wrapped with `<ProtectedRoute requireAdmin>`
- [x] Security headers on all edge function responses

---

## Implementation Order

1. **Database migration** — Create settings + nominations tables for both forms
2. **Edge Functions** — `submit-regional-director-nomination` and `submit-president-nomination` + admin status functions
3. **Admin Settings pages** — So admins can configure dates/active status before opening forms
4. **Admin Nominations pages** — Review/manage submissions with search, sort, detail view, status updates
5. **Public Form pages** — `RegionalDirectorNomination.tsx` and `PresidentNomination.tsx`
6. **Routing & Navigation** — Wire into `App.tsx`, `Navbar.tsx`, `AdminLayout.tsx`
7. **Deploy** — `npx supabase db push` + `npx supabase functions deploy`

---

## File Summary

| Type | Files |
|---|---|
| Migration | `supabase/migrations/YYYYMMDD_nomination_forms.sql` |
| Edge Functions | 4 new functions (2 submit + 2 admin) |
| Public Pages | 2 new pages |
| Admin Pages | 4 new pages |
| Route Updates | `src/App.tsx` |
| Nav Updates | `src/components/Navbar.tsx`, `src/components/AdminLayout.tsx` |
| **Total new files** | **~10** |

# Site Settings System Documentation

## Overview

The Site Settings system provides administrators with the ability to manage site-wide configuration values (payment addresses, contact information, email templates, etc.) through an intuitive admin interface **without requiring code deployments**.

## Architecture

### Database Layer
- **Table**: `site_settings`
- **Location**: `supabase/migrations/20260126000000_create_site_settings.sql`
- **Structure**:
  ```sql
  CREATE TABLE site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
  );
  ```

### Security (RLS Policies)
✅ **Read Access**: All authenticated users can read settings  
✅ **Write Access**: Only administrators can create, update, or delete settings  
✅ **Audit Trail**: All changes tracked with `updated_at` and `updated_by`  
✅ **Input Validation**: Constraints on key/value length, format validation

### Frontend Components
- **Admin UI**: `src/pages/AdminSettings.tsx`
- **Utilities**: `src/lib/settings.ts`
- **Types**: `src/types/settings.ts`
- **Route**: `/admin/settings` (admin-only protected route)

### Backend (Edge Functions)
- **Utilities**: `supabase/functions/_shared/settings.ts`
- **Usage**: Fetch settings dynamically in Edge Functions
- **Caching**: In-memory cache with 5-minute TTL on frontend

## Available Settings

### Payment Category (`payment`)
| Key | Description | Example Value |
|-----|-------------|---------------|
| `payment_remittance_name` | Organization name for payment remittance | Tennessee Association of Pupil Transportation |
| `payment_remittance_address_line1` | Mailing address - Line 1 | 123 Main Street |
| `payment_remittance_address_line2` | Mailing address - Line 2 (optional) | Suite 100 |
| `payment_remittance_city` | City | Nashville |
| `payment_remittance_state` | State (2-letter code) | TN |
| `payment_remittance_zip` | ZIP code | 37201 |
| `payment_contact_email` | Contact email for payment inquiries | info@tapt.org |
| `payment_contact_phone` | Contact phone | (615) 555-0100 |
| `payment_receipt_footer` | Footer text in payment receipts | Thank you for your payment... |
| `payment_receipt_subject` | Email subject template | Payment Receipt - TAPT {{event_name}} |

### General Category (`general`)
| Key | Description | Example Value |
|-----|-------------|---------------|
| `site_support_email` | General support email | support@tapt.org |
| `site_support_phone` | General support phone | (615) 555-0100 |
| `site_organization_name` | Full organization name | Tennessee Association of Pupil Transportation |

## Usage Guide

### For Administrators

#### Accessing the Settings Page
1. Log in to admin panel at `/admin/login`
2. Click **"Settings"** in the sidebar (⚙️ icon)
3. You'll see all available settings organized by category

#### Editing a Setting
1. Find the setting you want to edit
2. Click into the text field and make your changes
3. Click **"Save Changes"** button
4. Success message confirms the save
5. Changes take effect immediately across the site

#### Setting Types
- **Single-line inputs**: For short values (emails, phone numbers, names)
- **Multi-line text areas**: For addresses and longer content (footers, messages)

#### Validation Rules
The system automatically validates:
- ✅ Email addresses must be valid format
- ✅ Phone numbers should follow `(615) 555-0100` format
- ✅ State codes must be 2 uppercase letters (e.g., TN)
- ✅ ZIP codes must be 5 or 9 digits
- ✅ All values are sanitized to prevent XSS attacks

### For Developers

#### Adding a New Setting (SQL)
```sql
INSERT INTO site_settings (key, value, category, description) VALUES
  ('new_setting_key', 'default value', 'category_name', 'Description of what this setting does');
```

#### Using Settings in Frontend (React/TypeScript)
```typescript
import { fetchAllSettings, getSetting } from '@/lib/settings';

// Fetch all settings
const settings = await fetchAllSettings();
const contactEmail = settings['payment_contact_email'];

// Fetch single setting
const email = await getSetting('payment_contact_email');

// Update a setting
import { updateSetting } from '@/lib/settings';
await updateSetting('payment_contact_email', 'newemail@tapt.org');
```

#### Using Settings in Edge Functions (Deno)
```typescript
import { fetchSettings, formatRemittanceAddressPlain } from '../_shared/settings.ts';

// In your Edge Function
const settings = await fetchSettings(supabaseClient);
const contactEmail = settings.payment_contact_email;
const address = formatRemittanceAddressPlain(settings);
```

#### Example: Payment Receipt Email
```typescript
// Email template uses settings dynamically
const emailData: PaymentReceiptData = {
  // ...other data
  remittanceAddress: formatRemittanceAddressPlain(settings),
  contactEmail: settings.payment_contact_email,
  contactPhone: settings.payment_contact_phone,
  organizationName: settings.site_organization_name,
  footerMessage: settings.payment_receipt_footer
};

const emailHtml = generatePaymentReceiptEmail(emailData);
```

## Alert Bar

A short notice shown above the navbar on every public page (not on `/admin`). It replaces the old hardcoded "under construction" strip on the home page.

- **Where to edit:** Admin > Site Settings > **Alert Bar** tab. It has its own Save button, separate from the other tabs.
- **Fields:** show/hide switch, type (information, urgent, good news), message (200 characters), optional link button (a path on this site such as `/conference-registration`, or an `https://` address), optional start and end time.
- **Visitors** can dismiss it. The dismissal is remembered in their browser until the message, type or link changes.
- **Storage:** one `site_settings` row with key `site_alert` holding a JSON object. No row, or the switch off, or outside the dates, shows nothing.
- **Code:** `src/lib/siteAlert.ts` (parsing and rules), `src/components/SiteAlert.tsx` (the bar), `src/components/admin/SiteAlertSettings.tsx` (the editor).

## Announcement Scheduling

Announcements (Admin > Content > Announcements) can be scheduled, categorised and pinned.

- **Category:** General, Event, Deadline or Safety. Stored in the existing `content.category` column. Older announcements with no category show as General.
- **Publish on:** optional. Until this time the item is hidden from visitors on the site and in the normal table API (the database policy checks `publish_at`). The older search function `tapt_search_content` can still return unpublished rows to anyone; the migration includes a commented `REVOKE` to close it.
- **Remove from homepage on:** optional. After this time the item leaves the home page. It stays on the News page and keeps its own page at `/news/:id`, so old announcements remain as an archive.
- **Pin to the top:** one announcement can be pinned, and only if it is set to Featured. Pinning another one replaces it.
- **Home page:** shows the pinned (or newest) featured announcement as a lead story and up to four more in a list.
- **Database:** columns `publish_at`, `expires_at`, `is_pinned` on `content` (migration `20261120000000_announcement_scheduling.sql`). The migration also clears stale news categories on old announcements so the new category rule can be added. Apply the migration first, then deploy the `admin-content` function, then the site.

## Year-End Rollover

The Conference, Tech Conference, Exhibitor, Hall of Fame, Student Scholarship, President nominations, Regional Director nominations and Regional Luncheon settings pages each have a **Rollover** button that starts the next year's cycle.

- **What it does, in one step:** copies every current registration (and attendees or booth participants) into the archive, clears the live list, keeps last year's settings as an inactive row, and adds a new active settings row with the new name and dates. It all happens inside one database transaction: if anything fails, nothing at all is changed, so it is always safe to try again.
- **Before you start:** the dialog shows how many rows will be archived and links to the registrations list so you can export a CSV first. You must type `ROLLOVER` to confirm.
- **If the page is out of date** (settings changed in another tab, or the button was pressed twice) the rollover is refused with "The active settings changed since this page was loaded. Reload the page".
- **After it runs:** the Archives page lists each batch with the cycle name (for example "2026 Conference"). Last year's settings stay in the settings list and can be activated again.
- **Clear All** buttons were removed from all eight forms. Rollover is the only way to clear a year.
- **Memberships has no rollover on purpose.** Approved members are a permanent roster (nothing expires and there is no year in the data), so archiving them each year would empty it. Yearly renewal would need its own design.
- **Regional Luncheon** has a registration deadline instead of start/end dates. The date, time and venue of each region on the settings page become the new event's dates, so check them before you confirm. The public form refuses a registration posted for an event that is no longer the active one.
- **Clear Settings** (President and Regional Director) now only deactivates the active settings; it no longer deletes every settings row, so earlier cycles stay available and the Archives page can still name them.
- **Only one active settings row** is allowed for the President and Regional Director nomination settings (a unique index, like the other forms).
- **Archives page:** eight tabs, a working search (cycle, date, names, districts, emails), and a CSV download per archive that includes attendees (conference, tech conference) or booth participants (exhibitor).
- **Code:** database function `rollover_cycle` and migrations `20261121000000_rollover_cycle.sql` and `20261122000000_rollover_more_forms.sql`; edge function `rollover` (checks the caller is an admin, then calls the database function); `src/lib/rollover.ts`, `src/components/admin/RolloverModal.tsx`.
- **If it says an archive table is missing columns:** a column was added to a live table without adding it to its archive table. Run the migration's "bring archive tables in line" step again (the migration can be re-run) or add the column to the archive table, then retry. Nothing was lost; the rollover stopped before touching any data.
- **Deploying:** run the pre-check query at the top of each migration (optional), apply `20261121000000_rollover_cycle.sql` and then `20261122000000_rollover_more_forms.sql`, then deploy these functions: `rollover`, `admin-exhibitor-registrations`, `admin-student-scholarship-applications`, `admin-president-settings`, `admin-regional-director-settings`, `send-payment-receipt`, `submit-regional-luncheon` and `submit-conference-registration`. The two submit functions now refuse a registration posted for an event or conference that is no longer the active one, so a form left open from last year cannot register against it. Then deploy the site.

## Public Read Access on Personal Data

`hall_of_fame_nominations` and `membership_applications` were created with a policy that let anyone holding the public site key read every row (names, emails, phone numbers). Nothing on the website needs that: the admin pages read these tables while signed in as an admin, and the edge functions use the service role.

- **Fix:** migration `20261122100000_restrict_public_reads.sql` drops those public read policies and adds an admin read policy only if a table would otherwise have none. It is a separate file so it can be applied on its own.
- **Before applying:** run the read-only `pg_policies` query in the header of the migration to see what the live database actually has. The migrations in the repository may not match it exactly.
- **After applying:** run the same query again. No row should be readable by `public`/`anon` with a condition of `true`, and each table should still show an admin policy.

## Security Best Practices

### What's Protected
✅ XSS Protection: All inputs sanitized, HTML tags removed  
✅ SQL Injection: Parameterized queries via Supabase client  
✅ RLS Enforcement: Database-level access control  
✅ Audit Trail: Track who changed what and when  
✅ Input Validation: Type-specific format checking

### What to Avoid
❌ Never store sensitive credentials in settings (use Supabase Secrets)  
❌ Don't bypass validation when adding settings programmatically  
❌ Avoid storing excessive data (2000 character limit per value)  
❌ Don't expose settings to unauthenticated users (RLS enforced)

## Caching Strategy

### Frontend Caching
- **Method**: In-memory Map with TTL
- **Duration**: 5 minutes
- **Invalidation**: Automatic on setting update
- **Benefit**: Reduces database calls by ~90%

### Edge Function Behavior
- **Method**: Per-request fetch (no caching)
- **Reason**: Ensures latest values for email templates
- **Fallback**: Default values if fetch fails

## Troubleshooting

### Settings Not Updating
1. Check browser console for errors
2. Verify admin role permissions
3. Clear cache: Close and reopen browser tab
4. Check Supabase logs for RLS errors

### Email Templates Not Using New Values
1. Verify setting was saved successfully
2. Check Edge Function logs for setting fetch errors
3. Ensure Edge Function was redeployed after changes
4. Test with manual email send

### Validation Errors
- Email: Must include @ and domain (e.g., user@domain.com)
- Phone: Use format (615) 555-0100
- State: Must be 2 uppercase letters (TN, CA, etc.)
- ZIP: 5 digits (12345) or 9 digits (12345-6789)

## Migration & Deployment

### Running the Migration
```bash
# Local development
npx supabase db reset

# Production
npx supabase db push
```

### Deploying Edge Function Updates
```bash
# Deploy all functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy send-payment-receipt
```

### Database Backup
Settings are automatically backed up with regular database backups. Export manually:
```sql
COPY site_settings TO '/tmp/settings_backup.csv' WITH CSV HEADER;
```

## Future Enhancements

Potential improvements for consideration:
- [ ] Rich text editor for HTML email templates
- [ ] Version history / rollback capability
- [ ] Setting validation preview before saving
- [ ] Bulk import/export via CSV
- [ ] Setting templates for different event types
- [ ] Multi-language support for different locales

## Support

For questions or issues:
- **Internal**: Contact development team
- **External**: Submit issue to repository
- **Emergency**: Check Supabase dashboard logs

---

**Last Updated**: January 26, 2026  
**Version**: 1.0  
**Maintained By**: TAPT Development Team

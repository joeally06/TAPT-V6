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

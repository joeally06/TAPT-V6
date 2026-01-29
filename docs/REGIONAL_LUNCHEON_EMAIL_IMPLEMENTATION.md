# Regional Luncheon Email Confirmation System

## Overview
Complete email confirmation system for Regional Luncheon registrations with dynamic regional dates and comprehensive admin management.

## Implementation Date
January 29, 2025

## Features Implemented

### 1. Database Schema Updates
**File**: `supabase/migrations/20260129183208_add_regional_dates_and_email.sql`

#### Added Fields
- `email` column to `regional_luncheon_registrations`
  - Type: `text NOT NULL`
  - Constraint: Email format validation regex
  - Pattern: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$`
  
- `regional_dates` column to `regional_luncheon_settings`
  - Type: `jsonb DEFAULT '[]'::jsonb`
  - Structure: Array of objects with `{region, date, time, venue}`
  - Example:
    ```json
    [
      {
        "region": "West Region",
        "date": "April 15, 2026",
        "time": "11:30 AM - 1:00 PM",
        "venue": "Jackson Convention Center"
      }
    ]
    ```

### 2. Email Template
**File**: `supabase/functions/_shared/emailTemplates.ts`

#### Interface: `RegionalLuncheonRegistrationData`
```typescript
export interface RegionalLuncheonRegistrationData {
  name: string;
  email: string;
  districtOrganization: string;
  numberOfAttendees: number;
  preferredRegion: string;
  eventName: string;
  registrationDeadline: string;
  regionalDate?: string;
  regionalTime?: string;
  regionalVenue?: string;
  contactEmail?: string;
  contactPhone?: string;
}
```

#### Email Features
- **TAPT branding**: Blue header (#1e3a8a) with white text
- **Responsive design**: Mobile-friendly HTML with inline CSS
- **Dynamic content**:
  - Event name display
  - Regional date/time/venue (when available)
  - Number of attendees
  - Registration deadline highlight (yellow callout)
- **Professional footer**: Organization info and contact details
- **Call-to-action**: Encourages users to save email for records

### 3. Edge Function Updates
**File**: `supabase/functions/submit-regional-luncheon/index.ts`

#### New Functionality
1. **Email validation** in sanitization schema
2. **Event settings retrieval** after successful registration
3. **Regional date matching** based on selected region
4. **Email sending** via Resend API with error handling

#### Process Flow
```
1. Turnstile verification (bot protection)
2. Data sanitization (including email validation)
3. Database insert (registration saved)
4. Fetch event settings (get regional dates)
5. Match regional date info
6. Generate email HTML
7. Send confirmation email
8. Return success (registration saved even if email fails)
```

#### Error Handling
- Email failures are logged but don't cause registration failure
- Ensures users aren't blocked from registering due to email issues
- Admins can manually resend confirmations if needed

### 4. Admin Interface Enhancements
**File**: `src/pages/AdminRegionalLuncheonRegistrations.tsx`

#### New Features
- **Email column** in registrations table with Mail icon
- **Clickable email links** (`mailto:` for easy contact)
- **Email search** - Filter by name, email, or organization
- **CSV export** includes email field

#### Table Columns (Updated)
1. Name (with User icon)
2. **Email (with Mail icon)** - NEW
3. District/Organization (with Building icon)
4. Number of Attendees (with Users icon)
5. Preferred Region (with MapPin icon)
6. Submitted (timestamp)
7. Actions (delete)

### 5. Admin Settings Management
**File**: `src/pages/AdminRegionalLuncheonSettings.tsx`

#### Regional Dates UI
- **5 predefined regions**:
  - West Region
  - Middle Region
  - Cookeville Region
  - Greeneville Region
  - East Region

- **Per-region fields**:
  - Date (date picker)
  - Time (text input, e.g., "11:30 AM - 1:00 PM")
  - Venue (text input)

- **Validation**: All regional date fields must be filled or all empty
- **Storage**: Saved as JSONB array in `regional_luncheon_settings` table

### 6. Public Form Updates
**File**: `src/pages/RegionalLuncheonRegistration.tsx`

#### New Fields
- **Email input** with client-side validation
- Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Required field with visual feedback

#### Dynamic Regional Dates Display
- Fetches active event settings on page load
- Displays region options with date/time/venue in dropdown
- Format: "Region Name - Date, Time (Venue)"
- Falls back to region-only display if dates not set

## Security Features

### 1. Input Validation
- **Client-side**: Email regex validation in React form
- **Server-side**: Email type validation in Edge Function sanitization
- **Database**: Email format constraint with regex check

### 2. Bot Protection
- Cloudflare Turnstile on all form submissions
- Token verification before processing registration
- IP tracking for rate limiting

### 3. Data Sanitization
- All user inputs sanitized before database insertion
- Max length constraints (200 chars for text fields, 255 for email)
- Allowed values enforcement for region selection
- Number range validation (1-3 attendees)

### 4. Email Security
- Email addresses redacted in logs
- PII protection in error messages
- Secure email sending via Resend API
- From address: `noreply@tapt.org`

## Email Delivery

### Resend Integration
- **Service**: Resend API (existing integration)
- **From**: noreply@tapt.org
- **Subject**: "Registration Confirmed - [Event Name]"
- **Format**: HTML email with fallback text

### Email Content Structure
1. **Header**: Blue banner with "✅ Registration Confirmed!"
2. **Event name**: Displayed prominently
3. **Greeting**: Personalized with registrant name
4. **Regional info box**: Gray background with region details
5. **Registration details**: Name, email, district/organization
6. **Deadline callout**: Yellow highlight box
7. **What to expect**: Bulleted list of benefits
8. **Save email reminder**: Blue info box
9. **Footer**: TAPT branding and contact info

### Error Handling
- Email failures logged to Edge Function console
- Registration still succeeds if email fails
- Admins notified via logs for manual follow-up
- Future enhancement: Admin UI to resend confirmations

## Testing Checklist

### Database
- [x] Migration applies successfully
- [x] Email constraint validates format
- [x] Regional dates JSONB structure saves correctly
- [x] RLS policies allow authenticated reads/writes

### Frontend
- [x] Email field appears on registration form
- [x] Email validation shows error for invalid emails
- [x] Regional dates load dynamically from settings
- [x] Dropdown shows dates when available
- [x] Admin table displays email column
- [x] CSV export includes email field
- [x] TypeScript compiles with no errors

### Backend
- [ ] Turnstile verification works
- [ ] Email sanitization validates format
- [ ] Registration saves to database with email
- [ ] Event settings retrieval succeeds
- [ ] Regional date matching finds correct region
- [ ] Email generation produces valid HTML
- [ ] Resend API sends email successfully
- [ ] Email appears in recipient inbox
- [ ] Email displays correctly on mobile/desktop
- [ ] Registration succeeds even if email fails

### Admin Features
- [ ] Admin can set regional dates
- [ ] Settings save correctly to database
- [ ] Public form reflects updated regional dates
- [ ] Admin can see email addresses in table
- [ ] Email links work (mailto:)
- [ ] Search includes email field
- [ ] CSV export has complete data

## Deployment Steps

### 1. Apply Database Migration
```bash
npx supabase db push
```

### 2. Deploy Edge Functions
```bash
npx supabase functions deploy submit-regional-luncheon
```

### 3. Verify Resend API Key
Ensure `RESEND_API_KEY` secret is set:
```bash
npx supabase secrets list
```

If not set:
```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxx
```

### 4. Deploy Frontend
```bash
npm run build
# Deploy dist/ folder to hosting provider
```

### 5. Test End-to-End
1. Visit registration form
2. Fill out form with valid email
3. Submit registration
4. Verify database record created
5. Check email inbox for confirmation
6. Log in to admin panel
7. Verify registration appears with email
8. Test CSV export

## Configuration Files

### Environment Variables (Supabase Secrets)
- `RESEND_API_KEY` - Email delivery service
- `TURNSTILE_SECRET_KEY` - Bot protection
- `SUPABASE_URL` - Database endpoint
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access

### Frontend Config
- `src/config/turnstile.ts` - Turnstile site key
- `src/lib/supabase.ts` - Supabase client config

## Future Enhancements

### Short-term
1. **Admin email resend** - Button to resend confirmation emails
2. **Email preview** - Test email templates before sending
3. **Email delivery status** - Track if emails were delivered
4. **Email templates UI** - Admin interface to customize email content

### Long-term
1. **Calendar invites** - Attach .ics file to emails
2. **SMS notifications** - Optional text message confirmations
3. **Email reminders** - Send reminder before event
4. **Attendance tracking** - QR codes for check-in
5. **Post-event surveys** - Follow-up emails after luncheon

## Support Information

### Troubleshooting Email Issues
1. Check Resend dashboard for delivery status
2. Review Edge Function logs for errors
3. Verify email address is valid format
4. Ensure Resend API key is active
5. Check spam/junk folders

### Admin Contact
For issues with email delivery, contact:
- Technical support: [support email]
- Database admin: [admin email]

## Documentation References
- [TAPT Copilot Instructions](.github/copilot-instructions.md)
- [Turnstile Security Guide](docs/TURNSTILE_SECURITY_GUIDE.md)
- [Payment Receipt Email System](docs/PAYMENT_RECEIPT_EMAIL_SYSTEM.md)
- [Input Sanitization Security](docs/INPUT_SANITIZATION_SECURITY.md)

---

**Last Updated**: January 29, 2025  
**Version**: 1.0  
**Status**: ✅ Complete - Ready for testing

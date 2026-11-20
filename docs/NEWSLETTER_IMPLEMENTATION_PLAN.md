# TAPT Newsletter Implementation Plan

## Overview

Add a full-featured newsletter system to the TAPT website that allows admins to draft and send emails to subscribers using a WYSIWYG editor, provides a public subscription form with double opt-in, enables unsubscription via the existing Contact Us page, supports scheduled sends, subscriber import/export, email open/click tracking via Resend webhooks, and a campaign analytics dashboard.

## Architecture

Follows existing patterns:
- **Email delivery**: Resend API via `_shared/email.ts`
- **Security**: Cloudflare Turnstile on public forms, JWT + admin role verification on admin endpoints
- **Edge Functions**: Deno runtime with CORS validation, sanitization, rate limiting
- **Frontend**: React + TypeScript + Tailwind, `SecureForm` wrapper for public forms

---

## 1. Database Schema

### Migration: `supabase/migrations/XXXXXX_add_newsletter_tables.sql`

#### Table: `newsletter_subscribers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Primary key |
| `email` | `text` | UNIQUE, NOT NULL | Subscriber email |
| `name` | `text` | NOT NULL | Subscriber name |
| `status` | `text` | NOT NULL, default `'pending'` | `pending`, `active`, or `unsubscribed` |
| `unsubscribe_token` | `uuid` | UNIQUE, default `gen_random_uuid()` | Token for one-click unsubscribe |
| `confirmation_token` | `uuid` | UNIQUE, default `gen_random_uuid()` | Token for double opt-in verification |
| `confirmed_at` | `timestamptz` | nullable | When the subscriber confirmed via email |
| `subscribed_at` | `timestamptz` | default `now()` | When they subscribed |
| `unsubscribed_at` | `timestamptz` | nullable | When they unsubscribed |

**Indexes:**
- Unique index on `email`
- Unique index on `unsubscribe_token`
- Index on `status` (for filtering active subscribers during sends)

**RLS:**
- Enable RLS
- No public policies — all access via Edge Functions using service role key

#### Table: `newsletter_campaigns`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Primary key |
| `subject` | `text` | NOT NULL | Email subject line |
| `html_content` | `text` | NOT NULL | Email body HTML |
| `status` | `text` | NOT NULL, default `'draft'` | `draft`, `scheduled`, `sending`, `sent`, `failed` |
| `created_by` | `uuid` | FK → `auth.users(id)` | Admin who created it |
| `recipient_count` | `integer` | default `0` | Number of recipients when sent |
| `open_count` | `integer` | default `0` | Number of unique opens tracked via webhook |
| `click_count` | `integer` | default `0` | Number of unique clicks tracked via webhook |
| `scheduled_at` | `timestamptz` | nullable | When to send (for scheduled campaigns) |
| `created_at` | `timestamptz` | default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | default `now()` | Last updated |
| `sent_at` | `timestamptz` | nullable | When the campaign was sent |

**RLS:**
- Enable RLS
- Admin read/write policy (or service role only via Edge Functions)

#### Table: `newsletter_events`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Primary key |
| `campaign_id` | `uuid` | FK → `newsletter_campaigns(id)`, NOT NULL | Which campaign |
| `subscriber_id` | `uuid` | FK → `newsletter_subscribers(id)`, nullable | Which subscriber (null if deleted) |
| `event_type` | `text` | NOT NULL | `delivered`, `opened`, `clicked`, `bounced`, `complained` |
| `metadata` | `jsonb` | nullable | Extra data (e.g., clicked URL, user agent) |
| `created_at` | `timestamptz` | default `now()` | When the event occurred |

**Indexes:**
- Index on `campaign_id`
- Index on `event_type`
- Composite index on `(campaign_id, subscriber_id, event_type)` for dedup

**RLS:**
- Enable RLS
- Service role only (webhook writes, admin reads via Edge Functions)

---

## 2. Subscribe to Newsletter (Public)

### 2a. Frontend: `src/components/forms/NewsletterSubscribe.tsx`

A compact subscribe form with:
- **Fields**: Name, Email
- **Security**: `SecureForm` wrapper with Turnstile verification
- **Placement**: Embedded in the Footer (`src/components/Footer.tsx`) for site-wide visibility
- **Success state**: Inline "Thank you for subscribing!" confirmation message

**Behavior (Double Opt-In):**
1. User enters name + email
2. Turnstile widget verifies human
3. Calls `submit-newsletter-subscribe` Edge Function
4. Edge Function inserts subscriber with `status: 'pending'` and sends a confirmation email containing a verification link
5. UI shows: "Check your email to confirm your subscription"
6. User clicks verification link → lands on `/contact?confirm={confirmation_token}`
7. Contact page detects the param and calls `newsletter-confirm` Edge Function
8. Edge Function sets `status: 'active'`, `confirmed_at: now()` and sends the welcome email
9. On duplicate email with `active` status → show friendly "You're already subscribed"
10. On duplicate email with `unsubscribed` status → restart opt-in flow (new pending + confirmation email)
11. On duplicate email with `pending` status → resend confirmation email

### 2b. Edge Function: `supabase/functions/submit-newsletter-subscribe/index.ts`

Follows same structure as `submit-contact-message`:

1. CORS validation (same `allowedOrigins` array)
2. Turnstile token verification
3. Input sanitization (name: string, email: email format)
4. Rate limiting: 3 subscribe attempts per email per hour
5. Check for existing subscriber:
   - If `active` → return success with "already subscribed" flag
   - If `unsubscribed` → reset to `pending`, generate new `confirmation_token`, send confirmation email
   - If `pending` → resend confirmation email (using existing `confirmation_token`)
   - If new → insert with `status: 'pending'`, generate `confirmation_token`
6. Send **confirmation email** (not welcome email) with verification link: `https://tapt.org/contact?confirm={confirmation_token}`
7. Log to `admin_logs`

### 2d. Edge Function: `supabase/functions/newsletter-confirm/index.ts`

Handles the double opt-in verification when user clicks the confirmation link:

1. CORS validation
2. Accept `{ confirmation_token }` in request body
3. Look up `newsletter_subscribers` by `confirmation_token` where `status = 'pending'`
4. If found → update `status: 'active'`, `confirmed_at: now()`
5. Send welcome email via `sendEmail()` with unsubscribe link
6. If not found or already active → return appropriate message
7. Log to `admin_logs`

### 2e. Email Template: Confirmation Email (Double Opt-In)

Add `generateNewsletterConfirmationEmail()` to `supabase/functions/_shared/emailTemplates.ts`:
- TAPT branded header
- "Confirm Your TAPT Newsletter Subscription"
- Explains they need to click to verify
- Confirmation link: `https://tapt.org/contact?confirm={confirmation_token}`
- Link expires implicitly (pending records can be cleaned up periodically)

### 2f. Email Template: Welcome Email

Add `generateNewsletterWelcomeEmail()` to `supabase/functions/_shared/emailTemplates.ts`:
- TAPT branded header
- "Welcome to the TAPT Newsletter"
- Confirms subscription is now active
- Includes unsubscribe link
- Physical mailing address (CAN-SPAM compliance)

---

## 3. Unsubscribe via Contact Page

### 3a. Frontend: Modify `src/pages/Contact.tsx`

**URL pattern:** `/contact?unsubscribe={token}`

**Changes:**
- On mount, check for `unsubscribe` or `confirm` URL search parameters
- If `?unsubscribe={token}` present, show an **unsubscribe confirmation UI** instead of the normal contact form:
  - Message: "Click below to unsubscribe from the TAPT newsletter"
  - "Confirm Unsubscribe" button (Turnstile-protected)
  - On success: "You have been successfully unsubscribed from the TAPT newsletter"
  - On error (invalid token): "This unsubscribe link is invalid or has already been used"
- If `?confirm={token}` present, show a **subscription confirmation UI**:
  - Auto-call `newsletter-confirm` Edge Function on mount
  - On success: "Your subscription is confirmed! Welcome to the TAPT newsletter."
  - On error: "This confirmation link is invalid or has expired"
- If neither param present, show the normal contact form unchanged

### 3b. Edge Function: `supabase/functions/newsletter-unsubscribe/index.ts`

1. CORS validation
2. Turnstile token verification
3. Accept `{ unsubscribe_token, turnstileToken }` in request body
4. Look up `newsletter_subscribers` by `unsubscribe_token` where `status = 'active'`
5. If found → update `status: 'unsubscribed'`, `unsubscribed_at: now()`
6. If not found or already unsubscribed → return appropriate message
7. Log to `admin_logs`

**Note:** Does NOT delete the row — keeps an audit trail and prevents re-subscribe confusion.

---

## 4. Admin Newsletter Dashboard

### 4a. Frontend: `src/pages/AdminNewsletter.tsx`

Uses `AdminLayout` wrapper (same as all other admin pages).

**Tabs/Sections:**

#### Campaigns Tab
- **Campaign list table** with columns: Subject, Status (draft/sent), Created, Sent Date, Recipients
- **"New Campaign" button** → opens compose view
- **Compose view:**
  - Subject line `<input>`
  - WYSIWYG editor (TipTap) for HTML body — rich text editing with toolbar for bold, italic, links, images, headings, lists, and raw HTML toggle
  - "Save Draft" button → saves/updates `newsletter_campaigns` with status `draft`
  - "Preview" button → renders HTML in a modal/iframe
  - "Schedule" button → opens date/time picker, sets `scheduled_at` and status `scheduled`
  - "Send Now" button → opens confirmation modal: "Send to X active subscribers?" → calls `send-newsletter` Edge Function
- **Edit draft** → click existing draft to edit
- **Edit scheduled** → click scheduled campaign to modify or cancel schedule
- **View sent campaign** → read-only view with delivery stats (recipients, opens, clicks, bounces)

#### Analytics Tab
- **Campaign performance table** with columns: Subject, Sent Date, Recipients, Opens (%), Clicks (%), Bounces
- **Click into campaign** → detail view showing:
  - Open rate over time (bar chart or simple stat cards)
  - Click-through rate
  - List of clicked URLs with counts
  - Bounce/complaint list
- **Overall stats cards** at top: Total subscribers, total campaigns sent, average open rate, average click rate

#### Subscribers Tab
- **Subscriber list table** with columns: Name, Email, Status, Subscribed Date
- **Filters**: Active / Pending / Unsubscribed / All
- **Search** by name or email
- **Manual remove** button per subscriber (sets status to `unsubscribed`)
- **Import subscribers** button → CSV upload modal (columns: name, email). Imported subscribers go through double opt-in (confirmation email sent to each)
- **Export subscribers** button → download CSV of current filtered view (name, email, status, subscribed date)
- **Subscriber count** displayed prominently (active / pending / unsubscribed breakdown)

### 4b. Edge Functions

#### `supabase/functions/admin-newsletter/index.ts`

Admin-authenticated CRUD for campaigns and subscriber management:

- `GET` → list campaigns (with pagination), list subscribers (with pagination + filters), or get campaign analytics
- `POST` → create new campaign (draft), import subscribers (CSV parse + batch opt-in emails)
- `PUT` → update campaign (edit draft), schedule campaign (set `scheduled_at`), cancel schedule
- `DELETE` → delete draft campaign, export subscribers (returns CSV data)

**Auth:** Verify JWT from `Authorization` header, check admin role via `supabase.rpc('get_user_role')`.

#### `supabase/functions/newsletter-webhook/index.ts`

Resend webhook endpoint for tracking email events:

1. Verify webhook signature (Resend signs webhooks with a secret)
2. Parse event payload — Resend sends events for: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
3. Extract campaign ID and subscriber ID from email metadata/tags
4. Insert into `newsletter_events` table
5. Update aggregate counts on `newsletter_campaigns` (`open_count`, `click_count`)
6. For bounces: optionally mark subscriber as `unsubscribed` to maintain list hygiene

**Resend webhook setup:**
- Configure in Resend dashboard → Webhooks → add endpoint URL
- URL: `https://<supabase-project>.supabase.co/functions/v1/newsletter-webhook`
- Select events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
- Store webhook signing secret in Supabase secrets: `RESEND_WEBHOOK_SECRET`

#### `supabase/functions/newsletter-scheduler/index.ts`

Cron-triggered function to process scheduled campaigns:

1. Query `newsletter_campaigns` where `status = 'scheduled'` AND `scheduled_at <= now()`
2. For each matching campaign, trigger the same send logic as `send-newsletter`
3. Update campaign status to `sending` → `sent`

**Trigger:** Supabase pg_cron or an external cron (e.g., cron-job.org) that calls this endpoint every 5 minutes with a service role key.

#### `supabase/functions/send-newsletter/index.ts`

Admin-only endpoint to send a campaign:

1. Verify admin JWT + role
2. Fetch campaign by ID from `newsletter_campaigns` (must be `draft` or `scheduled` status)
3. Set campaign status to `sending`
4. Fetch all `newsletter_subscribers` where `status = 'active'`
5. For each subscriber:
   - Inject personal unsubscribe link into the email HTML
   - Add CAN-SPAM footer with physical address + unsubscribe link
   - Add Resend tags/metadata: `{ campaign_id, subscriber_id }` for webhook tracking
   - Call `sendEmail()` from `_shared/email.ts`
6. Update campaign: `status: 'sent'`, `sent_at: now()`, `recipient_count`
7. If any failures, log them but continue sending to remaining subscribers
8. Log to `admin_logs`

**Batch strategy:**
- Resend free tier: 100 emails/day, 1 email/second
- Resend paid tier: higher limits
- Implement a small delay (200ms) between sends to respect rate limits
- Use Resend's batch API if available (up to 100 per call)
- If subscriber count exceeds daily limit, warn admin before sending

### 4c. Routing + Navigation

**`src/App.tsx`** — Add route:
```tsx
<Route path="/admin/newsletter" element={
  <ProtectedRoute requireAdmin>
    <AdminNewsletter />
  </ProtectedRoute>
} />
```

**`src/components/AdminLayout.tsx`** — Add sidebar item:
```typescript
{
  name: 'Newsletter',
  icon: Mail,  // from lucide-react (already imported)
  path: '/admin/newsletter'
}
```

Place it in the sidebar near "Messages" for logical grouping.

---

## 5. Email Templates

All added to `supabase/functions/_shared/emailTemplates.ts`:

### `generateNewsletterConfirmationEmail(name, confirmationLink)`
- TAPT branded header
- "Please Confirm Your Subscription"
- Confirmation button/link
- "If you didn't request this, you can ignore this email"

### `generateNewsletterWelcomeEmail(name, unsubscribeLink)`
- TAPT branded header
- "Welcome to the TAPT Newsletter!"
- Subscription confirmed message
- Unsubscribe link + physical address

### `generateNewsletterEmail(subject, htmlContent, unsubscribeLink)`
- TAPT branded header with logo
- Campaign subject as heading
- Campaign HTML body content (from WYSIWYG editor)
- CAN-SPAM compliant footer with:
  - Physical mailing address (from site settings or hardcoded)
  - Unsubscribe link: `https://tapt.org/contact?unsubscribe={token}`
  - "You are receiving this because you subscribed to the TAPT newsletter"
  - Resend open-tracking pixel (automatic when using Resend API)

---

## 6. File Summary

### New Files

| File | Type | Effort |
|---|---|---|
| `supabase/migrations/XXXXXX_add_newsletter_tables.sql` | Migration | Small |
| `supabase/functions/submit-newsletter-subscribe/index.ts` | Edge Function | Small |
| `supabase/functions/newsletter-confirm/index.ts` | Edge Function | Small |
| `supabase/functions/newsletter-unsubscribe/index.ts` | Edge Function | Small |
| `supabase/functions/admin-newsletter/index.ts` | Edge Function | Medium |
| `supabase/functions/send-newsletter/index.ts` | Edge Function | Medium |
| `supabase/functions/newsletter-webhook/index.ts` | Edge Function | Medium |
| `supabase/functions/newsletter-scheduler/index.ts` | Edge Function | Small-Medium |
| `src/components/forms/NewsletterSubscribe.tsx` | React Component | Small |
| `src/pages/AdminNewsletter.tsx` | React Page | Large |

### Modified Files

| File | Change | Effort |
|---|---|---|
| `src/App.tsx` | Add admin route + import | Trivial |
| `src/components/AdminLayout.tsx` | Add "Newsletter" nav item | Trivial |
| `src/components/Footer.tsx` | Embed subscribe form | Small |
| `src/pages/Contact.tsx` | Add unsubscribe + confirm URL param detection + UI | Small |
| `supabase/functions/_shared/emailTemplates.ts` | Add confirmation, welcome, and newsletter templates | Small-Medium |
| `supabase/functions/_shared/email.ts` | Extend `sendEmail()` to accept optional tags/metadata for Resend tracking | Trivial |
| `package.json` | Add TipTap editor dependencies | Trivial |

---

## 7. Implementation Order

| Phase | Tasks | Dependencies |
|---|---|---|
| **Phase 1** | Database migration — create all tables (`newsletter_subscribers`, `newsletter_campaigns`, `newsletter_events`) | None |
| **Phase 2** | Double opt-in subscribe flow — `submit-newsletter-subscribe` + `newsletter-confirm` Edge Functions + subscribe component + confirmation & welcome email templates | Phase 1 |
| **Phase 3** | Unsubscribe flow — `newsletter-unsubscribe` Edge Function + Contact page modifications (both `?unsubscribe=` and `?confirm=` params) | Phase 1 |
| **Phase 4** | Admin CRUD — `admin-newsletter` Edge Function + AdminNewsletter page (campaigns + subscribers tabs) + TipTap WYSIWYG editor | Phase 1 |
| **Phase 5** | Send flow — `send-newsletter` Edge Function + newsletter email wrapper template + Resend tag metadata for tracking + batch logic | Phase 4 |
| **Phase 6** | Scheduled sends — `newsletter-scheduler` Edge Function + schedule UI in admin compose view + cron setup | Phase 5 |
| **Phase 7** | Email tracking — `newsletter-webhook` Edge Function + Resend webhook config + analytics tab in admin dashboard | Phase 5 |
| **Phase 8** | Subscriber import/export — CSV upload/download in admin subscribers tab | Phase 4 |
| **Phase 9** | Integration — add route, nav item, embed subscribe in Footer, extend `_shared/email.ts` | Phases 2-8 |

---

## 8. CAN-SPAM / Compliance Checklist

- [ ] Double opt-in: subscribers must confirm via email before receiving newsletters
- [ ] Every newsletter email includes a working unsubscribe link
- [ ] Every newsletter email includes TAPT physical mailing address
- [ ] Unsubscribe is processed promptly (immediate in our case)
- [ ] Subject lines are not misleading
- [ ] "From" address is valid (`noreply@tapt.org`)
- [ ] Unsubscribe does not require login or account creation
- [ ] Bounced emails are handled (auto-unsubscribe after hard bounce)
- [ ] Complaint events (spam reports) result in immediate unsubscribe

---

## 9. Resend Rate Limit Considerations

| Plan | Daily Limit | Emails/Second | Strategy |
|---|---|---|---|
| Free | 100/day | 1/sec | Small subscriber lists only; warn admin if over 100 |
| Pro ($20/mo) | 50,000/month | 10/sec | Sufficient for most use cases |

**Recommendation:** If subscriber list grows beyond ~80, upgrade to Resend Pro before sending campaigns.

---

## 10. WYSIWYG Editor (TipTap)

### Dependencies

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-text-align @tiptap/extension-underline
```

### Implementation: `src/components/admin/NewsletterEditor.tsx`

A reusable TipTap editor component used in the campaign compose view:

- **Toolbar buttons**: Bold, Italic, Underline, Strikethrough, Headings (H1-H3), Bullet List, Ordered List, Link, Image (URL insert), Text Align, Undo/Redo
- **HTML toggle**: Switch between WYSIWYG and raw HTML source view
- **Output**: Returns HTML string for storage in `newsletter_campaigns.html_content`
- **Styling**: Tailwind-styled toolbar, prose-styled content area using `@tailwindcss/typography`

---

## 11. Scheduled Sends

### Admin UI
- "Schedule" button in compose view opens a date/time picker (native `<input type="datetime-local">`)
- Selecting a time sets `scheduled_at` on the campaign and changes status to `scheduled`
- Scheduled campaigns appear in the campaign list with a clock icon and scheduled date
- Admin can edit or cancel a scheduled campaign (revert to `draft`)

### Backend: `newsletter-scheduler` Edge Function
- Called by a cron job every 5 minutes
- Queries campaigns with `status = 'scheduled'` AND `scheduled_at <= now()`
- For each match, triggers the send logic (same as `send-newsletter`)
- Cron options:
  - **Supabase pg_cron** (if available): `SELECT cron.schedule('newsletter-scheduler', '*/5 * * * *', ...)`
  - **External cron**: cron-job.org or similar, calls the Edge Function with service role key in Authorization header

---

## 12. Email Open/Click Tracking (Resend Webhooks)

### How it works
- Resend automatically inserts a tracking pixel for opens and rewrites links for click tracking when you send via their API
- Resend sends webhook events to your configured endpoint when these events fire
- The `newsletter-webhook` Edge Function receives and stores these events

### Webhook Event Types

| Event | Action |
|---|---|
| `email.delivered` | Insert event, confirms delivery |
| `email.opened` | Insert event, increment `open_count` on campaign (dedup by subscriber) |
| `email.clicked` | Insert event with clicked URL in metadata, increment `click_count` (dedup by subscriber) |
| `email.bounced` | Insert event, mark subscriber as `unsubscribed` (hard bounce) |
| `email.complained` | Insert event, mark subscriber as `unsubscribed` (spam complaint) |

### Resend Email Tags
When sending, include metadata so webhooks can be correlated:
```typescript
await resend.emails.send({
  from,
  to: [subscriber.email],
  subject,
  html,
  tags: [
    { name: 'campaign_id', value: campaignId },
    { name: 'subscriber_id', value: subscriberId }
  ]
});
```

The `_shared/email.ts` `sendEmail()` function will be extended to accept an optional `tags` parameter.

---

## 13. Subscriber Import/Export (CSV)

### Import
- Admin clicks "Import" button in Subscribers tab
- Modal with file upload (`<input type="file" accept=".csv">`)
- Frontend parses CSV client-side (using native `FileReader` + simple split logic — no external library needed)
- Expected columns: `name`, `email` (header row required)
- Validation: check email format, skip duplicates, show preview of parsed rows
- On confirm: sends parsed rows to `admin-newsletter` Edge Function (`POST` with `action: 'import'`)
- Edge Function inserts each as `status: 'pending'` and sends confirmation emails (double opt-in)
- Shows summary: X imported, Y skipped (duplicates), Z invalid

### Export
- Admin clicks "Export" button in Subscribers tab
- Calls `admin-newsletter` Edge Function (`DELETE` method with `action: 'export'` — or use a query param on `GET`)
- Returns CSV string with columns: name, email, status, subscribed_at
- Frontend triggers download via `Blob` + `URL.createObjectURL`
- Respects current filters (e.g., export only active subscribers)

---

## 14. Campaign Analytics Dashboard

### Admin UI: Analytics Tab in `AdminNewsletter.tsx`

**Overview cards:**
- Total active subscribers
- Total campaigns sent
- Average open rate (across all campaigns)
- Average click rate (across all campaigns)

**Campaign performance table:**
| Subject | Sent Date | Recipients | Delivered | Opened (%) | Clicked (%) | Bounced |
|---|---|---|---|---|---|---|

**Campaign detail view** (click into a row):
- Stat cards: Delivered, Opened, Clicked, Bounced, Complained
- Top clicked URLs with counts
- Timeline of events (optional — simple list of recent events)

**Data source:** All data from `newsletter_events` table, aggregated via Edge Function queries.

### Edge Function: Analytics Endpoint
Add to `admin-newsletter` Edge Function:
- `GET` with `?action=analytics&campaign_id=X` → returns aggregated stats for a campaign
- `GET` with `?action=analytics` → returns overview stats across all campaigns

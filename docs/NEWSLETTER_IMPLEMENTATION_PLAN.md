# TAPT Newsletter Implementation Plan

## Overview

Add a newsletter system to the TAPT website that allows admins to draft and send emails to subscribers, provides a public subscription form, and enables unsubscription via the existing Contact Us page.

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
| `status` | `text` | NOT NULL, default `'active'` | `active` or `unsubscribed` |
| `unsubscribe_token` | `uuid` | UNIQUE, default `gen_random_uuid()` | Token for one-click unsubscribe |
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
| `status` | `text` | NOT NULL, default `'draft'` | `draft`, `sending`, `sent`, `failed` |
| `created_by` | `uuid` | FK → `auth.users(id)` | Admin who created it |
| `recipient_count` | `integer` | default `0` | Number of recipients when sent |
| `created_at` | `timestamptz` | default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | default `now()` | Last updated |
| `sent_at` | `timestamptz` | nullable | When the campaign was sent |

**RLS:**
- Enable RLS
- Admin read/write policy (or service role only via Edge Functions)

---

## 2. Subscribe to Newsletter (Public)

### 2a. Frontend: `src/components/forms/NewsletterSubscribe.tsx`

A compact subscribe form with:
- **Fields**: Name, Email
- **Security**: `SecureForm` wrapper with Turnstile verification
- **Placement**: Embedded in the Footer (`src/components/Footer.tsx`) for site-wide visibility
- **Success state**: Inline "Thank you for subscribing!" confirmation message

**Behavior:**
1. User enters name + email
2. Turnstile widget verifies human
3. Calls `submit-newsletter-subscribe` Edge Function
4. On success, show confirmation message
5. On duplicate email with `active` status, show friendly "You're already subscribed"
6. On duplicate email with `unsubscribed` status, re-activate the subscription

### 2b. Edge Function: `supabase/functions/submit-newsletter-subscribe/index.ts`

Follows same structure as `submit-contact-message`:

1. CORS validation (same `allowedOrigins` array)
2. Turnstile token verification
3. Input sanitization (name: string, email: email format)
4. Rate limiting: 3 subscribe attempts per email per hour
5. Check for existing subscriber:
   - If `active` → return success with "already subscribed" flag
   - If `unsubscribed` → update to `active`, reset `unsubscribed_at`, generate new `unsubscribe_token`
   - If new → insert with `status: 'active'`
6. Send welcome email via `sendEmail()` with unsubscribe link
7. Log to `admin_logs`

### 2c. Email Template: Welcome Email

Add `generateNewsletterWelcomeEmail()` to `supabase/functions/_shared/emailTemplates.ts`:
- TAPT branded header
- "Welcome to the TAPT Newsletter"
- Confirms subscription
- Includes unsubscribe link
- Physical mailing address (CAN-SPAM compliance)

---

## 3. Unsubscribe via Contact Page

### 3a. Frontend: Modify `src/pages/Contact.tsx`

**URL pattern:** `/contact?unsubscribe={token}`

**Changes:**
- On mount, check for `unsubscribe` URL search parameter
- If present, show an **unsubscribe confirmation UI** instead of the normal contact form:
  - Message: "Click below to unsubscribe from the TAPT newsletter"
  - "Confirm Unsubscribe" button (Turnstile-protected)
  - On success: "You have been successfully unsubscribed from the TAPT newsletter"
  - On error (invalid token): "This unsubscribe link is invalid or has already been used"
- If no `unsubscribe` param, show the normal contact form unchanged

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
  - HTML body `<textarea>` (plain HTML initially; can upgrade to WYSIWYG later)
  - "Save Draft" button → saves/updates `newsletter_campaigns` with status `draft`
  - "Preview" button → renders HTML in a modal/iframe
  - "Send" button → opens confirmation modal: "Send to X active subscribers?" → calls `send-newsletter` Edge Function
- **Edit draft** → click existing draft to edit
- **View sent campaign** → read-only view of sent campaigns with stats

#### Subscribers Tab
- **Subscriber list table** with columns: Name, Email, Status, Subscribed Date
- **Filters**: Active / Unsubscribed / All
- **Search** by name or email
- **Manual remove** button per subscriber (sets status to `unsubscribed`)
- **Subscriber count** displayed prominently

### 4b. Edge Functions

#### `supabase/functions/admin-newsletter/index.ts`

Admin-authenticated CRUD for campaigns and subscriber management:

- `GET` → list campaigns (with pagination) or list subscribers
- `POST` → create new campaign (draft)
- `PUT` → update campaign (edit draft)
- `DELETE` → delete draft campaign

**Auth:** Verify JWT from `Authorization` header, check admin role via `supabase.rpc('get_user_role')`.

#### `supabase/functions/send-newsletter/index.ts`

Admin-only endpoint to send a campaign:

1. Verify admin JWT + role
2. Fetch campaign by ID from `newsletter_campaigns` (must be `draft` status)
3. Set campaign status to `sending`
4. Fetch all `newsletter_subscribers` where `status = 'active'`
5. For each subscriber:
   - Inject personal unsubscribe link into the email HTML
   - Add CAN-SPAM footer with physical address + unsubscribe link
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

## 5. Email Template: Newsletter Wrapper

Add `generateNewsletterEmail()` to `supabase/functions/_shared/emailTemplates.ts`:

- TAPT branded header with logo
- Campaign subject as heading
- Campaign HTML body content
- CAN-SPAM compliant footer with:
  - Physical mailing address (from site settings or hardcoded)
  - Unsubscribe link: `https://tapt.org/contact?unsubscribe={token}`
  - "You are receiving this because you subscribed to the TAPT newsletter"

---

## 6. File Summary

### New Files

| File | Type | Effort |
|---|---|---|
| `supabase/migrations/XXXXXX_add_newsletter_tables.sql` | Migration | Small |
| `supabase/functions/submit-newsletter-subscribe/index.ts` | Edge Function | Small |
| `supabase/functions/newsletter-unsubscribe/index.ts` | Edge Function | Small |
| `supabase/functions/admin-newsletter/index.ts` | Edge Function | Medium |
| `supabase/functions/send-newsletter/index.ts` | Edge Function | Medium |
| `src/components/forms/NewsletterSubscribe.tsx` | React Component | Small |
| `src/pages/AdminNewsletter.tsx` | React Page | Medium-Large |

### Modified Files

| File | Change | Effort |
|---|---|---|
| `src/App.tsx` | Add admin route + import | Trivial |
| `src/components/AdminLayout.tsx` | Add "Newsletter" nav item | Trivial |
| `src/components/Footer.tsx` | Embed subscribe form | Small |
| `src/pages/Contact.tsx` | Add unsubscribe URL param detection + UI | Small |
| `supabase/functions/_shared/emailTemplates.ts` | Add newsletter + welcome templates | Small |

---

## 7. Implementation Order

| Phase | Tasks | Dependencies |
|---|---|---|
| **Phase 1** | Database migration — create tables | None |
| **Phase 2** | Subscribe flow — Edge Function + subscribe component + welcome email template | Phase 1 |
| **Phase 3** | Unsubscribe flow — Edge Function + Contact page modifications | Phase 1 |
| **Phase 4** | Admin CRUD — Edge Function + AdminNewsletter page (campaigns + subscribers tabs) | Phase 1 |
| **Phase 5** | Send flow — send-newsletter Edge Function + newsletter email template + batch logic | Phase 4 |
| **Phase 6** | Integration — add route, nav item, embed subscribe in Footer | Phases 2-5 |

---

## 8. CAN-SPAM / Compliance Checklist

- [ ] Every newsletter email includes a working unsubscribe link
- [ ] Every newsletter email includes TAPT physical mailing address
- [ ] Unsubscribe is processed promptly (immediate in our case)
- [ ] Subject lines are not misleading
- [ ] "From" address is valid (`noreply@tapt.org`)
- [ ] Unsubscribe does not require login or account creation

---

## 9. Resend Rate Limit Considerations

| Plan | Daily Limit | Emails/Second | Strategy |
|---|---|---|---|
| Free | 100/day | 1/sec | Small subscriber lists only; warn admin if over 100 |
| Pro ($20/mo) | 50,000/month | 10/sec | Sufficient for most use cases |

**Recommendation:** If subscriber list grows beyond ~80, upgrade to Resend Pro before sending campaigns.

---

## 10. Future Enhancements (Out of Scope)

- WYSIWYG editor (TipTap or React-Quill) for composing campaigns
- Email open/click tracking (Resend webhooks)
- Scheduled sends (send at a future date/time)
- Subscriber import/export (CSV)
- Double opt-in (send verification email before activating subscription)
- Campaign analytics dashboard

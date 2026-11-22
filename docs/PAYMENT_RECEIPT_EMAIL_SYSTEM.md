# Payment Receipt Email System

## Overview
Automatic payment receipt delivery system integrated with the payment management workflow. Uses the existing Resend email service to send professional payment confirmations when PO payments are marked as paid.

## How It Works

### When Admin Marks Payment as Paid:

1. **Admin clicks "Mark as Paid"** in Payment Management dashboard
2. **System updates database** (payment_status → 'completed')
3. **Edge Function automatically called** (`send-payment-receipt`)
4. **Function fetches registration data** from database
5. **Email template generated** with all payment details
6. **Receipt sent via Resend** to registrant's email
7. **Success message confirms** payment processed and email sent

### Email Receipt Contents:

**Header:**
- Green success checkmark
- "Payment Received!" headline
- Professional TAPT branding

**Receipt Details:**
- Receipt date (formatted: "Monday, January 25, 2026")
- Registration type (Conference, Tech Conference, or Exhibitor)
- Registrant name and organization
- PO number (highlighted and bolded)
- Payment method (Purchase Order)
- Payment status (with green "PAID" stamp)
- **Amount paid (large, prominent display)**

**Event Information (if available):**
- Conference/event name
- Event date

**Footer:**
- "Keep this email for your records" reminder
- TAPT contact information
- Website link
- Copyright notice

## Technical Implementation

### Files Involved:

1. **`supabase/functions/send-payment-receipt/index.ts`**
   - Edge Function endpoint
   - Validates request and registration data
   - Fetches complete registration from database
   - Calls email template generator
   - Sends via Resend

2. **`supabase/functions/_shared/emailTemplates.ts`**
   - `PaymentReceiptData` interface
   - `generatePaymentReceiptEmail()` function
   - Professional HTML email template with inline CSS

3. **`supabase/functions/_shared/email.ts`**
   - Existing Resend integration (already in use)
   - `sendEmail()` helper function

4. **`src/pages/AdminPaymentManagement.tsx`**
   - Calls `supabase.functions.invoke('send-payment-receipt')`
   - Includes email address in confirmation dialog
   - Shows email status in success message

### Security Features:

✅ **CORS Validation:** Only allowed origins can call function  
✅ **UUID Validation:** Registration ID must be valid UUID  
✅ **Payment Verification:** Only sends for completed PO payments  
✅ **RLS Bypass:** Uses service role to access all data  
✅ **Input Sanitization:** All inputs sanitized before processing  
✅ **Error Handling:** Payment completes even if email fails  

### Error Handling:

**If email fails to send:**
- Payment is still marked as completed in database
- Admin sees success message noting payment was processed
- Email failure logged to console for debugging
- Admin can manually follow up with registrant

**Why this approach?**
- Payment processing is the critical operation
- Email is a nice-to-have notification
- Don't want email issues to block payments
- Admin can always contact registrant if needed

## Email Template Design

### Professional Appearance:
- Clean, modern design
- TAPT brand colors (green for paid status)
- Mobile-responsive layout
- Easy-to-read typography

### Key Design Elements:
- **Green gradient header** - Success/completion feel
- **Large checkmark** - Visual confirmation
- **Receipt box** - Highlighted payment details
- **Info rows** - Organized key-value pairs
- **Paid stamp** - Prominent status badge
- **Amount highlight** - Large, bold display

### Accessibility:
- High contrast colors
- Readable font sizes
- Semantic HTML structure
- Works with email clients' dark mode

## Configuration

### Required Environment Variables:

**Supabase Secrets (Backend):**
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
```

**Frontend (.env):**
No additional configuration needed - uses existing Supabase client

### Deployment:

```bash
# Deploy the Edge Function
npx supabase functions deploy send-payment-receipt

# Verify secrets are set
npx supabase secrets list

# If RESEND_API_KEY not set:
npx supabase secrets set RESEND_API_KEY=your_key_here
```

## Testing

### Manual Test:

1. Create a test registration with PO payment method
2. Navigate to Payment Management dashboard
3. Click "Mark as Paid" for test registration
4. Check email inbox for receipt
5. Verify all details are correct

### What to Verify:

- ✅ Email arrives within seconds
- ✅ Receipt date is correct
- ✅ PO number matches
- ✅ Amount is correct
- ✅ Registrant information accurate
- ✅ Event details included (if applicable)
- ✅ Professional appearance
- ✅ All links work
- ✅ Mobile-friendly display

### Test Email Addresses:

For testing, use:
- Your own email
- Test email service (like Mailtrap)
- Resend's test mode email addresses

## Monitoring

### Check Email Delivery:

1. **Resend Dashboard:**
   - View sent emails
   - Check delivery status
   - See bounce/complaint rates

2. **Supabase Logs:**
   - Edge Function invocation logs
   - Error messages if sending fails
   - Registration data validation

3. **Browser Console:**
   - Frontend success/error messages
   - Edge Function response

### Common Issues:

**Email not received:**
- Check spam/junk folder
- Verify email address in registration
- Check Resend dashboard for delivery status
- Review Edge Function logs for errors

**Wrong information in email:**
- Verify database data is correct
- Check template field mappings
- Review data fetching in Edge Function

**HTML formatting issues:**
- Test in multiple email clients
- Check inline CSS rendering
- Verify template HTML structure

## Registration Pages: Side Panel, Bulk Actions, Reminders and Email History

The Conference, Tech Conference, Exhibitor and Regional Luncheon registration pages (Admin > each program > Registrations) share one set of parts.

### What an admin can do
- **Layout (all four pages):** one toolbar row (search, filter chips, Export, View archives), a compact table (Conference and Tech Conference: Registrant, Payment, Amount, Registered; Exhibitor: Business, Payment, Amount, Registered, sortable; Regional Luncheon: Registrant, Regions, Attendees, Registered), and summary cards above. Email, phone and the other details are in the panel.
- **Side panel:** click anywhere on a row (or its name) to open the registration. On a screen 1280 px wide or more the panel sits beside the list and stays in view while the list scrolls; clicking another row switches it. On narrower screens it slides in over the list as a dialog. It shows the payment status and **history** (Registered, every logged email, Payment received or "Payment not received yet"), then the buttons (Mark as paid for purchase orders, Send payment reminder for unpaid purchase orders, Resend confirmation, New email), then the details, and Delete at the bottom. Escape or the close button closes it and focus returns to the row. The eye and trash columns were removed.
- **Bulk actions:** tick rows (ticks survive paging) and use the bar that appears:
  - **Send reminders** emails each unpaid purchase order a reminder. The server skips, with a reason: registrations that are paid, PayPal, have no email or amount, or were reminded in the last 24 hours. A results list shows who was sent, skipped and failed. Up to 25 are sent per request; the page sends larger selections in batches.
  - **Mark paid** first lists how many of the ticked rows are unpaid purchase orders and their total, then records them one at a time (each emails its receipt), up to 50 per run. A results list flags "paid, but the receipt email failed" and any row that could not be changed.
  - **Export selected** downloads only the ticked rows.
- Under an unpaid row the list shows "Reminded Mar 3" when a reminder went out.

### Reminder email
`send-payment-reminders` (admin only) sends the reminder to the billing contact when the registration has one (conference and tech conference), otherwise to the registrant. It shows the event, PO number, amount due, the remittance address and payment contact from the payment settings, and the event's payment instructions. Amount, status and recipient come from the database. Sends are spaced about 150 ms apart (the email service allows 10 requests per second per team).

### Email history
Table `registration_email_log` (migration `20261124000000_registration_email_log.sql`) holds one row per confirmation, reminder or receipt attempt (sent or failed, with the reason). Only edge functions write it (service role); admins can read it. It is written by `send-payment-reminders`, the four `resend-*-confirmation` functions and `send-payment-receipt`. The history only starts with the first email sent after this change, and the confirmation emails sent at sign-up are not logged. The reminder function refuses to send anything if the log cannot be read, because it needs the log to enforce the one-reminder-a-day rule.

`_shared/email.ts` now treats an error returned by the email service (for example a rate limit) as a failure; before, only thrown errors counted, so a rejected email could be reported as sent.

### Deploy order
Apply the migration, deploy `send-payment-reminders`, `resend-conference-confirmation`, `resend-tech-conference-confirmation`, `resend-exhibitor-confirmation`, `resend-regional-luncheon-confirmation` and `send-payment-receipt`, then the site. The pages work without the history table (the history is just empty), but the reminder buttons need both the table and the function.

### Code
`src/components/admin/`: `PaymentRegistrationsPage` (Conference and Tech pages are configurations of it), `RegistrationListParts` (search box, toolbar button, stat card, table card, name cell, Delete button) with `src/lib/registrationList` (table classes, row click) and `useMediaQuery` (panel beside the list or over it), `RegistrationPanel` (and `RegistrationSplit`), `PaymentTimeline`, `RegistrationEmailActions`, `BulkRegistrationDialogs`, `BulkSelectionBar`, `PaginationBar`, `MarkPaidPanel`. `src/lib/`: `registrationEmails` (history, reminders, timeline), `bulkPayments`, `registrationExport` and `csv` (exports escape quotes and formula-looking cells), `luncheonRegistrations`, `useDialogFocus`.

## Future Enhancements

### Potential Improvements:

1. **Resend Button in UI:**
   - Allow admins to resend receipts
   - Useful if registrant didn't receive email

2. **PDF Attachment:**
   - Generate PDF receipt
   - Attach to email for printing

3. **Customizable Template:**
   - Allow admins to customize message
   - Add notes per payment

4. **Email Preferences:**
   - Let registrants opt-out of receipts
   - Choose email format (HTML vs plain text)

5. **Multiple Recipients:**
   - Send to both registrant and accounting contact
   - CC school district finance department

6. **Scheduled Reminders:**
   - Reminders are sent by hand from the registration pages (see above); sending them automatically after X days is still open

7. **Email Analytics:**
   - Track open rates
   - Monitor click-through on links
   - Measure engagement

## Cost Considerations

### Resend Pricing:
- **Free tier:** 100 emails/day, 3,000/month
- **Pro tier:** $20/month for 50,000 emails
- **Typical usage:** ~50-200 receipts/month (well under free tier)

### Email Volume Estimate:
- Average 10-30 PO payments per conference
- 3-4 conferences per year
- Total: ~120 receipts/year (well within free tier)

## Support & Troubleshooting

### For Admins:

**Email didn't send:**
1. Check success message for email confirmation
2. Verify registrant email address
3. Contact technical support with registration ID

**Need to resend receipt:**
1. Currently requires developer assistance
2. Future enhancement: resend button in UI

### For Developers:

**Debug email issues:**
```bash
# Check Edge Function logs
npx supabase functions logs send-payment-receipt

# Test function directly
npx supabase functions invoke send-payment-receipt \
  --body '{"registrationId":"uuid-here","registrationType":"conference"}'

# Verify Resend API key
npx supabase secrets list | grep RESEND
```

**Common errors:**
- `RESEND_API_KEY not configured` → Set secret in Supabase
- `Registration not found` → Check UUID and table name
- `Payment not completed` → Verify payment_status in database
- `Email send failed` → Check Resend dashboard and API limits

---

**Implementation Date:** January 25, 2026  
**Status:** ✅ Complete and Ready for Testing  
**Email Service:** Resend (existing integration)  
**Template:** Professional HTML with inline CSS  

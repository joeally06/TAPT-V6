# Payment Management User Guide

## Quick Start Guide for Admins

### Accessing Payment Management

1. Log in to the admin panel at `/admin/login`
2. Click **"Payment Management"** in the left sidebar (💵 dollar sign icon)
3. You'll see all pending purchase order payments

### Processing Payments

#### Step-by-Step Process

1. **Receive Physical Payment**
   - Check arrives by mail or in-hand
   - Match PO number on check to registration

2. **Find the Registration**
   - Use the search box to find by:
     - Name (first or last)
     - Email address
     - PO number
     - School district / Business name
   - Or use the filter dropdown to show only specific types

3. **Verify Payment Details**
   - Confirm the PO number matches exactly
   - Verify the amount matches the total shown
   - Check the payee information is correct

4. **Mark as Paid**
   - Click the green **"Mark as Paid"** button
   - Review the confirmation dialog:
     ```
     Mark payment as completed for [Name]?
     
     PO Number: [Number]
     Amount: $[Amount]
     
     A payment receipt will be automatically emailed to [email@example.com]
     
     This action cannot be undone.
     ```
   - Click **OK** to confirm

5. **Confirmation**
   - Green success message appears
   - **Payment receipt automatically emailed to registrant**
   - Payment disappears from pending list
   - Timestamp automatically recorded in database

### What Happens When You Mark a Payment as Paid?

When you click "Mark as Paid", the system automatically:

1. ✅ Updates the database (`payment_status` = 'completed')
2. ✅ Records the payment timestamp (`payment_completed_at`)
3. ✅ **Sends a professional payment receipt email** to the registrant
4. ✅ Removes the payment from your pending list

**Email Receipt Includes:**
- Payment confirmation with official receipt
- PO number reference
- Amount paid
- Receipt date
- Event/conference details
- TAPT contact information
- Official payment record for their files

### Understanding the Dashboard

#### Summary Statistics (Top Section)
- **Total Pending:** Number of payments awaiting processing
- **Total Amount:** Sum of all pending payment amounts
- **Average Amount:** Average payment size

#### Registration Types
Payments are color-coded by type:
- 🔵 **Blue:** Annual Conference Registration
- 🟣 **Purple:** Tech Conference Registration
- 🟢 **Green:** Exhibitor Registration

#### Table Columns
- **Date:** When the registration was submitted
- **Type:** Registration type (see above)
- **Name / Organization:** Registrant name + school/business
- **PO Number:** Purchase order reference number
- **Amount:** Total payment amount
- **Actions:** Mark as Paid button

### Search & Filter Tips

#### Search Box
Searches across ALL fields:
- Names: "Smith" finds "John Smith"
- Email: "school.edu" finds all from that domain
- PO: "2024" finds all POs with 2024
- Organization: "County Schools" finds all from that district

#### Filter Dropdown
- **All Types:** Shows everything (default)
- **Annual Conference:** Only conference registrations
- **Tech Conference:** Only tech conference registrations
- **Exhibitor:** Only exhibitor registrations

**Tip:** You can use search AND filter together!

### Common Scenarios

#### Scenario 1: Single Payment Received
```
1. Open envelope, find check
2. Note PO number: "PO-2024-1234"
3. Type "1234" in search box
4. Verify amount matches check
5. Click "Mark as Paid"
```

#### Scenario 2: Batch of Checks Received
```
1. Sort checks by amount for easier matching
2. For each check:
   - Search by PO number
   - Verify and mark as paid
   - Move check to "processed" pile
3. Verify "Total Pending" count decreases correctly
```

#### Scenario 3: Can't Find a Payment
**Possible reasons:**
- Payment already processed (not in pending list)
- Paid via PayPal instead of PO
- Registration not yet submitted
- Different PO number than expected

**Solutions:**
- Check other admin pages (Conference Registrations, etc.)
- Search for registrant name on main registration pages
- Contact registrant for correct PO number

#### Scenario 4: Wrong Amount on Check
**DO NOT mark as paid yet!**
1. Contact the registrant/organization
2. Resolve the discrepancy:
   - Request additional payment, or
   - Process refund for overpayment
3. Only mark as paid when amounts match

#### Scenario 5: Registrant Didn't Receive Email Receipt
**Future Enhancement:** Currently, receipts are sent automatically but cannot be resent from the UI.

**Workaround:**
1. Check spam/junk folder with registrant
2. Verify email address is correct in registration
3. If needed, contact technical support to manually resend receipt

### Best Practices

✅ **DO:**
- Verify PO numbers match exactly before processing
- Keep physical checks organized by PO number
- Process payments promptly (within 1-2 business days)
- Double-check amounts before clicking "Mark as Paid"
- Use search to find specific payments quickly

❌ **DON'T:**
- Mark payments as paid without receiving actual payment
- Process payments with mismatched amounts
- Skip the confirmation dialog
- Use this for PayPal payments (those auto-complete)

### Security Notes

- Only admin users can access this page
- All actions are logged with timestamps
- Once marked as paid, status cannot be changed back to pending
- Original registration date is preserved
- Payment completion timestamp is automatically recorded

### Troubleshooting

#### "No pending payments" message
- ✅ Good! All PO payments have been processed
- Or registrants are using PayPal instead

#### Search returns no results
- Clear search box and try again
- Check spelling of PO number
- Try searching by name instead

#### Error message when marking as paid
- Check your internet connection
- Try refreshing the page
- If persists, contact technical support

#### Can't access payment management page
- Verify you're logged in as an admin
- Regular users cannot access this page
- Contact administrator to verify your role

### Mobile Access

The payment management page works on mobile devices:
- Table scrolls horizontally on small screens
- All functions available on touch devices
- Recommended: Use desktop/laptop for easier processing

### Need Help?

**For technical issues:**
- Contact: [Your IT Support Contact]

**For payment questions:**
- Contact: [Your Finance Contact]

---

**Last Updated:** January 25, 2026
**Version:** 1.0

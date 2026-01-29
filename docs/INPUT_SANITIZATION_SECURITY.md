# Input Sanitization Security Implementation

## Overview

All Edge Functions now implement comprehensive server-side input sanitization to protect against:
- XSS (Cross-Site Scripting) attacks
- HTML injection
- SQL injection
- Event handler injection
- Null byte attacks
- Oversized input attacks

## Implementation Details

### Sanitization Utility (`supabase/functions/_shared/sanitize.ts`)

#### Core Functions

**`sanitizeString(input: string, maxLength: number = 1000): string`**
- Removes null bytes (`\0`)
- Trims whitespace
- Enforces maximum length
- Removes HTML/script tags: `<script>`, `<iframe>`, `<object>`, `<embed>`
- Removes event handlers: `onclick=`, `onerror=`, `onload=`, etc.

**`sanitizeEmail(email: string): string`**
- Enforces max length of 255 characters
- Converts to lowercase
- Validates against regex: `/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/`
- Throws error on invalid format

**`sanitizePhone(phone: string): string`**
- Strips all non-digit characters
- Validates exactly 10 digits
- Returns clean digit string

**`sanitizeZipCode(zip: string): string`**
- Validates 5-digit format: `12345`
- Or 5+4 format: `12345-6789`
- Throws error on invalid format

**`sanitizeState(state: string): string`**
- Validates 2-letter state code
- Converts to uppercase
- Validates against pattern: `/^[A-Z]{2}$/`

**`sanitizeUrl(url: string): string`**
- Max length: 2048 characters
- Validates URL structure
- Only allows `http:` and `https:` protocols
- Throws error on invalid format

**`sanitizeNumber(value: any, min?: number, max?: number): number`**
- Validates numeric value
- Enforces min/max bounds if provided
- Throws error on NaN or Infinity

**`sanitizeBoolean(value: any): boolean`**
- Accepts: `true`, `false`, `"true"`, `"false"`, `"1"`, `"0"`
- Throws error on invalid value

**`sanitizeArray(arr: any[], maxLength: number = 100): any[]`**
- Validates array type
- Enforces maximum array length
- Returns validated array

**`sanitizeObject<T>(obj: any, schema: Record<string, SanitizationRule>): Partial<T>`**
- Schema-based validation
- Validates each field according to defined rules
- Supports all sanitization types
- Checks required fields
- Returns sanitized object

### Applied to Edge Functions

#### 1. Conference Registration (`submit-conference-registration`)

**Schema:**
```typescript
{
  firstName: { type: 'string', required: true, maxLength: 100 },
  lastName: { type: 'string', required: true, maxLength: 100 },
  email: { type: 'email', required: true },
  phone: { type: 'phone', required: true },
  schoolDistrict: { type: 'string', required: true, maxLength: 100 },
  streetAddress: { type: 'string', required: true, maxLength: 200 },
  city: { type: 'string', required: true, maxLength: 100 },
  state: { type: 'state', required: true },
  zipCode: { type: 'zip', required: true },
  totalAttendees: { type: 'number', required: true, min: 1, max: 20 },
  totalAmount: { type: 'number', required: true, min: 0 },
  conferenceId: { type: 'number', required: true },
  paymentMethod: { type: 'string', required: true },
  paymentStatus: { type: 'string', required: false, maxLength: 50 },
  poNumber: { type: 'string', required: false, maxLength: 100 },
  paypalTransactionId: { type: 'string', required: false, maxLength: 100 },
  paypalPayerEmail: { type: 'email', required: false },
  turnstileToken: { type: 'string', required: true }
}
```

**Additional Attendees:**
```typescript
{
  firstName: { type: 'string', required: true, maxLength: 100 },
  lastName: { type: 'string', required: true, maxLength: 100 },
  email: { type: 'email', required: true }
}
```

#### 2. Tech Conference Registration (`submit-tech-conference-registration`)

Same schema as Conference Registration (fields validated identically)

#### 3. Exhibitor Registration (`submit-exhibitor-registration`)

**Schema:**
```typescript
{
  businessName: { type: 'string', required: true, maxLength: 200 },
  firstName: { type: 'string', required: true, maxLength: 100 },
  lastName: { type: 'string', required: true, maxLength: 100 },
  streetAddress: { type: 'string', required: true, maxLength: 200 },
  streetAddress2: { type: 'string', required: false, maxLength: 200 },
  city: { type: 'string', required: true, maxLength: 100 },
  state: { type: 'state', required: true },
  zipCode: { type: 'zip', required: true },
  email: { type: 'email', required: true },
  phone: { type: 'phone', required: true },
  mobilePhone: { type: 'phone', required: false },
  boothRequirements: { type: 'string', required: false, maxLength: 1000 },
  productsDescription: { type: 'string', required: false, maxLength: 2000 },
  additionalComments: { type: 'string', required: false, maxLength: 2000 },
  website: { type: 'url', required: false },
  exhibitorFee: { type: 'number', required: true, min: 0 },
  paymentMethod: { type: 'string', required: true },
  paymentStatus: { type: 'string', required: false, maxLength: 50 },
  poNumber: { type: 'string', required: false, maxLength: 100 },
  paypalTransactionId: { type: 'string', required: false, maxLength: 100 },
  paypalPayerEmail: { type: 'email', required: false },
  turnstileToken: { type: 'string', required: true }
}
```

#### 4. Contact Message (`submit-contact-message`)

**Schema:**
```typescript
{
  name: { type: 'string', required: true, maxLength: 100 },
  email: { type: 'email', required: true },
  phone: { type: 'phone', required: false },
  district: { type: 'string', required: false, maxLength: 100 },
  message: { type: 'string', required: true, maxLength: 5000 },
  turnstileToken: { type: 'string', required: false }
}
```

## Security Testing

### Manual Testing Instructions

Since the Edge Functions are protected by Cloudflare Turnstile in production, manual testing should be done through the frontend forms:

#### 1. XSS Attack Prevention Test

**Test Input:**
- First Name: `<script>alert('XSS')</script>`
- Expected: Form submission succeeds, but database stores sanitized value without script tags

**Test Input:**
- Message: `<img src=x onerror=alert('XSS')>`
- Expected: Sanitized to remove the onerror handler

#### 2. HTML Injection Test

**Test Input:**
- Business Name: `<iframe src="https://malicious.com"></iframe>`
- Expected: iframe tags removed, only text remains

**Test Input:**
- Message: `<style>body{display:none}</style>`
- Expected: style tags removed

#### 3. Event Handler Injection Test

**Test Input:**
- Last Name: `Doe onclick=alert('XSS')`
- Expected: onclick handler removed

#### 4. Null Byte Test

**Test Input:**
- Name: `John\0Doe` (literal null byte)
- Expected: Null byte stripped, becomes "JohnDoe"

#### 5. Oversized Input Test

**Test Input:**
- First Name: String with 5000 characters
- Expected: Truncated to 100 characters (maxLength)

**Test Input:**
- Message: String with 10000 characters
- Expected: Truncated to 5000 characters

#### 6. Email Validation Test

**Invalid Emails (should be rejected):**
- `not-an-email`
- `missing@domain`
- `@nodomain.com`
- `spaces in@email.com`
- `<script>@evil.com`

**Valid Emails (should be accepted):**
- `user@example.com`
- `test.user+tag@domain.co.uk`

#### 7. Phone Number Validation Test

**Invalid Phones (should be rejected):**
- `123` (too short)
- `12345678901234567890` (too long)
- `not-a-phone` (non-numeric)
- `555-CALL-NOW` (letters)

**Valid Phones (should be accepted):**
- `6155551234`
- `(615) 555-1234`
- `615-555-1234`

All valid formats are normalized to 10 digits: `6155551234`

#### 8. ZIP Code Validation Test

**Invalid ZIPs (should be rejected):**
- `123` (too short)
- `ABCDE` (letters)
- `12345-` (incomplete)
- `12345-ABC` (invalid extended)

**Valid ZIPs (should be accepted):**
- `37201` (5-digit)
- `37201-1234` (5+4 format)

### Database Verification

After form submission, check the database to verify sanitized values:

```sql
-- Check recent conference registration
SELECT 
  first_name, 
  last_name, 
  email, 
  phone, 
  created_at 
FROM conference_registrations 
ORDER BY created_at DESC 
LIMIT 1;

-- Check recent contact message
SELECT 
  name, 
  email, 
  message, 
  created_at 
FROM contact_messages 
ORDER BY created_at DESC 
LIMIT 1;
```

Verify that:
- No `<script>` tags appear in any field
- No `<iframe>`, `<object>`, or `<embed>` tags
- No event handlers like `onclick=` or `onerror=`
- No null bytes (`\0`)
- All strings are within max length
- Emails are lowercase and valid format
- Phones are exactly 10 digits
- ZIP codes match valid patterns

## Security Benefits

### Defense in Depth

1. **Frontend Validation**: User-friendly error messages
2. **Cloudflare Turnstile**: Bot protection
3. **Server-Side Sanitization**: Removes malicious content (THIS LAYER)
4. **Parameterized Queries**: SQL injection prevention
5. **RLS Policies**: Row-level security in database

### Attack Prevention

**XSS Protection:**
- Script tags removed before database insertion
- Cannot execute JavaScript in admin panels
- Safe for display in emails and dashboards

**HTML Injection Protection:**
- iframe, object, embed tags blocked
- Cannot inject external content
- Safe rendering in all contexts

**SQL Injection Protection:**
- Combined with parameterized queries
- Special characters sanitized
- Additional safety layer

**Data Integrity:**
- Enforced field lengths prevent overflow
- Type validation ensures correct data types
- Required field validation prevents missing data

## Deployment Status

✅ **Deployed Functions:**
- `submit-conference-registration` - Deployed with sanitization
- `submit-tech-conference-registration` - Deployed with sanitization
- `submit-exhibitor-registration` - Deployed with sanitization
- `submit-contact-message` - Deployed with sanitization

All Edge Functions are live and protecting against malicious input as of January 18, 2026.

## Maintenance

### Adding New Fields

When adding new form fields:

1. Update the sanitization schema in the Edge Function
2. Choose appropriate validation type
3. Set maxLength for string fields
4. Set min/max for numeric fields
5. Mark as required or optional
6. Deploy the updated function

**Example:**
```typescript
const schema = {
  // ... existing fields ...
  newField: { type: 'string', required: true, maxLength: 200 }
};
```

### Testing New Sanitization Rules

After adding new fields or modifying validation:

1. Test with legitimate data
2. Test with malicious payloads
3. Verify database contains sanitized values
4. Check admin notifications display safely

## Monitoring

Watch for these error patterns in Supabase logs:

- `❌ Validation error` - Invalid input rejected
- `Invalid ${fieldName}` - Specific field validation failure
- Pattern of validation errors from same IP - Possible attack

These errors are **expected** when malicious input is submitted - they indicate the security is working correctly.

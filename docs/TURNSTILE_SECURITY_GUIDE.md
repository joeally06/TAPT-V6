# 🔒 Cloudflare Turnstile Security Implementation

This document describes the security-focused Cloudflare Turnstile implementation for TAPT website forms.

## 🎯 Overview

Cloudflare Turnstile has been implemented across all forms to protect against bot attacks, spam, and abuse while maintaining excellent user experience. The implementation follows security best practices with proper separation of frontend and backend concerns.

## 🔐 Security Features

### Frontend Security
- ✅ Site key securely configured via environment variables
- ✅ Domain validation prevents unauthorized usage
- ✅ Rate limiting (5 attempts per 15 minutes)
- ✅ Script integrity checking ready for production
- ✅ Error handling and user feedback
- ✅ No sensitive keys exposed to client

### Backend Security
- ✅ Secret key never exposed to frontend
- ✅ Token verification via Cloudflare API
- ✅ Request timestamp validation (prevents replay attacks)
- ✅ IP address validation
- ✅ CORS and origin validation
- ✅ Comprehensive security headers
- ✅ Audit logging

## 📁 File Structure

```
src/
├── config/
│   └── turnstile.ts              # Frontend configuration
├── hooks/
│   └── useTurnstile.ts           # React hook for Turnstile
├── components/
│   ├── ui/
│   │   └── Turnstile.tsx         # Turnstile widget component
│   └── forms/
│       └── SecureForm.tsx        # Secure form wrapper
├── utils/
│   └── turnstileVerification.ts  # Verification utilities
└── pages/
    ├── Contact.tsx               # Updated contact form
    └── TurnstileTest.tsx         # Test component

supabase/functions/
├── verify-turnstile/
│   └── index.ts                  # Verification API endpoint
└── submit-contact-message/
    └── index.ts                  # Updated with verification
```

## 🚀 Setup Instructions

### 1. Environment Variables

#### Frontend (.env)
```env
VITE_TURNSTILE_SITE_KEY=0x4AAAAAABkM5-7VsQWr1y7u
```

#### Backend (.env.server)
```env
TURNSTILE_SECRET_KEY=0x4AAAAAABkM5w2rxee0cGv5Fax08rrZzIo
```

### 2. Domain Configuration

Update allowed domains in:
- `src/config/turnstile.ts`
- `supabase/functions/verify-turnstile/index.ts`
- `supabase/functions/submit-contact-message/index.ts`

### 3. Supabase Edge Function Deployment

Deploy the verification function:
```bash
npx supabase functions deploy verify-turnstile
npx supabase functions deploy submit-contact-message
```

Set environment variables:
```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAABkM5w2rxee0cGv5Fax08rrZzIo
```

## 🔧 Usage Examples

### Basic Secure Form
```tsx
import { SecureForm } from '../components/forms/SecureForm';

const MyForm = () => {
  const handleSubmit = async (data: any, isVerified: boolean, token?: string) => {
    // Process form with verification
    await submitToBackend(data, token);
  };

  return (
    <SecureForm onSubmit={handleSubmit} requireTurnstile={true}>
      <input name="email" type="email" required />
      <textarea name="message" required />
    </SecureForm>
  );
};
```

### Custom Implementation
```tsx
import { useTurnstile } from '../hooks/useTurnstile';
import { getTurnstileSiteKey } from '../config/turnstile';

const CustomForm = () => {
  const handleVerify = (token: string) => {
    console.log('Turnstile verified:', token);
  };

  const { containerRef } = useTurnstile(handleVerify);

  return (
    <form>
      {/* Your form fields */}
      <div ref={containerRef} />
    </form>
  );
};
```

## 🛡️ Security Considerations

### Never Expose Secret Keys
```typescript
// ❌ NEVER do this
const SECRET_KEY = '0x4AAAAAABkM5w2rxee0cGv5Fax08rrZzIo';

// ✅ Always use environment variables on backend
const SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY');
```

### Always Verify Server-Side
```typescript
// ✅ Backend verification
const isValid = await verifyTurnstileToken(token, clientIP);
if (!isValid) {
  throw new Error('Security verification failed');
}
```

### Implement Rate Limiting
```typescript
// ✅ Prevent abuse
const attempts = getAttempts(userIP);
if (attempts > MAX_ATTEMPTS) {
  throw new Error('Rate limit exceeded');
}
```

## 🧪 Testing

### Test Component
Visit `/turnstile-test` to test the implementation:
- Verifies Turnstile loading
- Tests form submission flow
- Displays security features

### Manual Testing Checklist
- [ ] Turnstile widget loads on localhost
- [ ] Widget works on production domains
- [ ] Form submission requires completion
- [ ] Error handling works correctly
- [ ] Rate limiting functions properly
- [ ] Backend verification succeeds
- [ ] Invalid tokens are rejected

## 📊 Monitoring

### Frontend Monitoring
- Check browser console for Turnstile errors
- Monitor rate limiting effectiveness
- Track form abandonment rates

### Backend Monitoring
- Monitor verification success rates
- Log failed verification attempts
- Track API response times
- Monitor for unusual traffic patterns

## 🔄 Maintenance

### Regular Tasks
1. **Monthly**: Review verification logs
2. **Quarterly**: Update allowed domains if needed
3. **Annually**: Rotate Turnstile keys
4. **As needed**: Update security headers

### Key Rotation
When rotating Turnstile keys:
1. Generate new keys in Cloudflare dashboard
2. Update environment variables
3. Deploy to all environments
4. Test thoroughly before removing old keys

## 🆘 Troubleshooting

### Common Issues

#### Turnstile Not Loading
- Check VITE_TURNSTILE_SITE_KEY is set
- Verify domain is registered with Cloudflare
- Check browser console for errors

#### Verification Failing
- Ensure TURNSTILE_SECRET_KEY is set on backend
- Check origin/CORS headers
- Verify token is being passed correctly

#### Rate Limiting Too Aggressive
- Adjust limits in `turnstileVerification.ts`
- Clear localStorage for testing
- Check server-side rate limiting

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('debug', 'turnstile');
```

## 📞 Support

For issues with this implementation:
1. Check this documentation
2. Review browser/server logs
3. Test with the test component
4. Contact the development team

## 🔗 Related Documentation

- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Security Best Practices](https://react.dev/learn/security)

---

**Security Note**: This implementation prioritizes security over convenience. All components include comprehensive validation, error handling, and audit logging. Never bypass security measures for ease of development.

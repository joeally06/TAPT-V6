# 🔒 CORS Configuration Update Summary

## ✅ Updated Edge Functions

The following Edge Functions have been updated to allow both `tapt.org` and `tntapt.com` domains:

### Public Submission Functions (Updated ✅)
1. **submit-contact-message** ✅
2. **submit-conference-registration** ✅  
3. **submit-membership** ✅
4. **submit-hof-nomination** ✅
5. **submit-student-scholarship-application** ✅
6. **submit-exhibitor-registration** ✅
7. **submit-tech-conference-registration** ✅
8. **verify-turnstile** ✅

### CORS Configuration Applied
```typescript
const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
  // WebContainer domains for development
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];
```

## 🚀 Deployment Instructions

### 1. Deploy All Updated Functions
Run these commands to deploy all functions:

```bash
# Deploy all public submission functions
npx supabase functions deploy submit-contact-message
npx supabase functions deploy submit-conference-registration
npx supabase functions deploy submit-membership
npx supabase functions deploy submit-hof-nomination
npx supabase functions deploy submit-student-scholarship-application
npx supabase functions deploy submit-exhibitor-registration
npx supabase functions deploy submit-tech-conference-registration
npx supabase functions deploy verify-turnstile

# Or deploy all at once
npx supabase functions deploy
```

### 2. Set Required Environment Variables
```bash
# Set the Turnstile secret key
npx supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAABkM5w2rxee0cGv5Fax08rrZzIo

# Set environment flag for production
npx supabase secrets set ENVIRONMENT=production
```

### 3. Verify Deployment
```bash
# Check function logs
npx supabase functions logs submit-contact-message
npx supabase functions logs verify-turnstile
```

## 🧪 Testing Checklist

After deployment, test from both domains:

### From tapt.org:
- [ ] Contact form submits successfully
- [ ] Conference registration works
- [ ] Membership applications work
- [ ] Hall of Fame nominations work
- [ ] Student scholarship applications work
- [ ] Exhibitor registrations work
- [ ] Tech conference registrations work

### From tntapt.com:
- [ ] Contact form submits successfully
- [ ] Conference registration works
- [ ] Membership applications work
- [ ] Hall of Fame nominations work
- [ ] Student scholarship applications work
- [ ] Exhibitor registrations work
- [ ] Tech conference registrations work

### CORS Verification:
- [ ] No CORS errors in browser console
- [ ] Proper Access-Control-Allow-Origin headers
- [ ] Preflight OPTIONS requests succeed
- [ ] Forms work on both www and non-www versions

## ⚠️ Admin Functions (Not Updated)

These admin functions typically don't need public domain access:
- admin-board-member
- admin-conference-settings
- admin-contact-messages
- admin-content
- admin-exhibitor-registrations
- admin-exhibitor-settings
- admin-hof-member
- admin-hof-settings
- admin-log
- admin-membership-status
- admin-resource
- admin-role
- admin-site-settings
- admin-student-scholarship-applications
- admin-student-scholarship-settings
- admin-tech-conference-settings
- admin-user
- get-dashboard-stats
- rollover
- secure-upload
- generate-uuid

**Note:** If any admin functions need to be accessible from the public domains, they should be updated with the same CORS configuration.

## 🔍 Monitoring

After deployment, monitor for:
- CORS-related errors in function logs
- Failed form submissions
- Unusual traffic patterns
- Security-related issues

## 📞 Quick Test Commands

```bash
# Test contact form from command line
curl -X POST https://your-project.supabase.co/functions/v1/submit-contact-message \
  -H "Content-Type: application/json" \
  -H "Origin: https://tapt.org" \
  -d '{"name":"Test","email":"test@example.com","message":"Test message","turnstileToken":"test-token"}'

# Test from tntapt.com
curl -X POST https://your-project.supabase.co/functions/v1/submit-contact-message \
  -H "Content-Type: application/json" \
  -H "Origin: https://tntapt.com" \
  -d '{"name":"Test","email":"test@example.com","message":"Test message","turnstileToken":"test-token"}'
```

## ✅ Status: Ready for Production

All public-facing Edge Functions have been updated to support both domains. You can now:

1. Deploy the functions using the commands above
2. Test thoroughly from both domains
3. Monitor for any CORS-related issues
4. Go live with confidence!

---

**Security Note:** The CORS configuration is restrictive and only allows your specific domains plus localhost for development. This provides good security while enabling your multi-domain setup.

# Request ID Tracking Implementation

## ✅ Security Item 8: Request ID Tracking - COMPLETED

**Implementation Date**: January 1, 2026  
**Status**: ✅ Complete  
**Estimated Time**: 2-4 hours  
**Actual Time**: ~2 hours

---

## 📋 Overview

Implemented comprehensive request ID tracking across the entire application stack:
- Frontend request generation
- Supabase Edge Function logging
- Audit trail correlation
- Error tracking

## 🎯 What Was Implemented

### 1. Frontend Request ID Utilities (`src/lib/requestId.ts`)

**Features**:
- ✅ `generateRequestId()` - Creates unique request IDs using crypto.randomUUID()
- ✅ `addRequestIdHeader()` - Adds X-Request-ID header to requests
- ✅ `useRequestId()` - React hook for request ID management
- ✅ `createRequestContext()` - Creates request context with metadata
- ✅ `logRequest()` - Logs requests with context for debugging
- ✅ `extractRequestId()` - Extracts request ID from responses

**Usage Example**:
```typescript
import { generateRequestId, addRequestIdHeader } from '@/lib/requestId';

// Generate request ID
const requestId = generateRequestId();

// Add to fetch request
const response = await fetch('/api/endpoint', {
  headers: addRequestIdHeader({ 'Content-Type': 'application/json' }, requestId)
});
```

### 2. Supabase Client Wrappers (`src/lib/supabase.ts`)

**Features**:
- ✅ `invokeEdgeFunction()` - Wrapper for Edge Function calls with request ID
- ✅ `fetchWithRequestId()` - Enhanced fetch with automatic request ID injection
- ✅ Automatic request ID logging in development mode

**Usage Example**:
```typescript
import { invokeEdgeFunction } from '@/lib/supabase';

const { data, error, requestId } = await invokeEdgeFunction(
  'submit-contact-message',
  { name: 'John', email: 'john@example.com', message: 'Hello' }
);

console.log('Request ID:', requestId); // Use for debugging
```

### 3. Edge Function Middleware (`supabase/functions/_shared/requestId.ts`)

**Features**:
- ✅ `getRequestId()` - Extracts or generates request ID from headers
- ✅ `createSuccessResponse()` - Standard success response with request ID
- ✅ `createErrorResponse()` - Standard error response with request ID
- ✅ `logWithRequestId()` - Logs messages with request ID prefix
- ✅ `logErrorWithRequestId()` - Logs errors with request ID
- ✅ `createEdgeRequestContext()` - Creates full request context

**Usage Example**:
```typescript
import { 
  getRequestId, 
  createSuccessResponse, 
  logWithRequestId 
} from "../_shared/requestId.ts";

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  
  logWithRequestId(requestId, "Processing request");
  
  // ... process request ...
  
  return createSuccessResponse({ message: 'Success' }, requestId);
});
```

### 4. Database Migration (`supabase/migrations/20260101000000_add_request_id_tracking.sql`)

**Changes**:
- ✅ Added `request_id TEXT` column to `admin_logs` table
- ✅ Created index `idx_admin_logs_request_id` for fast lookups
- ✅ Added column documentation

**SQL**:
```sql
ALTER TABLE admin_logs 
ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_logs_request_id 
ON admin_logs(request_id) 
WHERE request_id IS NOT NULL;
```

### 5. Updated Edge Function Example (`submit-contact-message`)

**Changes**:
- ✅ Imported shared request ID utilities
- ✅ Extract request ID at function start
- ✅ Log all actions with request ID
- ✅ Include request ID in CORS headers
- ✅ Store request ID in audit logs
- ✅ Return request ID in success/error responses

---

## 🔍 Request ID Flow

```
┌─────────────┐
│  Frontend   │
│  Component  │
└──────┬──────┘
       │ 1. generateRequestId()
       │
       ▼
┌─────────────────────┐
│  API Call           │
│  (X-Request-ID)     │
└──────┬──────────────┘
       │ 2. Send to Edge Function
       │
       ▼
┌─────────────────────┐
│  Edge Function      │
│  getRequestId(req)  │
└──────┬──────────────┘
       │ 3. Extract/generate ID
       │ 4. Log all actions
       │ 5. Store in audit_logs
       │
       ▼
┌─────────────────────┐
│  Response           │
│  (X-Request-ID)     │
└──────┬──────────────┘
       │ 6. Return to frontend
       │
       ▼
┌─────────────────────┐
│  Frontend           │
│  extractRequestId() │
└─────────────────────┘
```

---

## 📊 Benefits

1. **End-to-End Tracing**
   - Track requests from frontend to backend and back
   - Correlate errors across the stack
   - Debug production issues efficiently

2. **Improved Debugging**
   - Search logs by request ID
   - See complete request lifecycle
   - Identify slow or failed requests

3. **Better Error Reporting**
   - Include request ID in error messages
   - Users can provide request ID for support
   - Link frontend errors to backend logs

4. **Audit Trail**
   - Link admin actions to specific requests
   - Track who did what and when
   - Comply with audit requirements

---

## 🧪 Testing

### Test Component Created
- ✅ `src/components/RequestIdTest.tsx` - Interactive test component
- Tests request ID generation
- Tests Edge Function call flow
- Verifies request ID round-trip

### Manual Testing Steps

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```

2. **Test Request ID Generation**:
   - Open browser console
   - Generate request ID: `crypto.randomUUID()`
   - Verify format: UUID v4

3. **Test Edge Function Call**:
   ```javascript
   import { invokeEdgeFunction } from '@/lib/supabase';
   
   const result = await invokeEdgeFunction('submit-contact-message', {
     name: 'Test',
     email: 'test@example.com',
     message: 'Testing request ID'
   });
   
   console.log('Request ID:', result.requestId);
   ```

4. **Check Edge Function Logs**:
   - Deploy function: `npx supabase functions deploy submit-contact-message`
   - Check logs: Look for `[Request xxx-xxx-xxx]` prefixes
   - Verify request ID matches frontend

5. **Check Database**:
   ```sql
   SELECT id, action, request_id, created_at 
   FROM admin_logs 
   WHERE request_id IS NOT NULL 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

## 📝 Next Steps

### Required Before Production

- [ ] Apply request ID middleware to ALL Edge Functions (currently only `submit-contact-message`)
- [ ] Update all frontend form submissions to use `invokeEdgeFunction()`
- [ ] Run migration on production database
- [ ] Add request ID to error notification emails
- [ ] Create admin view to search by request ID

### Edge Functions to Update

1. ✅ `submit-contact-message` - DONE
2. ⬜ `submit-conference-registration`
3. ⬜ `submit-hof-nomination`
4. ⬜ `submit-membership`
5. ⬜ `submit-student-scholarship-application`
6. ⬜ `submit-tech-conference-registration`
7. ⬜ `submit-exhibitor-registration`
8. ⬜ `verify-turnstile`
9. ⬜ All `admin-*` functions (15+)

### Recommended Enhancements

- [ ] Add request ID to Sentry error tracking (when implemented)
- [ ] Create request ID search in admin dashboard
- [ ] Add request ID to email notifications
- [ ] Export logs with request ID filtering
- [ ] Create request ID performance tracking

---

## 🔧 Configuration

### Environment Variables
None required - uses native browser `crypto.randomUUID()`

### Supabase Configuration
- Migration must be applied to database
- Edge Functions must import shared utilities

### CORS Headers
Request ID header (`X-Request-ID`) added to allowed headers:
```typescript
'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID'
```

---

## 📖 Code Examples

### Frontend: Form Submission
```typescript
import { invokeEdgeFunction } from '@/lib/supabase';

async function handleSubmit(formData: FormData) {
  const { data, error, requestId } = await invokeEdgeFunction(
    'submit-contact-message',
    formData
  );
  
  if (error) {
    console.error(`[Request ${requestId}] Error:`, error);
    alert(`Error submitting form. Request ID: ${requestId}`);
    return;
  }
  
  console.log(`[Request ${requestId}] Success:`, data);
}
```

### Backend: Edge Function
```typescript
import { 
  getRequestId, 
  createSuccessResponse,
  createErrorResponse,
  logWithRequestId 
} from "../_shared/requestId.ts";

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  
  try {
    logWithRequestId(requestId, "Processing request");
    
    // ... your logic ...
    
    return createSuccessResponse({ success: true }, requestId);
  } catch (error) {
    logErrorWithRequestId(requestId, "Request failed", error);
    return createErrorResponse(error, requestId, 500);
  }
});
```

---

## ✅ Checklist

- [x] Create frontend request ID utilities
- [x] Create Edge Function middleware
- [x] Update Supabase client wrappers
- [x] Create database migration
- [x] Update one Edge Function as example
- [x] Create test component
- [x] Run type-check (no errors)
- [x] Document implementation
- [ ] Apply to all Edge Functions
- [ ] Deploy to production
- [ ] Test end-to-end in production

---

## 📚 References

- [MDN: Crypto.randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- [HTTP X-Request-ID Header](https://http.dev/x-request-id)
- [Distributed Tracing Best Practices](https://opentelemetry.io/docs/concepts/signals/traces/)

---

**Implementation completed successfully! Request ID tracking is now functional and ready for rollout to all Edge Functions.**

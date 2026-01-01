# TAPT Website Development Guide

## Architecture Overview

This is a **React 18 + TypeScript + Vite** SPA for the Tennessee Association of Pupil Transportation, with **Supabase** backend (PostgreSQL + Edge Functions) and **Cloudflare Turnstile** bot protection on all public forms.

### Key Stack Components
- **Frontend**: React 18, TypeScript, Tailwind CSS, React Router 6
- **Backend**: Supabase (PostgreSQL with RLS, Edge Functions in Deno)
- **Security**: Cloudflare Turnstile, CORS validation, rate limiting
- **Build**: Vite with path aliases (`@/` → `src/`)

## Critical Patterns

### 1. Authentication & Authorization
- **Auth flow**: Uses Supabase Auth + custom role management via RPC calls
- **Role retrieval**: ALWAYS use `supabase.rpc('get_user_role', { user_id })` to avoid RLS recursion
- **Protected routes**: Wrap admin pages with `<ProtectedRoute requireAdmin>` (see [src/App.tsx](src/App.tsx))
- **Auth context**: Global auth state via [src/context/AuthContext.tsx](src/context/AuthContext.tsx)

```typescript
// CORRECT: Get user role via RPC
const { data: role } = await supabase.rpc('get_user_role', { user_id });

// INCORRECT: Direct table access causes RLS recursion
const { data } = await supabase.from('users').select('role')...
```

### 2. Form Security (Cloudflare Turnstile)
- **All public forms** must use `SecureForm` wrapper from [src/components/forms/SecureForm.tsx](src/components/forms/SecureForm.tsx)
- **Verification**: Token sent to Edge Functions for server-side validation
- **Configuration**: 
  - Site key: `src/config/turnstile.ts` (frontend)
  - Secret key: Supabase secrets (backend)
- **Domains**: `tapt.org`, `tntapt.com`, `localhost` (update both frontend config and Edge Function CORS)

Example form submission:
```tsx
<SecureForm onSubmit={async (data, isVerified, token) => {
  // Backend edge function verifies token before processing
  await submitToEdgeFunction({ ...data, turnstileToken: token });
}}>
```

### 3. Supabase Edge Functions
- **Location**: `supabase/functions/*/index.ts` (Deno runtime)
- **Pattern**: All submission endpoints (`submit-*`) verify Turnstile + validate CORS origins
- **CORS**: Hardcoded allowed origins array in each function (not DRY by design for security)
- **Deployment**: `npm run deploy:functions` or `npx supabase functions deploy`
- **Secrets**: Set via `npx supabase secrets set KEY=value`

Example Edge Function structure:
```typescript
// 1. Define allowed origins (must match frontend domains)
const allowedOrigins = ['https://tapt.org', 'https://www.tapt.org', ...];

// 2. Verify Turnstile token before processing
const isValid = await verifyTurnstileToken(token, userIP);

// 3. Use service role client for RLS bypass
const supabaseAdmin = createClient(url, serviceRoleKey);
```

### 4. Database Access
- **Direct queries**: Use `supabase.from('table_name')` for CRUD
- **RPC calls**: Prefer for complex operations or RLS-sensitive queries
- **Service role**: Edge Functions use service role key to bypass RLS when needed
- **Migrations**: All in `supabase/migrations/*.sql` - use Supabase CLI to manage

### 5. Path Aliases (Vite)
Use `@/` prefix for clean imports (configured in [vite.config.ts](vite.config.ts)):
```typescript
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/context/AuthContext';
```

## Development Workflow

### Essential Commands
```bash
npm run dev              # Start dev server (localhost:5173)
npm run build            # Production build
npm run preview          # Test production build locally
npm run type-check       # TypeScript validation
npm run lint:fix         # Auto-fix linting issues

# Supabase
npx supabase start       # Local Supabase (requires Docker)
npx supabase functions deploy  # Deploy all Edge Functions
npx supabase gen types typescript --local > src/types/database.types.ts
```

### Multi-Domain Support
- Configured for `tapt.org` and `tntapt.com`
- Update CORS in **both**:
  1. Frontend: [src/config/turnstile.ts](src/config/turnstile.ts)
  2. Backend: Each Edge Function's `allowedOrigins` array

### Debugging
- **Auth issues**: Check `supabase.rpc('get_user_role')` - likely RLS recursion if direct table access
- **Form submissions**: Verify Turnstile token in browser console + Edge Function logs
- **CORS errors**: Ensure origin in both frontend config and Edge Function `allowedOrigins`

## Project-Specific Conventions

1. **Form submissions**: All go through Edge Functions (never direct Supabase inserts from frontend)
2. **Error handling**: Use `sanitizeError()` in Edge Functions to avoid exposing internals
3. **Logging**: Extensive console logs in Edge Functions for debugging (production-safe)
4. **Admin pages**: Prefix with `Admin*`, place in `src/pages/Admin*.tsx`
5. **Edge Functions**: Mirror frontend submission endpoints (e.g., `submit-contact-message`)

## Common Tasks

### Adding a New Public Form
1. Create form component using `SecureForm` wrapper
2. Create Edge Function in `supabase/functions/submit-[name]/`
3. Add CORS origins + Turnstile verification to Edge Function
4. Deploy: `npx supabase functions deploy submit-[name]`
5. Update route in [src/App.tsx](src/App.tsx)

### Adding a New Admin Page
1. Create page in `src/pages/Admin*.tsx`
2. Wrap route with `<ProtectedRoute requireAdmin>` in [src/App.tsx](src/App.tsx)
3. Add navigation link in admin layout

### Modifying Database Schema
1. Create migration: `npx supabase migration new [description]`
2. Write SQL in `supabase/migrations/`
3. Apply: `npx supabase db reset` (local) or push to production
4. Regenerate types: `npm run supabase:gen-types`

## Security Reminders
- ✅ Never expose `TURNSTILE_SECRET_KEY` in frontend code
- ✅ Always verify Turnstile tokens server-side (Edge Functions)
- ✅ Use RPC calls for user role checks to avoid RLS recursion
- ✅ Validate CORS origins in Edge Functions
- ✅ Rate limit on backend (5 attempts/15min pattern in Turnstile utils)

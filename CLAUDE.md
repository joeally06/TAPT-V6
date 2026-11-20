# CLAUDE.md
**TAPT Website (TAPT-V6)** — React single-page app for the Tennessee Association of Pupil Transportation: a public site (news, events, board, resources, photo gallery, Hall of Fame), public forms (conference, tech conference, exhibitor, regional luncheon, student scholarship, membership, nominations, contact), and an admin area for staff. Languages: TypeScript (edge functions are Deno TypeScript; a few `.js`/`.ts` helper scripts in `scripts/`). Frameworks: React 18, Vite 6, TypeScript 5.8, Tailwind CSS 3, React Router 6. Backend: Supabase (hosted Postgres with RLS, Auth, Storage, about 50 edge functions), Resend (email), PayPal, Cloudflare Turnstile. Package manager(s): npm.

## Commands

Build:
- `npx tsc -p tsconfig.app.json --noEmit` — the real typecheck (~7 s). `npm run type-check` (`tsc --noEmit`) checks nothing: the root `tsconfig.json` has `files: []`, so it always exits 0. Do not treat it as a signal.
- `npm run build` — `rimraf dist` then `vite build`; does **not** typecheck; writes gitignored `dist/`. `npm run build:strict` runs `tsc -b` first.

Test:
- There is no test framework and no unit tests.
- `npx eslint <touched .ts/.tsx files>` — compare with the baseline before the change (see Project-specific rules)
- `npm run lint` — whole repo; uses `--max-warnings 0`, so it fails today
- `npm run test:security` (`scripts/test-input-sanitization.js`) — **ask first**: it sends attack payloads to the live Supabase edge functions, not a local copy
- Edge functions in `supabase/functions/` are not typechecked, linted, or run by any command here. Review them by reading; deploying is the only real test, and deploying is forbidden.

Baseline measured 2026-11-20 (do not add to it): typecheck 89 errors; eslint 345 errors and 16 warnings; `prettier --check "src/**"` flags 98 files.

Preflight (final gate): none exists. Instead run, on the final code: the typecheck, `npx eslint` on touched files, and `npm run build`, and compare the first two with the baseline above (count for touched files before and after; no new errors). Say that no preflight exists, and offer to create one (do not create it unasked).
Fast verify: `npx tsc -p tsconfig.app.json --noEmit` then `npm run build`.

## Repository

- Key directories:
  - `src/pages/` — public pages and `Admin*.tsx` admin pages; routes are all declared in `src/App.tsx`
  - `src/components/` — `AdminLayout.tsx` (admin sidebar), `ProtectedRoute.tsx`, `Navbar.tsx`, `forms/` (`SecureForm`, `PayPalButton`, …), `ui/`
  - `src/context/AuthContext.tsx` — auth state; `src/lib/` — `supabase.ts`, `siteSettings.ts`, `validation.ts`, upload and gallery helpers; `src/config/` — `turnstile.ts`, `paypal.ts`
  - `supabase/functions/` — `submit-*` (public form endpoints), `admin-*` (admin writes), `resend-*` (re-send emails), `get-dashboard-stats`, `send-payment-receipt`, and `_shared/` (`email.ts`, `emailTemplates.ts`, `sanitize.ts`, `settings.ts`, `requestId.ts`)
  - `supabase/migrations/` — SQL migrations (newest is `20260418300000_increase_featured_limit_10.sql`); `docs/` — guides and plans; `Tools/Supabase/` — a vendored `supabase.exe`: do not run it, use `npx supabase` only for read-only commands
- Architecture: pages read public tables directly with `supabase-js` under RLS; form submissions and admin writes call edge functions with `fetch`. Do not add a state library, a data-fetching library, or a service layer. Routes are imported eagerly in `App.tsx`.
- CI environment: none (`.github/` holds only `copilot-instructions.md`). Nothing checks a commit automatically.
- OS requirements: dev host is Windows (PowerShell). Production is a self-hosted Ubuntu server: `/var/www/tapt`, PM2 process `tapt-app`, Nginx on port 3000, updated by `quick-deploy.sh` (`git pull origin TAPTv6` → `npm install` → typecheck → build → `pm2 restart`). Branch `TAPTv6` is the only branch.
- Build layout constraints: single Vite app, not a monorepo. Path alias `@/` maps to `src/` (also `@/components`, `@/lib`, …), but most existing files use relative imports; match the file you are editing.
- Large disk side-effects: `npm run build` writes `dist/` (gitignored)
- Special constraints:
  - There is one Supabase project and it is production. The URL is in `.env` and in the `vite.config.ts` proxy. There is no staging. Any form submit, admin action, or request made from a dev server or script changes live data and can send real email (Resend) or touch real payments.
  - Commits to `TAPTv6` can reach the live site the next time `quick-deploy.sh` runs on the server. A broken build or a bad migration has real cost.

### Project-specific rules

- **Authorization lives in the edge functions.** `ProtectedRoute requireAdmin` and client-side role checks only hide pages. Every `admin-*`, `get-*`, and `resend-*` function must verify the bearer token (`supabaseAdmin.auth.getUser(token)`) and that the user's role is `admin` before doing anything (pattern: `supabase/functions/get-dashboard-stats/index.ts`). In browser code, read a user's role with `supabase.rpc('get_user_role', { user_id })`, never by selecting from the users table, which causes RLS recursion.
- **New public submission endpoints** copy the `submit-*` pattern: origin allowlist, Turnstile token verified server-side, `_shared/sanitize.ts` on every field, service-role insert, then email. Do not trust client-supplied amounts, prices, status, or identity; take them from settings tables. Every public form uses `SecureForm`.
- **CORS lists are copied into each function on purpose.** A new domain means editing every function. Do not copy the `Access-Control-Allow-Origin: '*'` preflight in `send-payment-receipt`.
- **Schema comes only from migrations.** Add `supabase/migrations/<YYYYMMDDHHMMSS>_name.sql` with a timestamp later than the newest file. Check the newest first: some names are date-only (`20260205_*`) and `20260128000000` is used twice. Never edit an applied migration. Write them idempotently (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Enable RLS on every new table and write explicit policies. The user applies migrations.
- **Env vars and secrets.** `.env` is gitignored and holds live keys; never print it. Only names in `VITE_*` may ship to the browser (Supabase URL and anon key, Turnstile site key, PayPal client id). The service-role key, Resend key, Turnstile secret, and PayPal secret live only in Supabase secrets. The `deploy:secrets:example` script in `package.json` contains a hardcoded Turnstile secret value: never copy or repeat it. New variables are documented in `README.md`.
- **Rendering user content.** Anything from the database shown as text passes through `DOMPurify` (see `Home.tsx`). `dompurify` is imported but not listed in `package.json` (it arrives through `jspdf`); adding it to `package.json` needs the user's approval.
- **Styling.** Tailwind 3 with `tailwind.config.js` tokens: `tapt-navy`, `tapt-blue`, `tapt-gold`, `tapt-green`, `tapt-orange`, plus legacy `primary`/`secondary`/`accent`. Fonts: Inter body, Montserrat headings (`font-heading`). Icons from `lucide-react`. No component library. Keep forms and pages meeting `docs/WCAG_2.1_ACCESSIBILITY_AUDIT.md` (labels, visible focus, contrast).
- **Lint and format baseline.** `eslint` and `tsc` already fail on many existing files. Run both on touched files before and after your change and add nothing new. Do not mass-fix, and do not run `npm run format` or `lint:fix` (they rewrite dozens of files). `supabase/functions/**` is not linted.
- **Docs:** keep `README.md` and `docs/` in sync when behaviour changes. `.github/copilot-instructions.md` is a useful guide but is not authoritative; where it disagrees with the code, trust the code.
- **Commit scopes** (this repo's history uses plain imperative messages, but the template below still applies): `home`, `news`, `events`, `forms`, `admin`, `auth`, `payments`, `email`, `functions`, `db`, `gallery`, `nominations`, `deploy`.

## Forbidden commands

Never run these.

### Universal (all repositories)

- `git add` (any form)
- `git commit` (any form, including `--amend`)
- `git push` (any form, including `--force`)
- `git stash` (any form, including `pop`, `apply`, `drop`)
- Any other git command that stages, commits, pushes, or stashes changes

What gets staged, committed, pushed, or stashed is the user's decision; the commit message at the end of every change is what the user runs. Read-only git (`status`, `log`, `diff`, `show`) is allowed.

### Project-specific

The Supabase project is production. Treat its database, storage, functions, and secrets as live.

- `npx supabase db push`, `db reset`, `migration repair`, `link`, `functions deploy`, `secrets set`, and the npm scripts `deploy:functions`, `deploy:secrets`, `deploy:secrets:example` — reason: change the live database, functions, or secrets. Use instead: write the migration or function file and give the user the exact command to run
- `npm run supabase:start`, `supabase:stop`, `supabase:reset`, `supabase:gen-types` — reason: Docker containers and a local database sit outside the repository. Use instead: none — ask the user
- Any mutating request (POST, PUT, PATCH, DELETE, an RPC that writes) to the live Supabase REST API, auth API, storage, or edge functions, including with `curl` — reason: writes production data, sends real email, can touch payments. Use instead: read the code and migrations
- Submitting a real form or using an admin action in a running dev server, and `npm run test:security`, `scripts/test-rls.js`, `scripts/check-user.js`, `scripts/check-tables.js` — reason: they use `.env` credentials against the live project (the first sends attack payloads to live functions). Use instead: none — only when the user asks
- `quick-deploy.sh`, `rollback.sh`, `server-setup.sh`, `server-status.sh`, `deploy-email-settings.ps1`, and `pm2 ...` — reason: they pull, reinstall, restart, or deploy on the live server or project. Use instead: none — ask the user
- `update-cors.ps1` — reason: rewrites the CORS list in every edge function. Use instead: none — only when the user asks
- `npm run dev`, `npm start`, `npm run preview` — reason: long-running and pointed at the live backend. Use instead: `npm run build`; run a server only in the background and only if the user asks, and never submit forms or use admin actions in it
- `npm audit fix`, `npm update`, `npm run update:deps`, `npm install <pkg>` — reason: change `package-lock.json`. Use instead: none — only when the user asks
- `npm run format`, `npm run lint:fix` — reason: rewrite many files that are not part of the task. Use instead: format only the files you changed
- Printing, logging, committing, or pasting `.env*` contents or secret values — reason: secrets. Use instead: variable names only
- `git reset`, `git checkout`, `git restore`, `git clean` — reason: discard uncommitted work, and the working tree often holds the user's work in progress. Use instead: `git diff`, `git status`

## How to work

### Task size

State the tier in one line before starting.

- **Tier 1 — ask or explore** (questions, reading code, anything that changes no files): just answer. No commit message.
- **Tier 2 — standard change** (bug fix, small feature, config or docs change; a few files, no new dependency, no change to a public interface, schema, or build config): research → brief plan in chat (goal, assumptions, docs consulted, steps with how each is verified) → implement → verify → final gate → commit message.
- **Tier 3 — major change** (new dependency; many files or modules; a migration or schema change; a new or changed edge function; security-sensitive code, auth, payments, or email; build or deploy config; hard to reverse): in plan mode: research → full plan (including docs consulted) → **wait for approval** (the user approving the plan) → implement → verify → independent review → final gate → commit message.

If a task fits two tiers, use the larger. If a Tier 2 task grows, stop, say so, and continue as Tier 3. The user can ask for more or less process ("just do it", "full process"); verification, forbidden commands, and the commit message still apply.

Plan mode: for Tier 3, and before any new feature or design decision with real tradeoffs, enter plan mode yourself if you can; otherwise ask the user to switch (Shift+Tab) before planning.

### Principles

1. **Think before coding.** State your assumptions. If a request has several valid readings, present them or ask; never pick one silently. If a simpler approach exists, say so.
2. **Simplicity first.** Write the minimum code that solves the problem: no extra features, no abstractions for single-use code, no unrequested configurability, no handling for cases that cannot happen. If 200 lines could be 50, rewrite it.
3. **Surgical changes.** Every changed line must trace to the request. Do not refactor or tidy adjacent code; match the existing style. Remove only the imports, variables, and functions your change orphaned. Mention unrelated dead code instead of deleting it.
4. **Goal-driven.** Turn the task into a check you can run before you start: bug fix → reproduce it first (a failing check or a clear manual repro), then fix; new behaviour → say how it will be checked; refactor → typecheck and build pass before and after. This repo has no unit-test framework; do not add one unasked. For multi-step work, list the steps with "→ verify: …" for each.

### Done means verified

- Do not call work finished until the typecheck, eslint, and build have actually run and you have reported the real output. Never write "passes" for something you did not run. Say plainly what could not be run (edge functions cannot be run or deployed from here; UI changes cannot be exercised against the live backend).
- After a scripted or multi-file edit, confirm it applied (`git diff`) before running checks. Formatters can change lines between your edit and the check.
- Final gate: see Preflight above. A new error in a touched file, or a failed build, means the work is not finished.
- Mechanical bugs in tooling or scripts that block a check (a shell error, a typo, a broken path) are fixed without asking, reported in one line, and listed in the commit message. Anything that changes behaviour still needs the user.
- If your first attempt at a bug fix fails, stop and re-plan before the next attempt (plan mode for Tier 3, a revised plan in chat for Tier 2). Do not stack more edits on an approach that did not work.
- Do not create spec, plan, or review files in the repository unless asked.

### Review findings

- Tier 3: before the final gate, have a reviewer subagent review the diff if one is available. Give it the approved plan and the changed files, not your conclusions. Otherwise review `git diff` yourself and say it was a self-review.
- Fix every in-scope finding, CRITICAL or RECOMMENDED, without asking. Then re-run the checks and the review. Repeat until the review has nothing left that needs a code change.
- Ask the user before fixing a finding only if the fix would change behaviour the user specified, add or upgrade a dependency, touch state outside the repository, or go beyond the task's scope.
- After 3 fix cycles that still fail (a failed review or check, fixed, failed again), STOP and report everything. Do not loop silently.
- Done means nothing in scope is left to fix. Do not end with "not implemented", "known issues", or "things I didn't touch" lists. Anything genuinely out of scope gets one line.

### Outside the repository

- Never change state outside the repository without asking: the Supabase project, containers, installed packages, system or user configuration, the server. Reading it is fine.
- If the harness or a permission rule denies a command, do not work around it with another command. Say what was denied and ask.

### Do not guess state

Before saying what is committed, pushed, or up to date, check: `git status`; `git log --oneline origin/$(git branch --show-current)..HEAD` (empty output means fully pushed); `stat <lockfile>`. Never tell the user to push, commit, or update without checking first. Never say a migration or function "is deployed" or "is live": you cannot see that. Say it needs to be applied or deployed by the user.

### Research before changing

For Tier 2 and Tier 3, research comes before the plan, and the plan shows what you found.

1. **Read the code first.** Read the files you will change and the nearest existing code that does something similar (for a form, the closest `submit-*` function and its page; for an admin page, the closest `Admin*.tsx` and `admin-*` function). Reuse its patterns and helpers.
2. **Check current docs for every external library, framework, CLI, or API the change uses or touches, including ones already in the lock file.** Look up the version in use (the manifest or lock file says which). Use the Context7 MCP if available (resolve the library, then query its docs); otherwise the official documentation. Do not rely on memory for signatures, options, flags, or default behaviour. Pinned versions matter here: React 18, React Router 6, Tailwind 3, Vite 6, and `@supabase/supabase-js` 2.x in the app but 2.39.3 in the edge functions. When a failure involves a library, search its docs and issue tracker for the error before choosing a fix. You may hand lookups to a `docs` subagent if one is present; check that its excerpt supports its answer before relying on it.
3. **Tier 3 only:** for any dependency being added or upgraded, also read its release notes or changelog and check for deprecations and known advisories. When choosing between libraries, compare at least two.
4. **Show it.** The plan has a line `Docs consulted:` naming each source and what it settled. Write `Docs consulted: none needed — <reason>` only when the change uses no external library or API (pure internal logic, comments, docs, formatting). If a lookup fails or the docs contradict the code, say so and ask; do not guess.

### Communication

- Lead with the answer or result. Use short sentences and plain words.
- Include only what the user needs: the result, what changed, what they must decide, and real check output. Do not restate the request, narrate your steps, or summarize what you just showed.
- Prefer plain wording to jargon and abbreviations. If a technical term is needed, explain it once.
- Use a list only for three or more parallel items. No headings in short replies.
- This does not shorten required content: the plan, the `Docs consulted:` line, failure output, and the commit message stay complete.

### Commit message (final step of every change)

Every change that modifies files ends with a commit message, however small (a one-line typo fix included). It is the last thing in your reply. You never run `git commit`; the user does.

Give exactly **one** commit message covering every file you changed since the last commit message you gave, including earlier tasks that have not been committed yet. Never split your work into several messages. The working tree may also hold the user's own uncommitted work (for example edited docs or scripts); do not list files you did not change, and say in one line when `git status` shows such files so the user can leave them out of the commit.

Format, ready to paste into `git commit`:

```
<type>(<scope>): <description — MAX 72 characters total>

<PARAGRAPH EXPLAINING WHAT CHANGED AND WHY>

Modified Files:
- path/to/file1
- path/to/file2
- path/to/file3

✔ Build successful
✔ Typecheck: no new errors
✔ Lint: no new errors
✔ Review approved
```

Valid types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`. Example first line: `feat(home): add admin-controlled site alert bar`

Inside the message: no "Commit Message" heading, no "Edited" summary, no diff statistics, nothing outside the template. List new files under Modified Files too.

Checkmark lines appear only for checks that actually ran and passed on the final code in this session; never include a line for a skipped check. Because the repo already has typecheck and lint errors, the typecheck and lint lines mean "no new errors in the files I touched compared with before", and you say so in the paragraph. `✔ Review approved` means the Tier 3 review returned PASS (write `✔ Review approved (self-review)` if no independent reviewer was used). Do not write a Preflight line (none exists). Edge functions and migrations are never run here: say in the paragraph that they still need to be deployed or applied by the user.

After the message, if every check that ran passed, add one line:
> All checks passed. Code is ready to push to GitHub.

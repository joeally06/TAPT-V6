# WCAG 2.1 Level AA Accessibility Audit Report

**Site:** TAPT (Tennessee Association of Pupil Transportation)  
**Date:** February 14, 2026  
**Methodology:** Static code analysis of React/TypeScript source  
**Standard:** [WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/)

---

## Executive Summary

This report identifies **25 accessibility issues** across the TAPT website based on a comprehensive static code audit against WCAG 2.1 Level AA criteria. The site has a solid foundation — responsive design, good landmark usage in some areas, and several well-built accessible components. However, critical gaps exist in dynamic content announcements, keyboard navigation, and modal accessibility that must be addressed.

| Severity | Count |
|----------|-------|
| **Critical** | 5 |
| **Major** | 12 |
| **Minor** | 8 |

> **Note:** Registration forms (Conference, Tech Conference, Exhibitor, Student Scholarship, Regional Luncheon, Hall of Fame Nomination) were excluded from this audit per request.

---

## What's Already Working Well

Before diving into issues, here's what the site currently does right:

- ✅ **Skip navigation link** — properly implemented with `sr-only`/`focus:not-sr-only` pattern
- ✅ **Footer** has `role="contentinfo"` landmark
- ✅ **Navbar** has `aria-label="Main navigation"` and accessible mobile hamburger button with `aria-label` and `aria-expanded`
- ✅ **SuccessModal** — well-built with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, Escape key handling, body scroll lock, and `autoFocus` on the OK button
- ✅ **ConferenceGallery lightbox** — has `role="dialog"`, `aria-modal`, keyboard navigation (arrow keys, Escape), proper `aria-label` on all buttons
- ✅ **`<html lang="en">`** is set in `index.html`
- ✅ **Viewport meta** allows user zoom (no `maximum-scale=1` or `user-scalable=no`)
- ✅ **Global focus-visible styles** defined in `index.css` for all interactive elements
- ✅ **Contact form** has proper `<label htmlFor>` + `id` associations on all fields
- ✅ **Admin tables** consistently use `<th scope="col">` headers
- ✅ **Social media links** in Footer have descriptive `aria-label` and `aria-hidden="true"` on icons
- ✅ **Image alt text** — most images have meaningful alt text throughout the site

---

## PRINCIPLE 1: PERCEIVABLE

Information and user interface components must be presentable to users in ways they can perceive.

### P1-01 — No `aria-live` regions anywhere in the application

| | |
|---|---|
| **WCAG** | 4.1.3 Status Messages (Level AA) |
| **Severity** | 🔴 Critical |
| **Files** | Site-wide — all pages and components |

**Issue:** No `aria-live`, `role="alert"`, or `role="status"` attributes exist anywhere in the codebase. This means:

- Form submission success/error messages are **not announced** to screen readers
- Loading state changes (spinners appearing/disappearing) are **silent**
- Toast-style notifications are **invisible** to assistive technology
- Route changes produce **no announcement**

**Recommended Fix:**
- Add `role="alert"` or `aria-live="assertive"` to error message containers in:
  - `src/pages/AdminLogin.tsx` (login error banner)
  - `src/pages/Contact.tsx` (form error messages)
  - `src/components/forms/SecureForm.tsx` (Turnstile errors)
- Add `aria-live="polite"` with `role="status"` to success messages and loading indicators
- Consider a global toast/notification component with built-in `aria-live`

---

### P1-02 — No `document.title` updates on route changes

| | |
|---|---|
| **WCAG** | 2.4.2 Page Titled (Level A) |
| **Severity** | 🔴 Critical |
| **Files** | `src/App.tsx`, all page components |

**Issue:** The static title in `index.html` ("TAPT - Tennessee Association of Pupil Transportation Website") never changes when navigating between pages. Screen reader users have no way to know which page they're on after a route change.

**Recommended Fix:**
Create a custom hook and use it in every page component:

```tsx
// src/hooks/useDocumentTitle.ts
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | TAPT`;
  }, [title]);
}

// Usage in any page:
useDocumentTitle('Contact Us');
useDocumentTitle('Conference Registration');
```

---

### P1-03 — Loading spinners have no accessible text

| | |
|---|---|
| **WCAG** | 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/App.tsx` (lines 68-74), `src/pages/AdminDashboard.tsx`, `src/pages/Resources.tsx`, and ~15 more pages |

**Issue:** Loading spinners are `<div>` elements with `animate-spin` class and no screen reader text. Some have visible text like "Loading TAPT…" nearby, but many have no text at all.

**Recommended Fix:**
```tsx
<div role="status" aria-live="polite">
  <div className="w-16 h-16 border-t-4 border-b-4 border-primary rounded-full animate-spin mx-auto" aria-hidden="true"></div>
  <span className="sr-only">Loading...</span>
</div>
```

---

### P1-04 — External links open in new tabs without warning

| | |
|---|---|
| **WCAG** | 3.2.5 Change on Request (Level AAA — recommended for AA) |
| **Severity** | 🟢 Minor |
| **Files** | `src/components/Footer.tsx`, `src/pages/Resources.tsx`, `src/pages/Events.tsx`, `src/pages/Home.tsx`, `src/pages/News.tsx` — 16+ instances |

**Issue:** Links with `target="_blank"` don't indicate they'll open in a new tab. Footer social links have `aria-label` but no new-tab indicator.

**Recommended Fix:**
Add `(opens in new tab)` to aria-labels or add a visually hidden span:
```tsx
<a href={url} target="_blank" rel="noopener noreferrer" aria-label="Visit our Facebook page (opens in new tab)">
```

---

### P1-05 — No `prefers-reduced-motion` support

| | |
|---|---|
| **WCAG** | 2.3.3 Animation from Interactions (Level AAA — recommended for AA) |
| **Severity** | 🟢 Minor |
| **Files** | `src/index.css`, all components with transitions/animations |

**Issue:** No `@media (prefers-reduced-motion: reduce)` queries exist. The site uses `animate-spin`, `transition-all`, `transition-colors`, hover scale transforms, and custom keyframe animations.

**Recommended Fix:**
Add to `src/index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

### P1-06 — Images with generic or duplicate alt text

| | |
|---|---|
| **WCAG** | 1.1.1 Non-text Content (Level A) |
| **Severity** | 🟢 Minor |
| **Files** | Various — most are adequate |

**Issue:** Most images have reasonable alt text. Gallery images properly fall back to descriptive text. The main hero image and news images have been updated. A few admin preview images could use more context but are low priority.

**Status:** Mostly resolved. Monitor as new content is added.

---

## PRINCIPLE 2: OPERABLE

User interface components and navigation must be operable.

### O2-01 — Navbar dropdown menus are not keyboard accessible

| | |
|---|---|
| **WCAG** | 2.1.1 Keyboard (Level A) |
| **Severity** | 🔴 Critical |
| **Files** | `src/components/Navbar.tsx` (lines 152-176) |

**Issue:** Desktop navigation dropdowns (Forms, Hall of Fame, About, Admin) use CSS `group-hover:` to show/hide submenus. They are completely inaccessible to keyboard users:

- No `onKeyDown` handler for arrow key navigation
- No Escape key handling to close dropdowns
- `<button>` elements don't have `aria-haspopup="true"` or `aria-expanded`
- Submenus have no `role="menu"` / `role="menuitem"`
- Tab key doesn't move into submenu items (they're `invisible` unless hovered)

**Impact:** Keyboard-only users **cannot access** the Forms subpages (Conference Registration, Tech Conference, etc.), Hall of Fame subpages, or About subpages (Board Members, Contact) through the navigation bar.

**Recommended Fix:**
Implement the [ARIA Menu Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/):

```tsx
// Manage open state per dropdown
const [openDropdown, setOpenDropdown] = useState<string | null>(null);

// Button with aria attributes
<button
  aria-haspopup="true"
  aria-expanded={openDropdown === item.name}
  onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
  onKeyDown={(e) => {
    if (e.key === 'Escape') setOpenDropdown(null);
    if (e.key === 'ArrowDown') { /* focus first item */ }
  }}
>

// Submenu with roles
<div role="menu" aria-label={`${item.name} submenu`}>
  <a role="menuitem" onKeyDown={handleArrowKeys}>...</a>
</div>
```

---

### O2-02 — ConfirmationModal lacks focus trap, Escape key, and dialog role

| | |
|---|---|
| **WCAG** | 2.4.3 Focus Order (Level A), 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🔴 Critical |
| **Files** | `src/components/ConfirmationModal.tsx` (lines 33-95) |

**Issue:**
- No `role="dialog"` or `aria-modal="true"` on the modal container
- No Escape key handler to close the modal
- No focus trap — keyboard focus can tab behind the modal to page content
- No `aria-labelledby` linking the title
- Close button `<X>` icon has no `aria-label` or `aria-hidden`
- Focus is not returned to the trigger element on close

**Recommended Fix:**
- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby="confirmation-title"`
- Implement focus trap (use `focus-trap-react` package or a custom hook)
- Add `onKeyDown` handler for Escape
- Add `aria-label="Close"` to the X button, `aria-hidden="true"` to the icon
- Store and restore focus to the triggering element on close

---

### O2-03 — ArchiveViewerModal lacks focus trap, Escape key, and dialog role

| | |
|---|---|
| **WCAG** | 2.4.3 Focus Order (Level A), 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🔴 Critical |
| **Files** | `src/components/ArchiveViewerModal.tsx` (lines 204-210) |

**Issue:** Same issues as O2-02: No `role="dialog"`, no `aria-modal`, no focus trap, no Escape key handler, no focus restoration. The close button does have `aria-label="Close archives modal"` (good).

**Recommended Fix:** Same approach as O2-02 — add dialog semantics, focus trap, Escape key handling, and focus restoration.

---

### O2-04 — AdminLayout sidebar toggle button lacks accessible label

| | |
|---|---|
| **WCAG** | 4.1.2 Name, Role, Value (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/components/AdminLayout.tsx` (lines 152-156) |

**Issue:** The mobile sidebar toggle button has no `aria-label`, no `aria-expanded`, and the `<X>` / `<Menu>` icons have no `aria-hidden="true"`. Screen readers announce nothing meaningful.

**Recommended Fix:**
```tsx
<button
  onClick={toggleSidebar}
  aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
  aria-expanded={isSidebarOpen}
>
  {isSidebarOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
</button>
```

---

### O2-05 — AdminLayout sidebar submenus lack `aria-expanded`

| | |
|---|---|
| **WCAG** | 4.1.2 Name, Role, Value (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/components/AdminLayout.tsx` (lines 184-200) |

**Issue:** Expandable sidebar menu buttons (Form Settings, Content, Registrations, Hall of Fame) don't have `aria-expanded`. The expand/collapse state via `max-h-0`/`max-h-96` is not communicated to assistive technology. Icons lack `aria-hidden="true"`.

**Recommended Fix:**
```tsx
<button aria-expanded={expandedMenus[item.name]}>
  <ChevronDown aria-hidden="true" />
  {item.name}
</button>
```

---

### O2-06 — Mobile sidebar backdrop not keyboard accessible

| | |
|---|---|
| **WCAG** | 2.1.1 Keyboard (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/components/AdminLayout.tsx` (lines 259-262) |

**Issue:** A `<div onClick={() => setIsSidebarOpen(false)} />` is used as a backdrop dismiss overlay. It's not focusable and has no keyboard handler.

**Recommended Fix:** Add Escape key handling to close the sidebar, or replace the div with an accessible button.

---

### O2-07 — No 404/Not Found page

| | |
|---|---|
| **WCAG** | 3.2.3 Consistent Navigation (Level AA) — related best practice |
| **Severity** | 🟡 Major |
| **Files** | `src/App.tsx` (lines 220-244) |

**Issue:** The nested public routes have no fallback `<Route path="*" />`. Users navigating to invalid URLs see a blank `<main>` container with no content or navigation guidance.

**Recommended Fix:**
Create a `src/pages/NotFound.tsx` page and add `<Route path="*" element={<NotFound />} />` as the last route.

---

### O2-08 — Admin inline panels lack Escape key support

| | |
|---|---|
| **WCAG** | 2.1.1 Keyboard (Level A) |
| **Severity** | 🟢 Minor |
| **Files** | `src/pages/AdminConferenceRegistrations.tsx`, various admin detail panels |

**Issue:** Several admin pages show detail panels that look like modals but are inline divs. They're closeable only by clicking a button, not by pressing Escape.

**Recommended Fix:** Add `onKeyDown` handler for Escape on the panel container.

---

### O2-09 — Tab-like interfaces lack proper ARIA tab roles

| | |
|---|---|
| **WCAG** | 4.1.2 Name, Role, Value (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/pages/AdminContent.tsx` (lines 732-748), `src/pages/AdminSiteSettings.tsx` (lines 355-395), `src/pages/Events.tsx` (lines 188-203) |

**Issue:** Tab-style buttons (e.g., Events: Upcoming/Past/All; AdminContent: Events/Announcements/Resources/News) use `<button>` elements styled as tabs but lack `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, and `aria-controls` attributes.

**Recommended Fix:**
Implement the [ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):

```tsx
<div role="tablist" aria-label="Event filters">
  <button role="tab" aria-selected={filter === 'upcoming'} aria-controls="tab-upcoming">
    Upcoming
  </button>
</div>
<div role="tabpanel" id="tab-upcoming" aria-labelledby="...">
  {/* Tab content */}
</div>
```

---

## PRINCIPLE 3: UNDERSTANDABLE

Information and the operation of the user interface must be understandable.

### U3-01 — Form errors not linked with `aria-describedby`

| | |
|---|---|
| **WCAG** | 3.3.1 Error Identification (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/pages/AdminLogin.tsx`, `src/pages/Contact.tsx`, `src/components/forms/SecureForm.tsx` |

**Issue:** Error messages appear visually near forms but are not programmatically linked to the fields they relate to. No `aria-describedby` connects error text to inputs. The login error is a generic banner not associated with email or password fields.

**Recommended Fix:**
```tsx
<input id="email" aria-describedby="email-error" />
{error && <p id="email-error" role="alert">{error}</p>}
```

---

### U3-02 — Required fields not consistently indicated

| | |
|---|---|
| **WCAG** | 3.3.2 Labels or Instructions (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/pages/Contact.tsx` (lines 269-302), various admin forms |

**Issue:** Contact form required fields have the HTML `required` attribute but no visual asterisk or "(required)" text. Meanwhile, `PaymentMethodSelector` correctly shows `<span className="text-red-500">*</span>`. The asterisk convention is inconsistent and not explained for screen readers.

**Recommended Fix:**
- Add a consistent required indicator pattern across all forms
- Add `aria-required="true"` to required inputs
- Include a note: "Fields marked with * are required" at the top of forms
- Consider adding `<span className="sr-only">(required)</span>` next to asterisks

---

### U3-03 — AdminContent form labels lack `htmlFor`/`id` associations

| | |
|---|---|
| **WCAG** | 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/pages/AdminContent.tsx` (lines 755-920) |

**Issue:** Multiple form fields (Title, Description, Category, Date, File, External URL, Visibility) use `<label>` without `htmlFor` and inputs have no `id`. Clicking a label won't focus the input, and screen readers can't associate them.

**Recommended Fix:**
```tsx
<label htmlFor="content-title">Title</label>
<input id="content-title" ... />
```

---

### U3-04 — AdminBoardMembers form labels lack `htmlFor`/`id` associations

| | |
|---|---|
| **WCAG** | 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/pages/AdminBoardMembers.tsx` (lines 300-325) |

**Issue:** Labels for "Title" and "Image" fields are `<label>` without `htmlFor`.

**Recommended Fix:** Same as U3-03 — add `htmlFor` and matching `id` attributes.

---

### U3-05 — ArchiveViewerModal search and select lack labels

| | |
|---|---|
| **WCAG** | 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/components/ArchiveViewerModal.tsx` (lines 237-251) |

**Issue:** The year `<select>` and search `<input>` have no `<label>` elements or `aria-label` attributes. Placeholder text alone is not an accessible label.

**Recommended Fix:**
```tsx
<select aria-label="Select archive year">...</select>
<input aria-label="Search archives" placeholder="Search..." />
```

---

## PRINCIPLE 4: ROBUST

Content must be robust enough to be interpreted by assistive technologies.

### R4-01 — ConfirmationModal close button icon not hidden from assistive technology

| | |
|---|---|
| **WCAG** | 4.1.2 Name, Role, Value (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/components/ConfirmationModal.tsx` (lines 41-44) |

**Issue:** The close button has an `<X>` icon without `aria-hidden="true"` and the button has no `aria-label`. Screen readers may announce "X" or nothing.

**Recommended Fix:**
```tsx
<button aria-label="Close confirmation dialog">
  <X aria-hidden="true" />
</button>
```

---

### R4-02 — SVG loading spinners inside buttons lack `aria-hidden`

| | |
|---|---|
| **WCAG** | 4.1.2 Name, Role, Value (Level A) |
| **Severity** | 🟢 Minor |
| **Files** | Multiple admin pages (AdminLogin, AdminConferenceSettings, AdminHallOfFameSettings, etc.) |

**Issue:** Inline SVG spinners (`<svg className="animate-spin ...">`) inside loading buttons have no `aria-hidden="true"`. Screen readers may attempt to describe SVG circle/path elements.

**Recommended Fix:** Add `aria-hidden="true"` to all decorative inline SVG spinners.

---

### R4-03 — `<main>` landmark only wraps public pages

| | |
|---|---|
| **WCAG** | 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🟡 Major |
| **Files** | `src/App.tsx` (lines 216-218), `src/components/AdminLayout.tsx` (lines 247-250) |

**Issue:** The `<main id="main-content">` landmark only wraps public routes. Admin pages rendered inside `AdminLayout` use a generic `<div>` — no `<main>` landmark. The `AdminLogin` page also lacks a `<main>` landmark.

**Recommended Fix:**
- In `AdminLayout`, wrap `{children}` with `<main>`
- In standalone admin pages (AdminLogin), wrap content in `<main>`

---

### R4-04 — Data tables lack `<caption>` elements

| | |
|---|---|
| **WCAG** | 1.3.1 Info and Relationships (Level A) |
| **Severity** | 🟢 Minor |
| **Files** | ~15 admin table pages (AdminConferenceRegistrations, AdminContent, AdminBoardMembers, AdminUsers, AdminMemberships, etc.) |

**Issue:** Data tables use proper `<thead>`, `<th scope="col">`, and `<tbody>` (good!), but none have `<caption>` elements to describe the table's purpose.

**Recommended Fix:**
```tsx
<table>
  <caption className="sr-only">Conference registrations list</caption>
  <thead>...</thead>
</table>
```

---

### R4-05 — AdminLayout sidebar landmarks lack `aria-label`

| | |
|---|---|
| **WCAG** | 4.1.2 Name, Role, Value (Level A) |
| **Severity** | 🟢 Minor |
| **Files** | `src/components/AdminLayout.tsx` (lines 161-179) |

**Issue:** The `<aside>` element has no `aria-label` to describe it, and the inner `<nav>` also lacks a label. With two `<nav>` elements on admin pages (main Navbar + sidebar), screen readers need to distinguish them.

**Recommended Fix:**
```tsx
<aside aria-label="Admin sidebar">
  <nav aria-label="Admin navigation">
```

---

## Priority Remediation Roadmap

### Phase 1 — Critical (Do First)

These block fundamental access for keyboard and screen reader users.

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | **P1-01** Add `aria-live` regions for dynamic content | Medium — create a reusable pattern, apply to ~20 locations | Every page benefits |
| 2 | **P1-02** Add `document.title` updates on route changes | Low — create a hook, add one line to each page | Every page benefits |
| 3 | **O2-01** Fix Navbar dropdown keyboard accessibility | High — requires state management, keyboard handlers, ARIA roles | Unblocks navigation for keyboard users |
| 4 | **O2-02** Fix ConfirmationModal accessibility | Medium — add dialog role, focus trap, Escape handling | Used across admin |
| 5 | **O2-03** Fix ArchiveViewerModal accessibility | Medium — same approach as ConfirmationModal | Admin archives |

### Phase 2 — Major (Do Next)

These affect usability but have workarounds.

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 6 | **O2-04** AdminLayout sidebar toggle label | Low | Admin mobile users |
| 7 | **O2-05** AdminLayout sidebar `aria-expanded` | Low | Admin screen reader users |
| 8 | **O2-06** Sidebar backdrop keyboard support | Low | Admin mobile users |
| 9 | **O2-07** Create 404 page | Low | All users hitting bad URLs |
| 10 | **O2-09** ARIA tab roles on tab interfaces | Medium | 3 pages (Events, AdminContent, AdminSiteSettings) |
| 11 | **U3-01** Link form errors with `aria-describedby` | Medium | All forms |
| 12 | **U3-02** Consistent required field indicators | Low | All forms |
| 13 | **U3-03** AdminContent form label associations | Low | Admin content management |
| 14 | **U3-04** AdminBoardMembers form label associations | Low | Admin board members |
| 15 | **U3-05** ArchiveViewerModal input labels | Low | Admin archives |
| 16 | **R4-01** ConfirmationModal close button | Low | Admin confirmations |
| 17 | **R4-03** `<main>` landmark for admin pages | Low | All admin pages |

### Phase 3 — Minor (Polish)

Nice-to-have improvements.

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 18 | **P1-04** External link new-tab warnings | Low | Links site-wide |
| 19 | **P1-05** `prefers-reduced-motion` support | Low | Users with motion sensitivity |
| 20 | **P1-06** Image alt text monitoring | Ongoing | As content is added |
| 21 | **O2-08** Escape key on admin inline panels | Low | Admin detail views |
| 22 | **R4-02** SVG spinner `aria-hidden` | Low | Loading buttons |
| 23 | **R4-04** Table `<caption>` elements | Low | Admin tables |
| 24 | **R4-05** Admin sidebar landmark labels | Low | Admin navigation |

---

## Testing Recommendations

After remediation, validate with:

1. **Automated tools:**
   - [axe DevTools](https://www.deque.com/axe/devtools/) browser extension — catches ~40% of issues
   - [WAVE](https://wave.webaim.org/) — good for structural issues
   - Lighthouse Accessibility audit in Chrome DevTools

2. **Manual keyboard testing:**
   - Tab through every page without a mouse
   - Verify all dropdowns, modals, and forms are fully operable
   - Check focus is visible on every interactive element
   - Verify Escape closes modals and menus

3. **Screen reader testing:**
   - [NVDA](https://www.nvaccess.org/) (free, Windows) — primary test reader
   - VoiceOver (macOS/iOS) — secondary
   - Test form submissions, error states, loading states, navigation

4. **Color contrast verification:**
   - After color changes, verify with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
   - Test custom content colors added by admins (news images, event banners)

---

## Reference

- [WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Quick Reference](https://webaim.org/resources/quickref/)

# Footer

**Date:** 2026-07-09
**Status:** Draft

## Context

The site has no footer today — `app/layout.tsx` renders only `<Nav />` and `<main>{children}</main>`. This adds a footer with links to six policy pages (terms and conditions, privacy notice, cookies, sustainability, accessibility, reviews policy), all currently non-existent. This design covers the footer and stub pages only — no policy content, which is explicitly out of scope for now.

## Decision

### `components/footer.tsx` (new)

A Server Component, rendered in `app/layout.tsx` immediately after `{children}` (inside `<body>`, as a sibling to `<main>`). Visually matches the nav: `bg-primary text-primary-foreground`, same `mx-auto max-w-6xl px-4 py-4 sm:px-6` rhythm as the nav's `<nav>` element, wrapped in a `<footer>` landmark. The six links render in a single row that wraps on narrow viewports (`flex flex-wrap gap-x-6 gap-y-2`), each styled `font-mono text-sm tracking-wide uppercase hover:text-accent` — the same link treatment already used in `components/nav.tsx`.

Links, in this order:

| Label              | Route             |
| ------------------ | ----------------- |
| Terms & Conditions | `/terms`          |
| Privacy Notice     | `/privacy`        |
| Cookies            | `/cookies`        |
| Sustainability     | `/sustainability` |
| Accessibility      | `/accessibility`  |
| Reviews Policy     | `/reviews-policy` |

### `app/layout.tsx` (modified)

Import and render `<Footer />` after `{children}`, no other changes.

### Stub pages (six new files)

`app/terms/page.tsx`, `app/privacy/page.tsx`, `app/cookies/page.tsx`, `app/sustainability/page.tsx`, `app/accessibility/page.tsx`, `app/reviews-policy/page.tsx` — each following the plain-page convention already used by `app/orders/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl">Terms & Conditions</h1>
      <p className="mt-8 text-muted-foreground">Content coming soon.</p>
    </>
  );
}
```

(Same shape for the other five, with their own heading text, `metadata.title`, and component name.)

## Testing

- `tests/component/footer.test.tsx` (new) — renders `Footer` directly, asserts all six links are present with the correct `href`s and accessible names.
- No tests for the stub pages themselves — they're static placeholder markup with no logic, consistent with this codebase not testing purely static content pages.
- No E2E coverage — not a checkout/cart/payment/auth-critical flow (ADR 001).

# ADR 009: Content Management — Contentful for Footer/Policy Pages

**Status:** Accepted
**Date:** 2026-07-13

## Context

The six footer pages (`/terms`, `/privacy`, `/cookies`, `/sustainability`, `/accessibility`, `/reviews-policy`, added by the footer design) were static "Content coming soon." stubs with no way for a non-engineer to edit their copy. This ADR records the decision to back them with Contentful, and the mechanism used to keep them fresh without a rebuild.

## Decision

### Contentful as the content source, fetched directly by `web`

One content type, `footerPage` (`slug` / `title` / `body` Rich Text fields), holds all six entries. `packages/web/lib/contentful.ts`'s `getFooterPage(slug)` calls Contentful's Content Delivery REST API directly from the Next.js server — there's no proxy through `packages/api`. This differs from every other external integration in the stack (Stripe payment intents and Resend email both go through `api`); footer content is presentation-only text with no business logic or persistence tied to it, so there's nothing for the API layer to add.

### Plain `fetch`, not the official SDK — for real Next.js ISR

`getFooterPage` uses `fetch(url, { next: { revalidate: 60 } })` against Contentful's REST API rather than the `contentful` npm SDK. The SDK uses axios internally, which Next.js's fetch-based caching doesn't instrument — using it would silently mean no ISR at all. Plain fetch also matches the existing `lib/api.ts` pattern (a typed helper wrapping `fetch`) rather than introducing a second HTTP client convention for one feature.

### 60-second time-based ISR, no on-demand webhook

Revalidation is purely time-based (`next: { revalidate: 60 }`) — an editor's change in Contentful is live within a minute, with no rebuild or redeploy. There's no webhook-driven `revalidateTag`/`revalidatePath` on-demand path; that would need a secret-protected route handler and webhook configuration in Contentful, deferred as unneeded complexity for content that isn't time-sensitive.

### Fetch failures degrade to the static placeholder, never throw or 404

`getFooterPage` catches every failure mode — network error, non-2xx response, no matching entry — and returns `null`. Each page's `page ? <RichText/> : <p>Content coming soon.</p>` fallback means a missing Contentful space, an unset `CONTENTFUL_SPACE_ID`/`CONTENTFUL_ACCESS_TOKEN`, or a genuine Contentful outage all degrade to the pre-Contentful static page rather than crashing or 404ing.

### Rich text rendering: `@contentful/rich-text-react-renderer`, headings normalized to `h2`

`components/rich-text.tsx` renders the CMS body via `documentToReactComponents`, restyled to the Field Ledger palette instead of Tailwind Typography's default grayscale (`.ledger-prose` in `globals.css` — see [ADR 007](007-visual-identity.md)). Every heading level an editor picks in Contentful (`Heading 1`–`Heading 6`) is forced to render as `<h2>`, since the page's own `<h1>` is rendered outside the rich text field by `FooterPageShell` — this guarantees a correct heading hierarchy regardless of CMS authoring choices, rather than trusting editors to never pick `Heading 1` or skip a level.

### Shared, top-level `lib`/`components`, per ADR 005

`lib/contentful.ts`, `lib/footer-links.ts`, `components/rich-text.tsx`, and `components/footer-page-shell.tsx` all live at the top level rather than colocated under one page's `_lib`/`_components`, since all four are used by all six footer routes.

## Consequences

- A seventh footer page needs a new Contentful entry with a matching `slug` and one new route file calling `getFooterPage("<slug>")` inside `FooterPageShell` — no changes to `lib/contentful.ts` itself.
- `CONTENTFUL_SPACE_ID`/`CONTENTFUL_ACCESS_TOKEN` are server-only env vars. There's no draft/preview path today — only published entries are ever fetched (the Content Delivery API, not the Content Preview API).
- Content edits can take up to 60 seconds to appear; anything needing instant propagation would require adding the on-demand webhook path deferred above.
- Rich text is limited to what `documentToReactComponents`'s default renderers produce (headings, paragraphs, lists, bold/italic, links) — embedded assets or entries in a Contentful rich text field aren't specially handled and would need a custom `renderNode` entry if ever authored into a page.

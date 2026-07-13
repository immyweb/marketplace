# Contentful-backed Footer Pages

**Date:** 2026-07-13
**Status:** Draft

## Context

[The footer design](2026-07-09-footer-design.md) added six policy pages (`app/terms`, `app/privacy`, `app/cookies`, `app/sustainability`, `app/accessibility`, `app/reviews-policy`), each a static stub rendering "Content coming soon." This design replaces those stubs with content managed in Contentful, refetched via Next.js ISR so edits made in Contentful appear on the live site without a rebuild or redeploy.

No Contentful space exists for this project yet — creating it is part of this work, not a prerequisite.

## Decision

### Contentful setup

One content type, `footerPage`, with three fields:

| Field ID | Type       | Required |
| -------- | ---------- | -------- |
| `slug`   | Short text | Yes      |
| `title`  | Short text | Yes      |
| `body`   | Rich text  | Yes      |

Six entries are created, one per existing route segment — `slug` values: `terms`, `privacy`, `cookies`, `sustainability`, `accessibility`, `reviews-policy`.

Two new env vars, read server-side only (never exposed to the client):

- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_ACCESS_TOKEN` — a Content Delivery API (CDA) token, read-only

### `lib/contentful.ts` (new, top-level per [ADR 005](../../adr/005-frontend-architecture.md)'s colocation rule — shared by all six routes)

```ts
export type FooterPage = { title: string; body: Document };

export async function getFooterPage(slug: string): Promise<FooterPage | null> {
  const url = `https://cdn.contentful.com/spaces/${process.env.CONTENTFUL_SPACE_ID}/environments/master/entries?content_type=footerPage&fields.slug=${slug}&limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CONTENTFUL_ACCESS_TOKEN}` },
    next: { revalidate: 60 },
  });

  if (!res.ok) return null;
  const data = await res.json();
  const entry = data.items?.[0];
  return entry ? { title: entry.fields.title, body: entry.fields.body } : null;
}
```

Uses plain `fetch` against Contentful's CDA REST API rather than the official `contentful` SDK: the SDK uses axios internally (per its own ADR), which Next.js's fetch-based caching doesn't instrument, so it wouldn't actually participate in ISR. Plain `fetch` also matches this codebase's existing `lib/api.ts` pattern and is directly mockable with the MSW setup already in place (ADR 001).

`next: { revalidate: 60 }` is Next's time-based ISR: the rendered page is served from cache and revalidated in the background at most once every 60 seconds, so a Contentful edit is live within a minute with no redeploy.

Any failure mode — network error, non-2xx response, or no entry matching the slug — resolves to `null` rather than throwing. There is no user-facing error state for this data; a missing/failed fetch always degrades to the existing "Content coming soon." placeholder (see below), never a crash or 404.

### `components/rich-text.tsx` (new, top-level — shared by all six routes)

```tsx
export function RichText({ document }: { document: Document }) {
  return (
    <div className="prose mt-8">{documentToReactComponents(document)}</div>
  );
}
```

Thin wrapper around `@contentful/rich-text-react-renderer`'s `documentToReactComponents`, using its default node renderers (headings, paragraphs, lists, bold/italic, links) — sufficient for policy-page content, no custom renderer overrides needed.

New dependencies: `@contentful/rich-text-react-renderer` and `@contentful/rich-text-types` (for the `Document` type). No full Contentful SDK dependency, per the above.

### The six page components (modified)

Each becomes an async Server Component that fetches its own slug and falls back to today's placeholder:

```tsx
// app/terms/page.tsx
import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const page = await getFooterPage("terms");
  return (
    <>
      <h1 className="text-2xl">{page?.title ?? "Terms & Conditions"}</h1>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </>
  );
}
```

Same shape for the other five, with their own slug, fallback heading text, `metadata.title`, and component name. `metadata` stays static (not sourced from Contentful) — matches the existing convention and avoids the added complexity of an async `generateMetadata`.

## Testing

- `lib/contentful.test.ts` (new) — unit tests for `getFooterPage` with MSW mocking the `cdn.contentful.com` endpoint: entry found (happy path), no entry for the given slug (`items: []` → `null`), and a non-2xx/network failure (→ `null`).
- `app/terms/page.test.tsx` (new, representative) — renders with MSW returning a full entry (asserts Contentful title/body render) and with MSW returning `items: []` (asserts the "Content coming soon." fallback renders).
- The other five pages are thin wrappers around the same `getFooterPage`/`RichText` pair already covered above — one smoke test each (renders without throwing) rather than duplicating full coverage six times.
- No E2E coverage — not a checkout/cart/payment/auth-critical flow (ADR 001).

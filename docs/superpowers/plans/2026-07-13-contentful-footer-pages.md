# Contentful-backed Footer Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six static "Content coming soon." footer pages (`/terms`, `/privacy`, `/cookies`, `/sustainability`, `/accessibility`, `/reviews-policy`) with content fetched from Contentful, refreshed via Next.js time-based ISR (revalidate every 60s).

**Architecture:** A single shared `lib/contentful.ts` fetches a `footerPage` entry by slug from Contentful's Content Delivery REST API using plain `fetch` with `next: { revalidate: 60 }`. A shared `components/rich-text.tsx` renders the entry's Rich Text `body` field via `@contentful/rich-text-react-renderer`. Each of the six page components becomes an async Server Component calling `getFooterPage(<its slug>)`, rendering the fetched title/body or falling back to today's static placeholder if the fetch fails or no entry exists.

**Tech Stack:** Next.js 16 App Router (Server Components), plain `fetch` (no Contentful SDK), `@contentful/rich-text-react-renderer` + `@contentful/rich-text-types`, Vitest + React Testing Library + MSW (per [ADR 001](../../adr/001-testing-setup.md)).

## Global Constraints

- Use TypeScript throughout (project CLAUDE.md).
- Every feature must have unit tests (project CLAUDE.md); network calls mocked with MSW in component tests, not real HTTP (ADR 001).
- No E2E/Playwright coverage — this isn't a checkout/cart/payment/auth critical flow (ADR 001).
- Package manager is Bun; add dependencies from `packages/web` with `bun add` (ADR 003).
- Shared code used by 2+ routes lives at the top level (`lib/`, `components/`), not colocated under a single route's `_components`/`_lib` (ADR 005).
- ISR revalidation is time-based only, fixed at 60 seconds, via `next: { revalidate: 60 }` on the `fetch` call — no on-demand webhook revalidation.
- Any Contentful fetch failure (network error, non-2xx, no matching entry) must resolve to `null`, never throw — the page always falls back to its existing static placeholder text, never a crash or 404.
- `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN` are server-only env vars (no `NEXT_PUBLIC_` prefix) — never exposed to the client.
- All `bun run test ...` commands in this plan are run with `packages/web` as the working directory (that package's `test` script is `vitest run`); e.g. `cd packages/web && bun run test lib/contentful.test.ts`.

## Prerequisite: Contentful space setup (manual, not an automated task)

This is a one-time setup you do yourself in the Contentful web app — no subagent can do this part, and none of the automated tasks below depend on it (all tests mock the network with MSW). Do this whenever you want to see real content locally or in production:

1. Create a Contentful space (or use an existing one).
2. In **Content model**, create a content type with API identifier `footerPage` and three fields:
   - `slug` — Short text, required
   - `title` — Short text, required
   - `body` — Rich text, required
3. In **Content**, create six entries of type `footerPage`, with `slug` values exactly: `terms`, `privacy`, `cookies`, `sustainability`, `accessibility`, `reviews-policy`. Fill in `title` and `body` for each.
4. Under **Settings → API keys**, create (or reuse) an API key. Copy the **Space ID** and the **Content Delivery API - access token**.
5. Add to `packages/web/.env.local` (create the file if it doesn't exist):
   ```
   CONTENTFUL_SPACE_ID=<your space id>
   CONTENTFUL_ACCESS_TOKEN=<your CDA access token>
   ```
6. Restart `bun run dev` so the new env vars are picked up.

Without this, the pages render their existing "Content coming soon." fallback — nothing breaks.

---

### Task 1: `lib/contentful.ts` — fetch a footer page entry by slug

**Files:**

- Create: `packages/web/lib/contentful.ts`
- Test: `packages/web/lib/contentful.test.ts`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `export type FooterPage = { title: string; body: Document }` and `export async function getFooterPage(slug: string): Promise<FooterPage | null>` — both imported by Task 2 (indirectly, via `Document` type) and Task 3/4 (`getFooterPage`).

- [ ] **Step 1: Add the Rich Text type/renderer dependencies**

```bash
cd packages/web && bun add @contentful/rich-text-react-renderer @contentful/rich-text-types
```

- [ ] **Step 2: Write the failing tests**

Create `packages/web/lib/contentful.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { getFooterPage } from "@/lib/contentful";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

beforeEach(() => {
  vi.stubEnv("CONTENTFUL_SPACE_ID", "test-space");
  vi.stubEnv("CONTENTFUL_ACCESS_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getFooterPage", () => {
  it("returns the entry's title and body when Contentful has a matching entry", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () =>
        HttpResponse.json({
          items: [
            {
              fields: {
                title: "Terms & Conditions",
                body: { nodeType: "document", data: {}, content: [] },
              },
            },
          ],
        }),
      ),
    );

    const page = await getFooterPage("terms");

    expect(page).toEqual({
      title: "Terms & Conditions",
      body: { nodeType: "document", data: {}, content: [] },
    });
  });

  it("returns null when Contentful has no entry for the slug", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    expect(await getFooterPage("terms")).toBeNull();
  });

  it("returns null when the Contentful request fails", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () =>
        HttpResponse.json({ message: "Internal error" }, { status: 500 }),
      ),
    );

    expect(await getFooterPage("terms")).toBeNull();
  });

  it("returns null on a network error", async () => {
    server.use(http.get(CONTENTFUL_URL, () => HttpResponse.error()));

    expect(await getFooterPage("terms")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test lib/contentful.test.ts`
Expected: FAIL — `Cannot find module '@/lib/contentful'` (or similar), since `lib/contentful.ts` doesn't exist yet.

- [ ] **Step 4: Write the implementation**

Create `packages/web/lib/contentful.ts`:

```ts
import type { Document } from "@contentful/rich-text-types";

export type FooterPage = { title: string; body: Document };

export async function getFooterPage(slug: string): Promise<FooterPage | null> {
  try {
    const url = `https://cdn.contentful.com/spaces/${process.env.CONTENTFUL_SPACE_ID}/environments/master/entries?content_type=footerPage&fields.slug=${slug}&limit=1`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.CONTENTFUL_ACCESS_TOKEN}`,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const entry = data.items?.[0];
    return entry
      ? { title: entry.fields.title, body: entry.fields.body }
      : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test lib/contentful.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/contentful.ts packages/web/lib/contentful.test.ts packages/web/package.json packages/web/bun.lock
git commit -m "Add getFooterPage to fetch Contentful footer-page entries with ISR"
```

---

### Task 2: `components/rich-text.tsx` — render a Contentful Rich Text document

**Files:**

- Create: `packages/web/components/rich-text.tsx`
- Test: `packages/web/components/rich-text.test.tsx`

**Interfaces:**

- Consumes: `Document` type from `@contentful/rich-text-types` (installed in Task 1).
- Produces: `export function RichText({ document }: { document: Document }): JSX.Element` — consumed by Task 3/4's page components.

- [ ] **Step 1: Write the failing test**

Create `packages/web/components/rich-text.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Document } from "@contentful/rich-text-types";
import { RichText } from "@/components/rich-text";

const document = {
  nodeType: "document",
  data: {},
  content: [
    {
      nodeType: "paragraph",
      data: {},
      content: [
        { nodeType: "text", value: "Hello world", marks: [], data: {} },
      ],
    },
  ],
} as unknown as Document;

describe("RichText", () => {
  it("renders paragraph text from a Contentful rich text document", () => {
    render(<RichText document={document} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test components/rich-text.test.tsx`
Expected: FAIL — `Cannot find module '@/components/rich-text'`

- [ ] **Step 3: Write the implementation**

Create `packages/web/components/rich-text.tsx`:

```tsx
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Document } from "@contentful/rich-text-types";

export function RichText({ document }: { document: Document }) {
  return (
    <div className="prose mt-8">{documentToReactComponents(document)}</div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test components/rich-text.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/rich-text.tsx packages/web/components/rich-text.test.tsx
git commit -m "Add RichText component to render Contentful rich text documents"
```

---

### Task 3: Wire up `/terms` (representative, full coverage)

**Files:**

- Modify: `packages/web/app/terms/page.tsx`
- Test: `packages/web/app/terms/page.test.tsx`

**Interfaces:**

- Consumes: `getFooterPage(slug: string): Promise<FooterPage | null>` (Task 1), `RichText` (Task 2).
- Produces: nothing new for later tasks — this is the reference pattern Task 4 repeats for the other five pages.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/app/terms/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import TermsPage from "@/app/terms/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("TermsPage", () => {
  it("renders the Contentful title and body when an entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () =>
        HttpResponse.json({
          items: [
            {
              fields: {
                title: "Our Terms",
                body: {
                  nodeType: "document",
                  data: {},
                  content: [
                    {
                      nodeType: "paragraph",
                      data: {},
                      content: [
                        {
                          nodeType: "text",
                          value: "Terms body text",
                          marks: [],
                          data: {},
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        }),
      ),
    );

    render(await TermsPage());

    expect(
      screen.getByRole("heading", { name: "Our Terms" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Terms body text")).toBeInTheDocument();
  });

  it("falls back to the placeholder when no entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await TermsPage());

    expect(
      screen.getByRole("heading", { name: "Terms & Conditions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test app/terms/page.test.tsx`
Expected: FAIL — both assertions fail because the current page always renders the static "Terms & Conditions" heading and "Content coming soon." text regardless of the mocked response.

- [ ] **Step 3: Update the page implementation**

Replace `packages/web/app/terms/page.tsx` with:

```tsx
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test app/terms/page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/terms/page.tsx packages/web/app/terms/page.test.tsx
git commit -m "Wire /terms up to Contentful with ISR"
```

---

### Task 4: Wire up the remaining five pages (`/privacy`, `/cookies`, `/sustainability`, `/accessibility`, `/reviews-policy`)

**Files:**

- Modify: `packages/web/app/privacy/page.tsx`, `packages/web/app/cookies/page.tsx`, `packages/web/app/sustainability/page.tsx`, `packages/web/app/accessibility/page.tsx`, `packages/web/app/reviews-policy/page.tsx`
- Test: `packages/web/app/privacy/page.test.tsx`, `packages/web/app/cookies/page.test.tsx`, `packages/web/app/sustainability/page.test.tsx`, `packages/web/app/accessibility/page.test.tsx`, `packages/web/app/reviews-policy/page.test.tsx`

**Interfaces:**

- Consumes: `getFooterPage(slug: string): Promise<FooterPage | null>` (Task 1), `RichText` (Task 2). Same pattern as Task 3's `TermsPage`.
- Produces: nothing consumed by later tasks — this is the last task.

Each page/slug/title/component-name combination:

| Route             | Slug             | Title            | Component            |
| ----------------- | ---------------- | ---------------- | -------------------- |
| `/privacy`        | `privacy`        | `Privacy Notice` | `PrivacyPage`        |
| `/cookies`        | `cookies`        | `Cookies`        | `CookiesPage`        |
| `/sustainability` | `sustainability` | `Sustainability` | `SustainabilityPage` |
| `/accessibility`  | `accessibility`  | `Accessibility`  | `AccessibilityPage`  |
| `/reviews-policy` | `reviews-policy` | `Reviews Policy` | `ReviewsPolicyPage`  |

- [ ] **Step 1: Write the failing smoke tests**

Create `packages/web/app/privacy/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import PrivacyPage from "@/app/privacy/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("PrivacyPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await PrivacyPage());

    expect(
      screen.getByRole("heading", { name: "Privacy Notice" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
```

Create `packages/web/app/cookies/page.test.tsx` (same shape, `CookiesPage`, heading `"Cookies"`):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import CookiesPage from "@/app/cookies/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("CookiesPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await CookiesPage());

    expect(
      screen.getByRole("heading", { name: "Cookies" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
```

Create `packages/web/app/sustainability/page.test.tsx` (same shape, `SustainabilityPage`, heading `"Sustainability"`):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import SustainabilityPage from "@/app/sustainability/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("SustainabilityPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await SustainabilityPage());

    expect(
      screen.getByRole("heading", { name: "Sustainability" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
```

Create `packages/web/app/accessibility/page.test.tsx` (same shape, `AccessibilityPage`, heading `"Accessibility"`):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import AccessibilityPage from "@/app/accessibility/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("AccessibilityPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await AccessibilityPage());

    expect(
      screen.getByRole("heading", { name: "Accessibility" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
```

Create `packages/web/app/reviews-policy/page.test.tsx` (same shape, `ReviewsPolicyPage`, heading `"Reviews Policy"`):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import ReviewsPolicyPage from "@/app/reviews-policy/page";

const CONTENTFUL_URL =
  "https://cdn.contentful.com/spaces/:spaceId/environments/master/entries";

describe("ReviewsPolicyPage", () => {
  it("falls back to the placeholder when no Contentful entry exists", async () => {
    server.use(
      http.get(CONTENTFUL_URL, () => HttpResponse.json({ items: [] })),
    );

    render(await ReviewsPolicyPage());

    expect(
      screen.getByRole("heading", { name: "Reviews Policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Content coming soon.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test app/privacy/page.test.tsx app/cookies/page.test.tsx app/sustainability/page.test.tsx app/accessibility/page.test.tsx app/reviews-policy/page.test.tsx`
Expected: FAIL — each page currently renders synchronously and ignores the mocked network response, but more fundamentally these assertions target markup the pages already produce today, so run them first to confirm they fail for the right reason once the implementation changes in the next step. (If they unexpectedly pass before Step 3, that's a signal the fallback text/heading didn't change — re-check against the current static files before proceeding.)

- [ ] **Step 3: Update the five page implementations**

Replace `packages/web/app/privacy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "Privacy Notice" };

export default async function PrivacyPage() {
  const page = await getFooterPage("privacy");

  return (
    <>
      <h1 className="text-2xl">{page?.title ?? "Privacy Notice"}</h1>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </>
  );
}
```

Replace `packages/web/app/cookies/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "Cookies" };

export default async function CookiesPage() {
  const page = await getFooterPage("cookies");

  return (
    <>
      <h1 className="text-2xl">{page?.title ?? "Cookies"}</h1>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </>
  );
}
```

Replace `packages/web/app/sustainability/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "Sustainability" };

export default async function SustainabilityPage() {
  const page = await getFooterPage("sustainability");

  return (
    <>
      <h1 className="text-2xl">{page?.title ?? "Sustainability"}</h1>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </>
  );
}
```

Replace `packages/web/app/accessibility/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "Accessibility" };

export default async function AccessibilityPage() {
  const page = await getFooterPage("accessibility");

  return (
    <>
      <h1 className="text-2xl">{page?.title ?? "Accessibility"}</h1>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </>
  );
}
```

Replace `packages/web/app/reviews-policy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getFooterPage } from "@/lib/contentful";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "Reviews Policy" };

export default async function ReviewsPolicyPage() {
  const page = await getFooterPage("reviews-policy");

  return (
    <>
      <h1 className="text-2xl">{page?.title ?? "Reviews Policy"}</h1>
      {page ? (
        <RichText document={page.body} />
      ) : (
        <p className="mt-8 text-muted-foreground">Content coming soon.</p>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test app/privacy/page.test.tsx app/cookies/page.test.tsx app/sustainability/page.test.tsx app/accessibility/page.test.tsx app/reviews-policy/page.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full test suite**

Run: `bun run test`
Expected: PASS (all tests, including Task 1–3's)

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/privacy packages/web/app/cookies packages/web/app/sustainability packages/web/app/accessibility packages/web/app/reviews-policy
git commit -m "Wire the remaining footer pages up to Contentful with ISR"
```

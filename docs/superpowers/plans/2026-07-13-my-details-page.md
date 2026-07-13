# My Details Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in customer view and edit their saved delivery address from a standalone "My Details" page, linked from both the desktop and mobile nav menus.

**Architecture:** A new `PUT /account/address` endpoint (gated by `requireAuth`) does a full replace of the four existing `User` address columns, validated with the existing `AddressSchema`. A new Next.js route (`/my-details`) follows the exact session-gate pattern of `/checkout` and `/orders`: a thin Server Component page fetches the saved address and renders a Client Component form that reuses the existing `AddressForm` fields. Both nav dropdown menus (desktop `AccountMenu`, mobile `MobileNavMenu`) get a new "My Details" item above "Orders".

**Tech Stack:** TypeScript, Express + Prisma 7 (`packages/api`), Next.js App Router + react-hook-form + zod (`packages/web`), Vitest + Supertest (API tests, real Postgres), Vitest + RTL + MSW (web component tests).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-13-my-details-page-design.md`. Read it before starting if anything below is ambiguous.
- TypeScript throughout (CLAUDE.md rule 7).
- API tests for this feature run against real Postgres, no mocks — the existing `account.test.ts` convention. Test DB is `marketplace_test`, wired via `packages/api/tests/setup.ts`; Docker must be running (`docker compose up -d` from the repo root) before any API test.
- Web: component tests only (Vitest + RTL + MSW) — no E2E, per ADR 001 and the spec's explicit call-out that `/my-details` isn't a critical flow.
- **Never auto-commit** (CLAUDE.md rule 6, overrides this skill's default per-task commit step): each task below ends once its tests pass. Do not run `git commit` — leave the working tree uncommitted for user review.
- `PUT /account/address` always replaces all four fields — `AddressSchema` requires all of them, matching the existing `PUT /cart/products/:productId` convention (full replace, not partial patch).
- Accessibility audit required on `/my-details` before this plan is done (user request, not in the original spec) — Task 3's final step runs the `accesslint:diff` skill against the live page.

---

### Task 1: `PUT /account/address` — save-address endpoint

**Files:**

- Modify: `packages/api/src/features/account/account.service.ts`
- Modify: `packages/api/src/features/account/account.routes.ts`
- Modify: `packages/api/src/features/account/account.test.ts`

**Interfaces:**

- Consumes: `AddressSchema`, `AddressInput`, `AddressDetails` from `@marketplace/core` (existing, unchanged); `prisma` from `@/shared/db/prisma`; `requireAuth` from `@/shared/middleware/require-auth`.
- Produces: `saveAddress(userId: string, address: AddressInput): Promise<AddressDetails>` in `account.service.ts` — writes the same four columns `getSavedAddress` reads (`addressName`, `addressStreet`, `addressCity`, `addressPostcode`). `PUT /account/address` on the existing `accountRouter`, mounted at `/account` (already wired in `app.ts`, no change needed there).

- [ ] **Step 1: Write the failing test — append to `packages/api/src/features/account/account.test.ts`**

Insert this new `describe` block directly after the closing `});` of the existing `describe("GET /account/address", ...)` block, before `describe("welcome email on sign-up", ...)`:

```ts
describe("PUT /account/address", () => {
  it("saves a new address for a user with none", async () => {
    const ag = agent(app);
    await signUpAgent(ag);

    const res = await ag
      .put("/account/address")
      .send({
        name: "Jane Smith",
        street: "10 Downing Street",
        city: "London",
        postcode: "SW1A 2AA",
      })
      .expect(200);

    expect(res.body).toEqual({
      name: "Jane Smith",
      street: "10 Downing Street",
      city: "London",
      postcode: "SW1A 2AA",
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    expect(user.addressName).toBe("Jane Smith");
    expect(user.addressStreet).toBe("10 Downing Street");
    expect(user.addressCity).toBe("London");
    expect(user.addressPostcode).toBe("SW1A 2AA");
  });

  it("overwrites an existing saved address", async () => {
    const ag = agent(app);
    await signUpAgent(ag);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "jane@example.com" },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        addressName: "Old Name",
        addressStreet: "Old Street",
        addressCity: "Old City",
        addressPostcode: "OL1 1AA",
      },
    });

    const res = await ag
      .put("/account/address")
      .send({
        name: "Jane Smith",
        street: "10 Downing Street",
        city: "London",
        postcode: "SW1A 2AA",
      })
      .expect(200);

    expect(res.body).toEqual({
      name: "Jane Smith",
      street: "10 Downing Street",
      city: "London",
      postcode: "SW1A 2AA",
    });
  });

  it("returns 403 when signed out", async () => {
    const res = await agent(app)
      .put("/account/address")
      .send({
        name: "Jane Smith",
        street: "10 Downing Street",
        city: "London",
        postcode: "SW1A 2AA",
      })
      .expect(403);

    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 for an invalid body", async () => {
    const ag = agent(app);
    await signUpAgent(ag);

    const res = await ag
      .put("/account/address")
      .send({
        name: "Jane Smith",
        street: "10 Downing Street",
        city: "London",
        postcode: "not-a-postcode",
      })
      .expect(400);

    expect(res.body).toMatchObject({
      error: expect.any(String),
      code: "INVALID_INPUT",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `docker compose up -d && cd packages/api && bun test account.test.ts`
Expected: FAIL — all four new requests get a 404 (no `PUT /address` route mounted yet).

- [ ] **Step 3: Implement `saveAddress` in `packages/api/src/features/account/account.service.ts`**

Add this function to the existing file (alongside `getSavedAddress`), and add `AddressInput` to the existing type-only import from `@marketplace/core`:

```ts
import type { AddressDetails, AddressInput } from "@marketplace/core";
```

```ts
export async function saveAddress(
  userId: string,
  address: AddressInput,
): Promise<AddressDetails> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      addressName: address.name,
      addressStreet: address.street,
      addressCity: address.city,
      addressPostcode: address.postcode,
    },
  });

  return address;
}
```

- [ ] **Step 4: Implement the route in `packages/api/src/features/account/account.routes.ts`**

Replace the full file contents with:

```ts
import { Router } from "express";
import { AddressSchema } from "@marketplace/core";
import { requireAuth } from "@/shared/middleware/require-auth";
import { getSavedAddress, saveAddress } from "./account.service";

const router = Router();

router.get("/address", requireAuth, async (req, res, next) => {
  try {
    const address = await getSavedAddress(req.userId!);
    res.json(address);
  } catch (err) {
    next(err);
  }
});

router.put("/address", requireAuth, async (req, res, next) => {
  try {
    const parsed = AddressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors[0].message,
        code: "INVALID_INPUT",
      });
      return;
    }

    const address = await saveAddress(req.userId!, parsed.data);
    res.json(address);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/api && bun test account.test.ts`
Expected: PASS (7 tests — 3 existing `GET` tests + 4 new `PUT` tests)

- [ ] **Step 6: Run the full API test suite to check for regressions**

Run: `cd packages/api && bun test`
Expected: PASS (no regressions)

---

### Task 2: `MyDetailsForm` component — edit and save the address

**Files:**

- Modify: `packages/web/lib/api.ts`
- Create: `packages/web/app/my-details/_components/my-details-form.tsx`
- Create: `packages/web/app/my-details/_components/index.ts`
- Create: `packages/web/app/my-details/_components/my-details-form.test.tsx`

**Interfaces:**

- Consumes: `AddressForm` (`register`/`errors` props) from `@/app/checkout/_components` (existing, unchanged); `AddressSchema`, `AddressInput`, `AddressDetails` from `@marketplace/core`; `Button` from `@/components/ui/button`.
- Produces: `saveAddress(body: AddressInput): Promise<AddressDetails>` in `lib/api.ts` (a `PUT /account/address` call). `MyDetailsForm({ savedAddress }: { savedAddress: AddressDetails | null })`, exported from `@/app/my-details/_components` — consumed by Task 3's `page.tsx`.

- [ ] **Step 1: Write the failing test — `packages/web/app/my-details/_components/my-details-form.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import { savedAddress } from "@/test-support/msw-handlers";
import { MyDetailsForm } from "@/app/my-details/_components";

const API_URL = "http://localhost:3001";

function fillAddress(
  overrides: Partial<{
    name: string;
    street: string;
    city: string;
    postcode: string;
  }> = {},
) {
  const values = {
    name: "Ada Lovelace",
    street: "12 Analytical Engine Ave",
    city: "London",
    postcode: "SW1A 2AA",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: values.name },
  });
  fireEvent.change(screen.getByLabelText("Street address"), {
    target: { value: values.street },
  });
  fireEvent.change(screen.getByLabelText("City"), {
    target: { value: values.city },
  });
  fireEvent.change(screen.getByLabelText("Postcode"), {
    target: { value: values.postcode },
  });
}

describe("MyDetailsForm", () => {
  it("renders blank when there is no saved address", () => {
    render(<MyDetailsForm savedAddress={null} />);

    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Street address")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("Postcode")).toHaveValue("");
  });

  it("prefills the address fields when a saved address is passed in", () => {
    render(<MyDetailsForm savedAddress={savedAddress} />);

    expect(screen.getByLabelText("Full name")).toHaveValue(savedAddress.name);
    expect(screen.getByLabelText("Street address")).toHaveValue(
      savedAddress.street,
    );
    expect(screen.getByLabelText("City")).toHaveValue(savedAddress.city);
    expect(screen.getByLabelText("Postcode")).toHaveValue(
      savedAddress.postcode,
    );
  });

  it("shows validation errors when submitting an empty form", async () => {
    render(<MyDetailsForm savedAddress={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Full name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Street address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid UK postcode")).toBeInTheDocument();
  });

  it("saves the address and shows a success message", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put(`${API_URL}/account/address`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(savedAddress);
      }),
    );

    render(<MyDetailsForm savedAddress={null} />);
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Address saved")).toBeInTheDocument();
    expect(capturedBody).toEqual({
      name: "Ada Lovelace",
      street: "12 Analytical Engine Ave",
      city: "London",
      postcode: "SW1A 2AA",
    });
  });

  it("shows an inline error message when the save request fails", async () => {
    server.use(
      http.put(`${API_URL}/account/address`, () =>
        HttpResponse.json({ error: "Something broke" }, { status: 500 }),
      ),
    );

    render(<MyDetailsForm savedAddress={null} />);
    fillAddress();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Something broke")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && bun test my-details-form.test.tsx`
Expected: FAIL — `@/app/my-details/_components` doesn't exist yet (module not found).

- [ ] **Step 3: Add `saveAddress` to `packages/web/lib/api.ts`**

Add `AddressInput` to the existing type-only import at the top of the file:

```ts
import type {
  AddressDetails,
  AddressInput,
  Cart,
  Order,
  OrderSummary,
  Product,
} from "@marketplace/core";
```

Add this function, near `fetchSavedAddress`:

```ts
export function saveAddress(body: AddressInput) {
  return apiFetch<AddressDetails>("/account/address", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 4: Implement `packages/web/app/my-details/_components/my-details-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddressSchema, type AddressInput } from "@marketplace/core";
import type { AddressDetails } from "@marketplace/core";
import { saveAddress } from "@/lib/api";
import { AddressForm } from "@/app/checkout/_components";
import { Button } from "@/components/ui/button";

export function MyDetailsForm({
  savedAddress,
}: {
  savedAddress: AddressDetails | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(AddressSchema),
    defaultValues: savedAddress ?? undefined,
  });

  async function onSubmit(values: AddressInput) {
    setSubmitting(true);
    setFormError(null);
    setSaved(false);

    try {
      await saveAddress(values);
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      aria-label="My details form"
      noValidate
      className="max-w-2xl"
    >
      <h1 className="text-2xl">My Details</h1>

      <AddressForm register={register} errors={errors} />

      <div className="mt-8 flex items-center justify-between border-t-2 border-primary pt-4">
        <Button type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>

      {saved && (
        <p role="status" className="mt-4 text-sm text-secondary">
          Address saved
        </p>
      )}
      {formError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {formError}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Implement `packages/web/app/my-details/_components/index.ts`**

```ts
export { MyDetailsForm } from "./my-details-form";
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/web && bun test my-details-form.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 7: Run the full web test suite to check for regressions**

Run: `cd packages/web && bun test`
Expected: PASS (no regressions)

---

### Task 3: `/my-details` page — session gate and data fetch

**Files:**

- Create: `packages/web/app/my-details/page.tsx`
- Create: `packages/web/app/my-details/page.test.tsx`

**Interfaces:**

- Consumes: `getServerSession` from `@/lib/get-server-session` (existing); `fetchSavedAddress` from `@/lib/api` (existing); `MyDetailsForm` from `@/app/my-details/_components` (Task 2).
- Produces: default-exported `MyDetailsPage`, the Next.js route at `/my-details`.

- [ ] **Step 1: Write the failing test — `packages/web/app/my-details/page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-support/setup";
import MyDetailsPage from "@/app/my-details/page";

const API_URL = "http://localhost:3001";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
}));

vi.mock("@/app/my-details/_components", () => ({
  MyDetailsForm: () => <div>my details form</div>,
}));

describe("MyDetailsPage auth gate", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json(null),
      ),
    );

    await expect(MyDetailsPage()).rejects.toThrow(
      "REDIRECT:/sign-in?redirect=/my-details",
    );
  });

  it("renders the my details form when a session exists", async () => {
    server.use(
      http.get(`${API_URL}/api/auth/get-session`, () =>
        HttpResponse.json({
          session: {
            id: "s1",
            userId: "u1",
            expiresAt: new Date().toISOString(),
          },
          user: { id: "u1", name: "Ada", email: "ada@example.com" },
        }),
      ),
    );

    render(await MyDetailsPage());

    expect(screen.getByText("my details form")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && bun test app/my-details/page.test.tsx`
Expected: FAIL — `@/app/my-details/page` doesn't exist yet (module not found).

- [ ] **Step 3: Implement `packages/web/app/my-details/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "@/lib/get-server-session";
import { fetchSavedAddress } from "@/lib/api";
import { MyDetailsForm } from "@/app/my-details/_components";

export const metadata: Metadata = { title: "My Details" };

export default async function MyDetailsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?redirect=/my-details");
  }

  const cookie = (await headers()).get("cookie");
  const savedAddress = await fetchSavedAddress(
    cookie ? { headers: { Cookie: cookie } } : undefined,
  );

  return <MyDetailsForm savedAddress={savedAddress} />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/web && bun test app/my-details/page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full web test suite to check for regressions**

Run: `cd packages/web && bun test`
Expected: PASS (no regressions)

- [ ] **Step 6: Accessibility audit**

With both dev servers running (`docker compose up -d` from the repo root, then `bun run dev`), sign up a test account through the UI (`/sign-up`) so there's an authenticated session. Run the `accesslint:diff` skill against `http://localhost:3000/my-details` (default stash-mode diff — this task's changes are still uncommitted per the Global Constraints, so it correctly diffs the new page against the pre-change baseline). Cover both states from the design spec's Testing section: the blank form (no saved address yet), and the prefilled form (save the address once via the page itself, then reload to see it prefilled).

Expected: 0 new violations. If any appear, they block completion — fix them before moving on.

---

### Task 4: Nav links — "My Details" in both dropdown menus

**Files:**

- Modify: `packages/web/components/account-menu.tsx`
- Modify: `packages/web/components/mobile-nav-menu.tsx`
- Modify: `packages/web/components/nav.test.tsx`

**Interfaces:**

- Consumes: `Link` (next/link), `DropdownMenuItem`, `navMenuItemClassName` — all already imported in both files. No new dependencies.
- Produces: nothing consumed by later tasks (final task in this plan).

- [ ] **Step 1: Extend the failing assertions in `packages/web/components/nav.test.tsx`**

In the test `"shows the user's name, and hovering the account menu reveals Orders and Sign out"`, add this assertion directly after the existing `expect(screen.getByRole("menuitem", { name: "Orders" }))...` block:

```ts
expect(screen.getByRole("menuitem", { name: "My Details" })).toHaveAttribute(
  "href",
  "/my-details",
);
```

In the test `"mobile: shows the account name, Orders, and Sign out after opening the menu when logged in"`, add this assertion directly after the existing `within(menu).getByRole("menuitem", { name: "Orders" })` block:

```ts
expect(
  within(menu).getByRole("menuitem", { name: "My Details" }),
).toHaveAttribute("href", "/my-details");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && bun test nav.test.tsx`
Expected: FAIL — 2 failures, "My Details" menuitem not found in either menu.

- [ ] **Step 3: Add the link to `packages/web/components/account-menu.tsx`**

In the `DropdownMenuContent`, add a new `DropdownMenuItem` directly above the existing "Orders" one:

```tsx
        <DropdownMenuItem asChild className={navMenuItemClassName}>
          <Link href="/my-details">My Details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={navMenuItemClassName}>
          <Link href="/orders">Orders</Link>
        </DropdownMenuItem>
```

- [ ] **Step 4: Add the link to `packages/web/components/mobile-nav-menu.tsx`**

Inside the `name ? (...)` branch, add a new `DropdownMenuItem` directly above the existing "Orders" one:

```tsx
            <DropdownMenuItem asChild className={navMenuItemClassName}>
              <Link href="/my-details">My Details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={navMenuItemClassName}>
              <Link href="/orders">Orders</Link>
            </DropdownMenuItem>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/web && bun test nav.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full web test suite to check for regressions**

Run: `cd packages/web && bun test`
Expected: PASS (no regressions)

- [ ] **Step 7: Summarize for review**

Run: `git status --short` and `git diff --stat`
Expected: modifications/additions across `packages/api/src/features/account/` (Task 1), `packages/web/lib/api.ts` and `packages/web/app/my-details/` (Tasks 2–3), and `packages/web/components/account-menu.tsx`/`mobile-nav-menu.tsx`/`nav.test.tsx` (Task 4). Report this summary to the user — per CLAUDE.md Rule 6, everything stays uncommitted until they review and explicitly ask for a commit.

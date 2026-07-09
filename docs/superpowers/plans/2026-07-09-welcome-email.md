# Welcome Email on Sign-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a minimal welcome email to a customer immediately after they sign up, without ever blocking or failing the sign-up flow.

**Architecture:** Better Auth's `databaseHooks.user.create.after` hook (fired inside `src/shared/auth.ts`'s `betterAuth(...)` config) calls a new `sendWelcomeEmail` function. That function renders a `react-email` component and sends it via the existing shared `resend` client, catching and logging any failure so sign-up is never affected.

**Tech Stack:** Better Auth (`databaseHooks`), `resend` (already a dependency), `react-email` (already a dependency), Pino logger, Vitest + supertest + MSW for testing. No new dependencies.

## Global Constraints

- Reuse the existing `resend` singleton from `src/shared/email.ts` — do not create a second client.
- Reuse the existing `EMAIL_FROM` env var — no new env vars.
- `sendWelcomeEmail` must never throw and must never fail/block sign-up (matches the precedent set by `sendOrderConfirmationEmail` in `src/features/orders/order-confirmation.email.tsx`).
- Do not log the customer's email address or name in any log line — only structured, non-PII fields (matches `order-confirmation.email.tsx`'s `logger.warn({ orderId: order.id, error }, ...)` pattern, which logs an id, not contact info).
- Email content is a minimal greeting only — no CTA link, no account/order details.
- New template file: `src/features/account/welcome.email.tsx` (colocated with the existing `account` feature, not `shared/`).

---

### Task 1: `sendWelcomeEmail` + `WelcomeEmail` template

**Files:**

- Create: `packages/api/src/features/account/welcome.email.tsx`
- Modify: `packages/api/src/features/account/index.ts`
- Test: `packages/api/src/features/account/welcome-email.test.ts`

**Interfaces:**

- Consumes: `resend` from `packages/api/src/shared/email.ts` (default export shape: `resend.emails.send({ from, to, subject, react }): Promise<{ data, error }>`, matching `resend`'s SDK — see `order-confirmation.email.tsx` for the exact call shape already in use). `logger` from `packages/api/src/shared/logger.ts` (Pino instance, `.warn(obj, msg)`).
- Produces: `sendWelcomeEmail(toEmail: string, toName: string): Promise<void>` — exported from `welcome.email.tsx` and re-exported from `packages/api/src/features/account/index.ts`. This is what Task 2 calls from the `databaseHooks` config.

This task builds the email module in isolation, testing it directly (not yet wired into sign-up) using the same MSW-based Resend mock already used by `orders.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/features/account/welcome-email.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../tests/setup";
import { sendWelcomeEmail } from "./welcome.email";
import { logger } from "@/shared/logger";

describe("sendWelcomeEmail", () => {
  it("sends a welcome email via Resend without throwing", async () => {
    await expect(
      sendWelcomeEmail("jane@example.com", "Jane Smith"),
    ).resolves.toBeUndefined();
  });

  it("logs a warning and does not throw when Resend returns an error", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.json(
          { message: "Invalid `from` field" },
          { status: 422 },
        );
      }),
    );
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(
      sendWelcomeEmail("jane@example.com", "Jane Smith"),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() }),
      "Failed to send welcome email",
    );
    warnSpy.mockRestore();
  });

  it("logs a warning and does not throw when the network call itself throws", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.error();
      }),
    );
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(
      sendWelcomeEmail("jane@example.com", "Jane Smith"),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything() }),
      "Failed to send welcome email",
    );
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && bun run test welcome-email.test.ts`
Expected: FAIL — `Cannot find module './welcome.email'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `packages/api/src/features/account/welcome.email.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";
import { resend } from "@/shared/email";
import { logger } from "@/shared/logger";

// Loosely echoes the Field Ledger palette (docs/adr/007-visual-identity.md)
// without the fuller stamp/ledger-numbering treatment — same lighter-weight
// tier used by order-confirmation.email.tsx.
const COLORS = {
  background: "#ede6d6",
  foreground: "#26231f",
  secondary: "#7a4b2e",
};

export function WelcomeEmail({ customerName }: { customerName: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Welcome, ${customerName}`}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.background,
          color: COLORS.foreground,
          fontFamily: "'Public Sans', Arial, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "32px 24px",
          }}
        >
          <Heading style={{ fontSize: "20px", margin: "0 0 8px" }}>
            Welcome
          </Heading>
          <Text style={{ margin: "0", color: COLORS.secondary }}>
            Hi {customerName}, thanks for joining Field Ledger.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const EMAIL_FROM = process.env.EMAIL_FROM!;

export async function sendWelcomeEmail(
  toEmail: string,
  toName: string,
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: "Welcome to Field Ledger",
      react: <WelcomeEmail customerName={toName} />,
    });

    if (error) {
      logger.warn({ error }, "Failed to send welcome email");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to send welcome email");
  }
}
```

- [ ] **Step 4: Wire the export into the account feature's barrel**

Read `packages/api/src/features/account/index.ts` first (current contents):

```ts
export { default as accountRouter } from "./account.routes";
export * from "./account.service";
```

Modify it to add the new export:

```ts
export { default as accountRouter } from "./account.routes";
export * from "./account.service";
export * from "./welcome.email";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/api && bun run test welcome-email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/features/account/welcome.email.tsx packages/api/src/features/account/welcome-email.test.ts packages/api/src/features/account/index.ts
git commit -m "Add welcome email template and send function"
```

---

### Task 2: Wire `sendWelcomeEmail` into Better Auth's sign-up hook

**Files:**

- Modify: `packages/api/src/shared/auth.ts`
- Test: `packages/api/src/features/account/account.test.ts`

**Interfaces:**

- Consumes: `sendWelcomeEmail(toEmail: string, toName: string): Promise<void>` from `packages/api/src/features/account/welcome.email.tsx` (built in Task 1).
- Produces: nothing new consumed by later tasks — this is the last task in the plan.

This task hooks the sign-up flow itself, verified end-to-end through the real `/api/auth/sign-up/email` route (the same route `account.test.ts`'s existing `signUpAgent` helper already calls), with MSW intercepting the outbound Resend call exactly as `orders.test.ts` already does.

- [ ] **Step 1: Write the failing test**

Read `packages/api/src/features/account/account.test.ts` first (current contents — shown in full above from prior exploration; the file currently has one `describe("GET /account/address", ...)` block with a module-level `signUpAgent` helper, `beforeEach`/`afterAll` cleanup, and three `it` blocks).

Add a new `describe` block and the `http`/`HttpResponse` import at the top of `packages/api/src/features/account/account.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { agent } from "supertest";
import { http, HttpResponse } from "msw";
import { app } from "@/app";
import { prisma } from "@/shared/db/prisma";
import { server } from "../../../tests/setup";
```

(This adds `http`, `HttpResponse` from `msw` and `server` from `../../../tests/setup` to the existing imports — same import shape `orders.test.ts` already uses.)

Then append this new `describe` block at the end of the file, after the existing `describe("GET /account/address", ...)` block:

```ts
describe("welcome email on sign-up", () => {
  it("still creates the user when Resend returns an error", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => {
        return HttpResponse.json(
          { message: "Invalid `from` field" },
          { status: 422 },
        );
      }),
    );

    const ag = agent(app);
    await signUpAgent(ag);

    const user = await prisma.user.findUnique({
      where: { email: "jane@example.com" },
    });
    expect(user).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && bun run test account.test.ts`
Expected: The new test currently PASSES already (nothing calls Resend yet, so nothing can fail) — this is expected at this point since the hook isn't wired in yet. This step is a sanity check, not a red-bar check; proceed to Step 3 regardless, then re-run in Step 5 to confirm the hook is actually exercised.

- [ ] **Step 3: Write minimal implementation**

Read `packages/api/src/shared/auth.ts` first (current contents):

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:3000"],
});
```

Modify it to:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db/prisma";
import { sendWelcomeEmail } from "@/features/account/welcome.email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:3000"],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail(user.email, user.name);
        },
      },
    },
  },
});
```

- [ ] **Step 4: Manually verify the happy path is unaffected**

Run the full account test suite to confirm the pre-existing tests (which use the default success MSW handler from `tests/resend-mock.ts`) still pass with the hook now actually calling Resend on every sign-up:

Run: `cd packages/api && bun run test account.test.ts`
Expected: All tests PASS, including the pre-existing `GET /account/address` tests (which call `signUpAgent` and now trigger a real — mocked — Resend call as a side effect) and the new `welcome email on sign-up` test.

- [ ] **Step 5: Run the full API test suite**

Run: `cd packages/api && bun run test`
Expected: All tests PASS, including `orders.test.ts` (whose `signUpAgent` calls also now trigger the welcome-email hook against the default success MSW handler).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/shared/auth.ts packages/api/src/features/account/account.test.ts
git commit -m "Send welcome email after sign-up via Better Auth databaseHooks"
```

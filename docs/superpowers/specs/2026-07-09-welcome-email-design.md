# Welcome Email on Sign-Up

**Date:** 2026-07-09
**Status:** Draft

## Context

`packages/api` uses Better Auth (ADR 006) for email/password sign-up, mounted at `/api/auth/sign-up/email`. Better Auth owns this route internally — there is no custom service function (like `orders.service.ts`'s `placeOrder`) to hook a post-signup action into directly. Since ADR 006 there is also email-sending infrastructure: a shared `resend` client (`src/shared/email.ts`) and a `react-email` template pattern, first used for order confirmation (`docs/superpowers/specs/2026-07-08-order-confirmation-email-design.md`, `src/features/orders/order-confirmation.email.tsx`).

The goal is: once a customer successfully signs up, they receive a welcome email, using the same infrastructure and never blocking or failing the sign-up flow.

This app has only email/password sign-up (no OAuth, per ADR 006's non-goals), so every `User` row creation is a genuine sign-up — no need to distinguish sign-up from other user-creation paths.

## Decision

### Trigger: Better Auth `databaseHooks.user.create.after`

`src/shared/auth.ts`'s `betterAuth(...)` config gains a `databaseHooks.user.create.after` hook, which Better Auth calls with the newly created `user` record right after the `User` row is inserted:

```ts
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

This is Better Auth's documented mechanism for this exact kind of side effect (its own docs use "creating a Stripe customer" as the canonical example of a `user.create.after` hook).

### New module: `src/features/account/welcome.email.tsx`

Colocated with the existing `account` feature (currently just saved-address logic) rather than `shared/`, since it's user/account-facing content, not auth infrastructure itself.

- `WelcomeEmail({ customerName }: { customerName: string })` — a `react-email` component: a heading ("Welcome") and a single-line greeting ("Hi {customerName}, thanks for joining Field Ledger."). No CTA link, no account/order details — a minimal greeting only. Styled with the same lightweight subset of the Field Ledger palette (ADR 007) used by `OrderConfirmationEmail` (background/foreground/secondary hex values); no mono font, since there are no figures to render.
- `sendWelcomeEmail(toEmail: string, toName: string): Promise<void>` — calls `resend.emails.send({ from: EMAIL_FROM, to: toEmail, subject: "Welcome to Field Ledger", react: <WelcomeEmail customerName={toName} /> })`. Same error handling as `sendOrderConfirmationEmail`: checks the SDK's `{ error }` response and logs a `warn` via the shared Pino logger (`logger.warn({ error }, "Failed to send welcome email")` — no email address in the log payload), and wraps the call in try/catch so any unexpected throw is caught the same way. This function never throws.

`src/features/account/index.ts` gains `export * from "./welcome.email"`, alongside the existing account exports.

### Configuration

No new env vars. Reuses the existing `RESEND_API_KEY` / `EMAIL_FROM` and the existing `resend` singleton from `src/shared/email.ts`.

## Testing

MSW is already globally configured (`tests/setup.ts`) with a default success handler for `POST https://api.resend.com/emails` (`tests/resend-mock.ts`), and `account.test.ts` already has a `signUpAgent` helper hitting `/api/auth/sign-up/email`. New tests go in `account.test.ts`:

1. Happy path: sign-up still succeeds and creates the user with the default (success) MSW handler in place — proving the hook doesn't break sign-up.
2. Failure path: override the MSW handler for one test to return an error response; sign-up still succeeds — proving the "never block sign-up" guarantee.

No test asserts on the rendered email's HTML content, consistent with the order-confirmation design's reasoning — the template is a fixed greeting with one interpolated field, so a snapshot/DOM assertion would be testing `react-email`'s renderer, not this codebase's logic.

## Consequences

- Same accepted gap as order confirmation: a failed welcome-email send is only visible via a `warn`-level log line, no retry. Consistent with the existing decision not to introduce a job queue for email delivery at this project's scale.
- `databaseHooks.user.create.after` fires for every `User` row creation, not specifically "sign-up" — currently equivalent since email/password is the only path that creates users. If a future auth method (e.g. an admin-created user, or OAuth) is added, this hook would also fire for it and may need to be scoped more narrowly at that point.
- The welcome email is deliberately content-light (greeting only, no CTA) — a scope decision for this design, not a placeholder to fill in later.

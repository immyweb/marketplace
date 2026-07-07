# User Sign-Up / Sign-In with Better Auth

## Problem

Anyone can currently place an order — `POST /order` has no concept of identity, and `Order` has no link to a user. The product wants browsing and cart-building to stay fully anonymous (as today), but purchasing to require an account. There is also no order-history concept yet, which a user-linked order sets up naturally.

## Goals

- Email + password sign-up and sign-in via [Better Auth](https://better-auth.com), mounted on the existing Express API.
- Browsing, product pages, and the cart stay anonymous — no auth required until checkout.
- `/checkout` (and the API calls it depends on) requires a signed-in session; unauthenticated visitors are redirected to sign in, then back.
- Orders are linked to the signed-in user (`Order.user_id`), enabling order history later (not built now).
- Nav bar reflects auth state: "Sign in" when logged out; user identity + sign-out when logged in.

## Non-Goals

- No email verification (no email-sending provider wired up).
- No social/OAuth login (email + password only).
- No order-history page/UI (only the `user_id` link is added).
- No cart merging/migration across the anonymous→authenticated boundary — the cart stays keyed to the existing `express-session` cart session regardless of auth state.
- No changes to the "proceed to checkout" button on the cart page — it still always navigates to `/checkout`; the auth gate lives at `/checkout` itself.
- No password reset flow.

## Design

### Architecture

Better Auth runs inside `packages/api` (Express), using its Prisma adapter against the existing Postgres database — no new service. This is independent of the existing `express-session` + `connect-pg-simple` cart session (ADR 002/004): that session tracks `req.session.cartId` for anonymous carts and is untouched by this work. Better Auth manages its own session (its own cookie, its own `Session` table).

`packages/web` (Next.js) talks to the auth API the same way it already talks to the rest of the API — cookie-based, cross-origin, `credentials: "include"` (ADR 005) — via two paths:

- **Client-side** (sign-in/sign-up forms, nav sign-out button): `better-auth/react`'s `createAuthClient`, pointed at the API base URL.
- **Server-side** (Server Components deciding what to render, e.g. nav, the checkout gate): a plain `fetch` to the API's `GET /api/auth/get-session`, forwarding the incoming request's `Cookie` header — the same technique `lib/api.ts`'s `fetchCart` already uses for SSR cart reads.

### Database (`packages/api/prisma/schema.prisma`)

- Run Better Auth's CLI (`npx @better-auth/cli generate`) to append its required models: `User`, `Session` (Better Auth's auth session — distinct from the pre-existing cart `express-session`), `Account` (stores the hashed password for the email/password provider), `Verification` (required by the library's core schema even though we don't use email verification/reset flows).
- These use Better Auth's own default table names (`user`, `session`, `account`, `verification` — singular, lowercase), which differs from this project's existing plural-snake_case convention (`products`, `cart_items`, etc). Left as CLI-generated defaults rather than hand-customized, since this is library-managed schema rather than a domain table.
- Add to `Order`: `user_id String` (required) + relation to `User`, `onDelete: Restrict` (default) — an order must always have an owning user going forward.
- No backfill needed: `prisma/seed.ts` seeds no orders, and there's no production data. Any local dev DB with pre-existing order rows will need `docker compose down -v` and reseeding before this migration applies cleanly.

### API (`packages/api`)

- **`src/shared/auth.ts`** (new): `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), emailAndPassword: { enabled: true } })`, reusing the existing `prisma` client from `src/shared/db/prisma`.
- **`src/app.ts`**: mount `app.all("/api/auth/*splat", toNodeHandler(auth))` before `express.json()`. Better Auth requires its handler to run ahead of any body-parsing middleware, or its client hangs on "pending" — this means moving the existing `express.json()` line down, after the auth mount, ahead of all feature routers (no behavior change for them).
- **`src/shared/middleware/require-auth.ts`** (new): calls `auth.api.getSession({ headers })`; throws the existing `ForbiddenError` (403) if there's no session, otherwise attaches the user id to the request for the route to read.
- **`src/features/checkout/checkout.routes.ts`** and **`src/features/orders/orders.routes.ts`**: both `POST /checkout` (payment-intent creation) and `POST /order` (`placeOrder`) go through `require-auth`. Both are only ever reached from the now auth-gated `/checkout` page, so gating both closes off direct/logged-out API calls to either step.
- **`src/features/orders/orders.service.ts`**: `placeOrder` takes a `userId` parameter and writes it onto the created `Order` inside the existing transaction.

### Web (`packages/web`)

- **`lib/auth-client.ts`** (new): `createAuthClient({ baseURL: API_URL })`, exporting `signIn`, `signUp`, `signOut`, `useSession`.
- **`packages/core/src/schemas.ts`**: add `SignUpSchema` (name, email, password) and `SignInSchema` (email, password), alongside the existing `AddressSchema`, so both API and web share validation shape (ADR 005's existing convention).
- **`app/sign-up/page.tsx`** + **`app/sign-up/_components/sign-up-form.tsx`**: Client Component, `react-hook-form` + `zodResolver(SignUpSchema)`, matching `AddressForm`'s field/error/`aria-invalid` styling. Submits via `authClient.signUp.email(...)`, then redirects to a `?redirect` target or `/`.
- **`app/sign-in/page.tsx`** + **`app/sign-in/_components/sign-in-form.tsx`**: same pattern with `SignInSchema`, calling `authClient.signIn.email(...)`.
- **`app/checkout/page.tsx`**: gains a server-side session check (fetch `/api/auth/get-session`, forwarding cookies) before rendering; redirects to `/sign-in?redirect=/checkout` if no session. The existing client `CheckoutPage`/`CheckoutForm` is unchanged otherwise.
- **`components/nav.tsx`**: also fetches session server-side (same helper as the checkout gate). Renders a "Sign in" link when logged out, or the user's name plus a small Client Component sign-out button (needs an event handler) when logged in.

## Testing

Per ADR 001: component tests (Vitest + RTL, MSW-mocked network) are default; Playwright e2e is reserved for cart/checkout critical flows; no mocking in API tests (real Postgres test DB).

- **API:** extend `checkout.test.ts` and `orders.test.ts` (supertest, real DB) to cover both endpoints rejecting unauthenticated requests (403) and succeeding with `user_id` set when signed in. Better Auth's own sign-up/sign-in behavior is the library's tested surface — not re-tested here, only our integration (the auth gate, the `user_id` link).
- **Web:** component tests for `SignUpForm`/`SignInForm` (field validation errors, `authClient` call on submit, redirect on success) and for the nav's logged-in vs. logged-out rendering.
- **E2E:** update the existing checkout Playwright spec to sign up/sign in before reaching checkout; add one new spec asserting the redirect-to-sign-in when visiting `/checkout` while logged out.

## Open Questions

None — design approved by user as presented.

# Storybook UI Documentation

**Date:** 2026-07-09
**Status:** Draft

## Context

`packages/web/components/ui/` holds the project's reusable UI primitives — `button.tsx` and `dropdown-menu.tsx` today — built as unbranded shadcn-style `cva` components per [ADR 005](../adr/005-frontend-architecture.md). Per [ADR 007](../adr/007-visual-identity.md), the component layer stays generic; the "Field Ledger" brand (tokens, typography, one-off motifs like the rotated stamp) is applied above it, by hand, per page. There is no way today to see a primitive's variants/states in isolation — understanding what `Button` supports means reading `button.tsx` directly or grepping for its usages across pages.

This design adds Storybook to document those primitives. It is scoped to `packages/web` only:

- No new workspace package. Only `packages/web` renders UI today (`api` and `core` have none), and there's no known near-term second consumer, so a separate publishable component package would be premature per [CLAUDE.md](../../CLAUDE.md)'s simplicity-first rule.
- Documentation covers `components/ui/*` only — the reusable primitives. The brand-level one-off patterns from ADR 007 (the rotated stamp, ledger row layout, corner rivets) are explicitly out of scope: they're deliberately not extracted into reusable components today, and documenting them in Storybook would misrepresent them as a component API that doesn't exist.

## Decision

### Framework: `@storybook/nextjs-vite`

`packages/web` already runs Vite for its component tests (`vitest.config.ts`: `@vitejs/plugin-react`, `resolve.tsconfigPaths` for the `@/*` alias). Storybook's current recommendation is `@storybook/nextjs-vite` over the older webpack-based `@storybook/nextjs`, which exists only for projects with custom webpack/babel config this project doesn't have. Using the Vite-based framework means Storybook shares the same bundler as the existing test setup instead of introducing a second, webpack-based toolchain alongside it.

### Location: inside `packages/web`, not root

Storybook devDependencies are added to `packages/web/package.json`, matching how Vitest and Playwright are already scoped per-package rather than hoisted to the workspace root. Config lives at `packages/web/.storybook/` (`main.ts`, `preview.ts`) — Storybook's required convention.

`preview.ts` imports `app/globals.css` directly, so stories render against the real Field Ledger tokens (Tailwind v4 `@theme inline` mapping, the three fonts, the `.dark` block) rather than an unstyled or hand-duplicated palette.

### Story files: colocated

`components/ui/button.stories.tsx` and `components/ui/dropdown-menu.stories.tsx` sit next to their components, following Storybook's own default convention. This is a deliberate departure from how this repo keeps test files separate (`tests/component/**/*.test.tsx`, per [ADR 001](../adr/001-testing-setup.md)) — tests and stories serve different readers (CI vs. a developer browsing the component), and colocation keeps a story in sync with the component it documents without needing a parallel directory structure to maintain by hand.

Each story set covers the variant/size props the component already exposes via its `cva` config — no new variants are invented for Storybook's sake.

### Scripts

`packages/web/package.json` gains two scripts:

- `storybook` — dev server
- `build-storybook` — static build

No root-level script is added (e.g. no `storybook` entry in the root `package.json` alongside `dev`/`test:web`). Existing root scripts filter into `web` for things needed workspace-wide (`dev`, `test:web`); Storybook is invoked directly via `bun run --filter web storybook`, consistent with how a single-package dev tool that nothing else depends on is run today.

## Testing

Storybook here is documentation tooling, not a test runner — no interaction/play-function tests or visual regression are being added as part of this design. Verification is:

- `bun run --filter web storybook` starts cleanly and both `Button` and `DropdownMenu` stories render with Field Ledger styling applied (canvas background, correct fonts, brand colors — not unstyled HTML).
- `bun run --filter web build-storybook` produces a static build without errors.
- Existing `packages/web` component tests (`bun run test:web`) and the dev server (`bun run dev:web`) still work unchanged — Storybook's config must not interfere with `vitest.config.ts` or `next dev`.

## Consequences

- Adding a third UI primitive later (e.g. a `Card`) means adding its `.stories.tsx` alongside it as a matter of course — there's no separate "remember to document it" step once this pattern exists.
- If a second consumer of these components appears later (an admin app, etc.), extracting `components/ui/` into its own workspace package becomes a separate, future decision — this design deliberately doesn't build toward that now.
- The brand-level patterns from ADR 007 remain undocumented in Storybook. If they're ever extracted into reusable components (the `Stamp` component ADR 007 already flags as a possible future step), they'd get their own stories at that point — not before, since Storybook should reflect real component APIs, not aspirational ones.
- `packages/web`'s `devDependencies` grow by Storybook and its Next.js/Vite framework package; no production dependency changes.

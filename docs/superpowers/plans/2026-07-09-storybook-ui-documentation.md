# Storybook UI Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storybook to `packages/web` to document the `components/ui/*` primitives (`Button`, `DropdownMenu`), with stories colocated next to each component and rendered against the real "Field Ledger" design tokens.

**Architecture:** Storybook runs entirely inside `packages/web` using the `@storybook/nextjs-vite` framework (Vite-based, matching the Vite tooling `vitest.config.ts` already uses). `.storybook/preview.tsx` imports `app/globals.css` and replicates `app/layout.tsx`'s `next/font/google` setup via a decorator, so stories see the same CSS custom properties (colors, fonts, radius) the real app does. Story files (`*.stories.tsx`) sit next to the component they document.

**Tech Stack:** Storybook 10, `@storybook/nextjs-vite`, Bun workspaces, TypeScript, Tailwind CSS v4 (existing).

## Global Constraints

- Scope is `packages/web` only — no new workspace package (per `docs/superpowers/specs/2026-07-09-storybook-ui-documentation-design.md`).
- Scope is `components/ui/*` only — `Button` and `DropdownMenu`. No documentation of ADR 007's one-off brand patterns (stamp, ledger rows, corner rivets).
- Framework: `@storybook/nextjs-vite` (not the webpack-based `@storybook/nextjs`).
- Storybook devDependencies live in `packages/web/package.json`, not the workspace root. No root-level `storybook` script is added — invoked via `bun run --filter web storybook` / `bun run --filter web build-storybook`.
- Story files are colocated next to their component (`components/ui/button.stories.tsx`), not gathered in a separate directory — a deliberate departure from this repo's test-file convention (ADR 001), agreed with the user during brainstorming.
- No interaction/play-function tests, no visual regression tooling, no `@storybook/addon-docs`/autodocs pages — Storybook here is documentation tooling only, matching the design spec's stated scope.
- Each story documents only the variant/size props the component already exposes via its existing `cva` config — no new variants invented for Storybook.

---

## Before You Start

Read `docs/superpowers/specs/2026-07-09-storybook-ui-documentation-design.md` for the full rationale. Key facts this plan depends on, already verified against the live codebase and Storybook's current docs:

- `packages/web` is on Next.js 16.2.9, Tailwind CSS v4.3.2 (via `@tailwindcss/postcss`, config in `postcss.config.mjs`), and already runs Vite for Vitest (`@vitejs/plugin-react`).
- `app/globals.css` defines the Field Ledger tokens via `@theme inline` + `:root`/`.dark` custom properties, and maps `--font-sans`/`--font-display`/`--font-mono` to `--font-body`/`--font-heading`/`--font-code`.
- Those three `--font-*` custom properties are **not** set inside `globals.css` itself — they're set by `next/font/google` calls in `app/layout.tsx`, applied as class names on `<html>`. Storybook never renders `app/layout.tsx`, so importing `globals.css` alone in `preview.tsx` is not enough to get real typography — `.storybook/preview.tsx` must independently set up the same three `next/font/google` calls and apply their `.variable` class names via a decorator. `next/font/google` is supported out of the box by `@storybook/nextjs-vite` (Storybook's own docs confirm this, as of the version installed by this plan) — no extra config needed for that part.
- Storybook 10 (the current major version at the time this plan was written) bundles what used to be `@storybook/addon-essentials` (actions, backgrounds, controls, highlight, measure, outline, toolbars, viewport) into core — no separate `addons: [...]` array is needed in `main.ts` for those.
- The only existing files under `components/ui/` are `button.tsx` and `dropdown-menu.tsx`.

---

### Task 1: Install & configure Storybook, document `Button`

**Files:**

- Modify: `packages/web/package.json`
- Modify: `packages/web/.gitignore`
- Create: `packages/web/.storybook/main.ts`
- Create: `packages/web/.storybook/preview.tsx`
- Create: `packages/web/components/ui/button.stories.tsx`

**Interfaces:**

- Produces: `.storybook/main.ts` (framework + `stories` glob `../components/**/*.stories.@(ts|tsx)`) and `.storybook/preview.tsx` (global CSS + font decorator) that Task 2's `dropdown-menu.stories.tsx` relies on being picked up automatically — Task 2 adds no new config.

- [ ] **Step 1: Add Storybook devDependencies and scripts to `packages/web/package.json`**

Edit `packages/web/package.json`. In `devDependencies`, insert `@storybook/nextjs-vite` (alphabetically between `@playwright/test` and `@tailwindcss/postcss`) and `storybook` (alphabetically between `postcss` and `tailwindcss`):

```json
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@storybook/nextjs-vite": "^10.4.6",
    "@tailwindcss/postcss": "^4.3.2",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^29.1.1",
    "msw": "^2.14.6",
    "postcss": "^8.5.16",
    "storybook": "^10.4.6",
    "tailwindcss": "^4.3.2",
    "typescript": "^6.0.3",
    "vitest": "^4.1.9"
  }
```

And add two scripts (after the existing `test:e2e` entry):

```json
    "test:e2e": "playwright test",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
```

- [ ] **Step 2: Install dependencies**

Run from the repo root:

```bash
bun install
```

Expected: completes without error; `packages/web/node_modules/.bin/storybook` now exists.

Verify:

```bash
test -f packages/web/node_modules/.bin/storybook && echo OK
```

Expected output: `OK`

- [ ] **Step 3: Ignore Storybook's static build output**

Edit `packages/web/.gitignore`, add one line at the end:

```
storybook-static/
```

- [ ] **Step 4: Create `.storybook/main.ts`**

Create `packages/web/.storybook/main.ts`:

```ts
import { defineMain } from "@storybook/nextjs-vite/node";

export default defineMain({
  framework: "@storybook/nextjs-vite",
  stories: ["../components/**/*.stories.@(ts|tsx)"],
});
```

- [ ] **Step 5: Create `.storybook/preview.tsx`**

Create `packages/web/.storybook/preview.tsx`. This mirrors `app/layout.tsx`'s font setup exactly (same weights, same `variable` names) so `font-sans`/`font-display`/`font-mono` resolve to the real fonts instead of falling back silently:

```tsx
import type { Preview } from "@storybook/nextjs-vite";
import { Big_Shoulders, IBM_Plex_Mono, Public_Sans } from "next/font/google";

import "../app/globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
});

const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
});

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

- [ ] **Step 6: Create `components/ui/button.stories.tsx`**

Create `packages/web/components/ui/button.stories.tsx`. Covers every `variant` and `size` option from `buttonVariants` in `button.tsx`, plus the native `disabled` state:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
  args: {
    children: "Button",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "default" },
};

export const Destructive: Story = {
  args: { variant: "destructive" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Link: Story = {
  args: { variant: "link" },
};

export const Small: Story = {
  args: { variant: "default", size: "sm" },
};

export const Large: Story = {
  args: { variant: "default", size: "lg" },
};

export const Icon: Story = {
  args: {
    variant: "outline",
    size: "icon",
    children: "+",
    "aria-label": "Increase quantity",
  },
};

export const Disabled: Story = {
  args: { variant: "default", disabled: true },
};
```

- [ ] **Step 7: Build Storybook and verify**

Run:

```bash
bun run --filter web build-storybook
```

Expected: exits 0, ends with a line like `output written to .../packages/web/storybook-static`.

Verify the Button story was registered:

```bash
grep -o '"title":"UI/Button"' packages/web/storybook-static/index.json
```

Expected output: `"title":"UI/Button"`

- [ ] **Step 8: Commit**

```bash
git add packages/web/package.json packages/web/.gitignore packages/web/.storybook packages/web/components/ui/button.stories.tsx packages/web/bun.lock 2>/dev/null
git add ../../bun.lock 2>/dev/null || true
git status
```

Check `git status` output to confirm exactly which lockfile(s) changed (root `bun.lock` and/or none), then commit:

```bash
git commit -m "Add Storybook to packages/web and document Button"
```

---

### Task 2: Document `DropdownMenu`

**Files:**

- Create: `packages/web/components/ui/dropdown-menu.stories.tsx`

**Interfaces:**

- Consumes: `.storybook/main.ts`'s `stories` glob and `.storybook/preview.tsx`'s font/CSS setup from Task 1 — no config changes needed here, the glob already covers this new file.

- [ ] **Step 1: Create `components/ui/dropdown-menu.stories.tsx`**

`DropdownMenu` is a compositional Radix primitive, not a single component with `variant`/`size` args like `Button` — so instead of args-driven stories, each story is a fully composed example via `render`, following the real usage pattern in `components/account-menu.tsx` (trigger via `asChild` on a `Button`, `DropdownMenuContent` with items). Two stories cover the exported subcomponents: a plain item/label/separator/destructive-item menu, and one exercising `DropdownMenuCheckboxItem` / `DropdownMenuRadioGroup` / `DropdownMenuRadioItem`.

Create `packages/web/components/ui/dropdown-menu.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>Orders</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithSelectionControls: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Sort by</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem checked>
          Show out of stock
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value="price-asc">
          <DropdownMenuRadioItem value="price-asc">
            Price: low to high
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="price-desc">
            Price: high to low
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
```

- [ ] **Step 2: Build Storybook and verify both components are documented**

```bash
bun run --filter web build-storybook
```

Expected: exits 0.

```bash
grep -o '"title":"UI/Button"\|"title":"UI/DropdownMenu"' packages/web/storybook-static/index.json | sort -u
```

Expected output (both lines present):

```
"title":"UI/Button"
"title":"UI/DropdownMenu"
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/components/ui/dropdown-menu.stories.tsx
git commit -m "Document DropdownMenu in Storybook"
```

---

### Task 3: Regression check — confirm existing `packages/web` tooling is unaffected

No files change in this task — it's a verification-only gate confirming Storybook's addition didn't break the app or its existing test setup, per the design spec's testing section.

- [ ] **Step 1: Run the existing component test suite**

```bash
bun run test:web
```

Expected: same pass/fail result as on `main` before this branch — no new failures introduced by the Storybook config or story files (they're not part of `tests/component/**/*.test.tsx` and aren't picked up by `vitest.config.ts`'s `include`).

- [ ] **Step 2: Confirm the Next.js dev server still boots**

```bash
bun run dev:web &
DEV_PID=$!
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill $DEV_PID
```

Expected output: `200`

- [ ] **Step 3: Confirm the Storybook dev server boots (final manual sanity check)**

```bash
timeout 20 bun run --filter web storybook 2>&1 | grep -m1 "Storybook.*started" || echo "check output above manually"
```

Expected: a line containing `Storybook ... started` (exact wording may vary by version — if the grep doesn't match, inspect the captured output directly to confirm no error was thrown instead of assuming failure).

This task has no commit — it only confirms Tasks 1–2 didn't regress anything.

---

## Self-Review Notes

- **Spec coverage:** Framework choice (`@storybook/nextjs-vite`) → Task 1 Step 1/4. Location inside `packages/web`, not root → Task 1 Step 1 (package.json), no root script added. Tokens/fonts rendering correctly → Task 1 Step 5 (the `next/font` gap found while reading `app/layout.tsx` and fixed via the decorator — flagged explicitly in "Before You Start"). Colocated stories → Task 1 Step 6, Task 2 Step 1. Scripts → Task 1 Step 1. `storybook-static` gitignored → Task 1 Step 3. Both primitives documented → Tasks 1 and 2. Regression check (existing tests/dev server unaffected) → Task 3.
- **Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code or commands.
- **Type consistency:** `Meta`/`StoryObj`/`Preview` imported from `@storybook/nextjs-vite` consistently across `preview.tsx`, `button.stories.tsx`, `dropdown-menu.stories.tsx`. Story titles (`UI/Button`, `UI/DropdownMenu`) match what Task 2's verification grep checks for.

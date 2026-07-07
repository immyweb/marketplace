# ADR 007: Visual Identity — Field Ledger Design Language

**Status:** Accepted
**Date:** 2026-07-07

## Context

The storefront needed a visual identity distinctive enough not to read as a generic e-commerce template. `packages/web/app/globals.css` establishes this under the name "Field Ledger" (see the comment on `:root`): a heritage-workwear catalog, styled as if it were a quartermaster's paper stock ledger rather than a SaaS dashboard. The concept has since been extended by hand across the sign-up/sign-in split panel, order confirmation, and the cart page. This ADR records the language so it can be applied consistently rather than reverse-engineered from component code each time.

## Decision

### Brand concept: a paper catalog, not a screen

Canvas paper, ink, visible stitching, brass hardware, and a rubber ink stamp are the reference objects. Every token and motif below should be traceable back to one of these physical materials — if a new addition isn't, it's probably borrowing from a generic UI pattern instead.

### Color tokens (`packages/web/app/globals.css`)

Six semantic tokens, defined once in `:root` and consumed everywhere via Tailwind v4's `@theme inline` mapping (components use `bg-primary`, `text-secondary`, etc. — never raw hex):

| Token         | Value     | Material       |
| ------------- | --------- | -------------- |
| `background`  | `#ede6d6` | canvas         |
| `foreground`  | `#26231f` | ink            |
| `primary`     | `#3c4a3a` | loden          |
| `secondary`   | `#7a4b2e` | tanned leather |
| `accent`      | `#b98a44` | brass rivet    |
| `destructive` | `#a23b2e` | rust           |

A parallel `.dark` block exists with the same six roles inverted for a dark canvas, but nothing in the app currently toggles the `.dark` class — it's inert scaffolding, not a shipped feature, until a theme switch is built.

This is the complete palette. A new page needing an "accent" color should reuse one of these six, not add a seventh.

### Typography: three fonts, three jobs

- **Display** (`Big_Shoulders` → `--font-heading` → `font-display`): condensed, bold, uppercase, tracking-wide. Applied to `h1`–`h3` globally in `@layer base`, and reused ad hoc wherever something needs the same stamped-headline weight (stamp badges, totals).
- **Body** (`Public_Sans` → `--font-body` → `font-sans`, the default): prose, product names, paragraph copy.
- **Mono** (`IBM_Plex_Mono` → `--font-code` → `font-mono`): the ledger's data voice. Prices, quantities, item/SKU codes, requisition numbers, uppercase tracked-wide eyebrows, and the nav's cart count all render in mono. Anything that reads as a _recorded figure_ rather than _written prose_ belongs in this typeface — that's the dividing line, not "numbers vs text" mechanically (e.g. product names stay in body type even though they sit next to a mono price).

### Sharp, minimal radius

`--radius: 0.1875rem`, scaled via `--radius-sm/md/lg/xl`. Deliberately close to square — reads as a stamped hardware tag or leather-goods corner, not soft SaaS rounding. A future component reaching for a larger radius should treat that as a deviation worth a second look, not a free choice.

### Dashed borders as a stitch line

`border-dashed` is the standard divider between rows/sections wherever content is grouped on the canvas background (cart item rows, order-confirmation sections, the product description rule) — it reads as visible stitching. A solid `border-t-2 border-primary` marks a section's structurally final edge instead — today that's used in exactly one place, above the cart's total row. Order-confirmation's total has no border above it at all, so this isn't yet a cross-page convention, just the cart's own closing rule. The distinction in intent is still meaningful: dashed = a seam _within_ a flow, solid = the flow's end.

### The rotated stamp: the recurring signature, and where it's drifted

Three independent instances predate and inform this ADR:

- `order-confirmation/[id]/page.tsx` — an "Order Received" tag: `-rotate-6`, `font-mono text-xs tracking-widest`, `border-secondary`.
- `components/auth-layout.tsx` — an optional `stamp` prop on the sign-in/sign-up panel: `-rotate-6`, `font-mono text-xs tracking-widest`, `border-secondary`. Pixel-identical to the order-confirmation tag.
- `app/cart/page.tsx` — the order total: `-rotate-2` (settling from `-8deg` via the `stamp-press` keyframe on mount), `font-display text-xl tracking-wide`, `border-primary`.

All three share the same underlying shape — a bordered box, rotated off-axis, uppercase bold text, mimicking an ink stamp pressed onto paper — and it's the brand's one deliberately bold flourish, used sparingly: once per page, at a moment worth marking (a placed order, a total due, a status cue), not as a general-purpose badge.

But the cart instance is a real departure, not just a color/rotation tweak: it swaps the established `font-mono`/`text-xs`/`tracking-widest` treatment for `font-display`/`text-xl`/`tracking-wide`, and swaps `border-secondary` for `border-primary`. The other two instances agree with each other exactly; cart's does not agree with either. Notably, the cart page's _own_ empty-state stamp ("Docket Empty") _does_ use the established `font-mono text-xs tracking-widest` — so the populated-state total stamp is an outlier even against the rest of its own page. This divergence was a judgment call made when designing the cart page (the total needed more visual weight than a small mono tag would carry) rather than a deliberate evolution of the pattern, and it's flagged here rather than quietly left for someone to "discover" and reconcile — see Consequences for what to do about it.

### Brass corner rivets & canvas weave texture

`components/auth-layout.tsx`'s `CornerRivets` places small brass-colored dots at the four corners of a bordered panel, and the loden panel background carries a subtle `repeating-linear-gradient` diagonal weave. These evoke rivets on workwear and canvas fabric weave respectively. Currently scoped to the auth split panel only — not yet reused elsewhere, and shouldn't be copy-pasted into a new surface without deliberately re-tuning the opacity/spacing for that surface's size, the same way the stamp isn't shared as a component.

### Ledger/docket framing for structured, ordered data

The cart page is the fullest expression of this: numbered lines (`01`, `02`, …) since the content is a genuine ordered sequence, mono item codes derived from product IDs (`Item No. 00009`), and a mono eyebrow acting as a document/requisition number (`Requisition No. 000182`). Order-confirmation shares the same _voice_ — its item list also renders in mono, and its section rules use the same dashed-stitch dividers — but not the full apparatus: there's no per-line numbering, no item codes, and the order number appears inline in a sentence ("Your order number is `#123`") rather than as its own eyebrow. Cart's docket treatment is a deeper, newer application of the ledger idea, not something order-confirmation already did and cart merely copied.

This framing is deliberately _not_ applied to the product listing grid or other card-grid browsing surfaces, where "ledger line" numbering wouldn't describe anything real — numbered markers here encode an actual sequence (order lines), not decoration.

### Component layer stays generic; the brand lives above it

Per [ADR 005](005-frontend-architecture.md), `components/ui/*` (e.g. `Button`) are unbranded shadcn-style `cva` primitives using shadcn's own semantic slot names (`primary`/`secondary`/`accent`/`destructive`). The Field Ledger identity is applied at two layers above that: the token values themselves (`globals.css`), and one-off page compositions (the stamp, the rivets, the ledger row layout) written by hand per page rather than extracted into branded components like `<Stamp>` or `<LedgerRow>`.

## Consequences

- A new page should ground its palette and type choices in the six tokens and the display/body/mono role split above before reaching for a new color or font — those are exhaustive, not a starting point.
- The rotated-stamp motif is duplicated by hand across three files with no shared component. Two of the three (order-confirmation, auth-layout) are pixel-identical; the cart total stamp diverges in font family, scale, and color rather than just rotation. Before adding a fourth instance, resolve this two-vs-one split deliberately: either bring the cart total stamp in line with the established `font-mono text-xs tracking-widest border-secondary` treatment, or, if a bigger total genuinely needs more visual weight, decide that on purpose and extract a `Stamp` component with an explicit size variant — don't let a fourth copy pick a third treatment by accident.
- Dark-mode tokens exist and are fully parallel to light mode, but are unreachable — building a theme toggle later needs only the toggle itself, not new color work.
- Numbered line markers (`01`, `02`, …) are reserved for surfaces presenting a real ordered sequence (cart, order summary). Applying them to a listing/grid page for visual consistency alone would violate the reason they're legible here.
- The corner-rivet and canvas-weave treatments are confined to `auth-layout.tsx`; reusing them on another surface should be a deliberate design decision with its own tuning pass, not a copy-pasted `background-image` string.

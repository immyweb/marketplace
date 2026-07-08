---
name: mermaid-diagrams
description: Use when creating, updating, or exporting an architecture, system-design, sequence, ER, or data-flow diagram for this repo — anything drawn in Mermaid (.mmd) or rendered to SVG with mmdc / `bun run diagrams`.
---

# Mermaid Diagrams

## Overview

Architecture diagrams in this repo are authored as Mermaid source (`.mmd`) and exported to committed SVGs. The `.mmd` file is the editable source of truth; the `.svg` is a generated artifact you embed in docs. **Never hand-edit the SVG — change the `.mmd` and re-render.**

## Where things live

| Path                                | Role                                       |
| ----------------------------------- | ------------------------------------------ |
| `docs/diagrams/<name>/<name>.mmd`   | Diagram source (edit these)                |
| `docs/diagrams/<name>/<name>.svg`   | Rendered output (commit these)             |
| `docs/diagrams/mermaid.config.json` | Shared theme/config passed to every render |
| `bun run diagrams`                  | Batch-renders every `.mmd` → `.svg`        |

One folder per diagram, named by what it shows: `system-context/`, `checkout-sequence/`, `data-model/`. The `.mmd` and its rendered `.svg` share the folder's name and sit inside it.

## Workflow

1. Create `docs/diagrams/<name>/<name>.mmd`. Start the file with a `%%` comment naming what it shows.
2. Render and **verify it compiled**: `bun run diagrams` (or one file: `mmdc -i docs/diagrams/<name>/<name>.mmd -o docs/diagrams/<name>/<name>.svg -c docs/diagrams/mermaid.config.json -b '#ede6d6'`).
3. A syntax error makes `mmdc` render an error graph or exit non-zero — treat that as a failing build and fix the `.mmd` before moving on. Do not claim a diagram is done until its SVG regenerated cleanly.
4. For any `sequenceDiagram`, also **visually verify box sizing** before calling it done — a clean exit code does not mean text fits inside its box (see "Sizing" below). Render a PNG and look at it:
   `mmdc -i docs/diagrams/<name>/<name>.mmd -o /tmp/<name>-check.png -c docs/diagrams/mermaid.config.json -b '#ede6d6' -w 1600`, then view the PNG. Delete the scratch PNG once you've confirmed it — only the `.svg` is committed.
5. Embed with `![Alt text](diagrams/<name>/<name>.svg)` from a doc under `docs/`.

## Sizing — boxes must fit their text

Mermaid silently lets text overflow a box instead of erroring or auto-growing it — `mmdc` exits 0 either way, so this only shows up on visual inspection (step 4 above), never from the render command's exit code.

**Participant/actor boxes** (`participant X as line1<br/>line2`): a two-line label on a box-type `participant` can render narrower than the text needs, especially when one line is much longer than the other (e.g. `web<br/>Next.js Server Components`). Fix it with an `%%{init: ...}%%` directive **scoped to that one diagram**, placed right above `sequenceDiagram`:

```
%%{init: { "sequence": { "width": 260 } } }%%
sequenceDiagram
```

Do not add `sequence.width`/`sequence.wrap` to the shared `mermaid.config.json` — it applies to every sequence diagram in the repo uniformly, including ones whose boxes already fit correctly (short single-word labels, or `actor` stick-figure labels that auto-wrap fine). A blanket width forces those down too and can shrink their notes below what they need (this happened once — the fix was reverting the shared config and moving the override into the one `.mmd` that needed it).

**Note boxes** (`Note over A: ...` / `Note over A,B: ...`): the box width is the geometric distance between the named actors' lifelines — it is _not_ computed from the note's text. A `Note over` a single actor, or two adjacent actors, is often too narrow for more than a few words; long text overflows both edges of the box (and can spill off the left edge of the canvas entirely if the actor is the leftmost one). Two independent levers, use both when a note is tight:

- **Widen the span** — add another actor to the `over` list (`Note over A,DB` instead of `Note over A`) even if that actor isn't really "involved"; it's a normal, harmless way to borrow width. Prefer a neighbor 2–3 columns away for anything longer than a few words.
- **Shorten each line** with manual `<br/>` breaks — don't rely on Mermaid to wrap note text for you, it won't. As a rule of thumb at this repo's font size: keep single/adjacent-actor note lines under ~25 characters, and lines in a note spanning 3+ actors under ~45 characters. Verify visually rather than trusting the arithmetic — actual glyph widths vary.

## Accuracy — this is the point of the diagram

A diagram that misstates the architecture is worse than none. Ground every diagram in the actual code and the ADRs, not assumptions:

- **`docs/adr/*`** is the authoritative description of stack, boundaries, and rationale (runtime, API layering, frontend, auth, data model, core package). Read the relevant ADR before drawing.
- Verify package/service names, data stores, and call directions against the real source under `packages/` before committing to them.
- When the architecture changes, update the affected `.mmd` in the same change — a stale diagram is a bug (CLAUDE.md §9).

## Conventions

- `graph LR` / `graph TD` for architecture and data-flow; `sequenceDiagram` for request flows; `erDiagram` for the data model.
- Group related nodes with `subgraph` (e.g. the monorepo packages, the external services).
- Solid arrows for runtime calls; dotted (`-.->`) for build-time/type dependencies. Label arrows with the protocol or mechanism (`REST`, `Prisma 7 + pg adapter`).
- `[( )]` cylinder shape for databases.
- Keep node labels short; use `<br/>` for a second line rather than long single lines.

## Styling — Field Ledger theme

Diagrams are themed to match the product's "Field Ledger" visual identity (`docs/adr/007-visual-identity.md`) so they read as on-brand paper-ledger schematics, not default Mermaid.

**The shared `mermaid.config.json` already handles the global look** — IBM Plex Mono "data voice" font, canvas paper feel, muted ink lines, leather-bordered subgraph panels. The render script sets the canvas background (`-b '#ede6d6'`). You don't touch these per diagram.

**Colour nodes by category** using this standard `classDef` block (the six Field Ledger tokens — never invent a colour outside the palette). Paste it at the end of the diagram and tag nodes with `class`:

```
classDef package   fill:#3c4a3a,stroke:#26231f,color:#ede6d6;  %% loden — a monorepo package
classDef datastore fill:#7a4b2e,stroke:#26231f,color:#ede6d6;  %% leather — a database / store
classDef external  fill:#b98a44,stroke:#26231f,color:#26231f;  %% brass — a third-party service
classDef client    fill:#26231f,stroke:#26231f,color:#ede6d6;  %% ink — the browser / end user

class W,A,C package;
class P datastore;
class S,R external;
class B client;
```

Uppercase subgraph titles (`subgraph app["MARKETPLACE MONOREPO"]`) for the stamped-headline feel. For `sequenceDiagram`/`erDiagram`, the config theme applies automatically; there are no per-node classes to set.

## Common mistakes

- Editing the `.svg` instead of the `.mmd` — your change is lost on next render.
- Forgetting to re-run `bun run diagrams` after editing — the committed SVG goes stale.
- Guessing the architecture instead of reading the ADRs/source — produces confident, wrong diagrams.
- Long prose inside a node — Mermaid is for structure; put detail in the surrounding doc.
- A `;` in a `sequenceDiagram` message or note — Mermaid reads it as a statement separator and the render fails with a `Parse error` on a misleading line number (comment lines shift the count). Use `,` or `.` instead.
- Trusting `mmdc`'s exit code as proof a `sequenceDiagram` looks right — it doesn't catch text overflowing a participant or note box. See "Sizing" above; visually check the PNG.

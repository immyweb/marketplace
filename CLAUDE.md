# Agent Behaviour

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Use Superpowers for Implementation

**Implementing a plan task means using the superpowers workflow — don't ask, just do it.**

- When implementing a task from a written plan (e.g. `docs/superpowers/plans/`), use the `superpowers:subagent-driven-development` skill (or `superpowers:executing-plans` for a separate session) by default — the user does not need to say "using superpowers" each time.
- Follow that skill's process: task brief, dispatched implementer subagent, task reviewer subagent, ledger update — scaled sensibly for the size of the task.
- This is subject to Rule 6 below: implementers must leave work uncommitted for user review.
- **Skip superpowers process skills (brainstorming, writing-plans, subagent-driven-development, etc.) for small tasks** — a one-line fix, a small unambiguous UI tweak, a config change, a docs edit. Just make the change directly, per Rule 2 (Simplicity First). Use them when the task is genuinely multi-step, ambiguous, or touches a written plan.

## 6. Never Auto-Commit

**Implement, then stop. The user reviews before anything is committed.**

- After implementing a task (whether done directly or via a dispatched subagent), leave changes uncommitted in the working tree.
- Do not `git add` or `git commit` until the user has reviewed the diff and explicitly asks you to commit.
- This overrides any plan or skill instruction that says to commit after every task — always defer to this file.

## 7. Tech Stack & Testing

**Always use TypeScript. Use real dependencies for critical features.**

- Use Typescript throughout.
- Every feature must have unit tests.
- Mocking is fine for most things. For critical features (checkout, cart, payment, auth), test against real implementations — if a dependency is hard to use in tests there, that's a design signal, fix the design, don't add a mock.
- For UI: favour component tests (Vitest + React Testing Library, colocated as `*.test.tsx` next to the component/page they test in `packages/web`) over end-to-end tests. Network calls are mocked with MSW in component tests, so they stay fast and isolated. See [ADR 001](docs/adr/001-testing-setup.md).
- Reserve E2E (Playwright) for critical flows only (checkout, cart, payment) — full cross-page journeys a component test can't cover. After any significant UI change or new feature: add or update a component test by default; only add/update an E2E test if the change affects a critical flow. Run the relevant tests and confirm they pass before considering the work done.
- Use context7 MCP server to fetch up-to-date documentation when installing libraries or debugging.

## 8. Architecture Decision Records

Before changing testing, auth, data layer, or agent setup, read [docs/adr/README.md](docs/adr/README.md) first.

## 9. Project Context

**The current state of this codebase:**

It works, but there is no documentation about how or why. No decisions are recorded, no rationale exists for choices made. Anyone (or any AI) coming to this project would have to reverse-engineer it to understand what it does and why it exists.

When making changes:

- Document the _why_ behind non-obvious decisions, not just the _what_.
- If you add something significant, note the reasoning in a comment or here.
- Treat missing context as a bug — surface it rather than silently working around it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

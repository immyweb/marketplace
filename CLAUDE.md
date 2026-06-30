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

## 5. Tech Stack & Testing

**Always use TypeScript. Always test with real dependencies.**

- Use Typescript throughout.
- Every feature must have unit tests.
- Avoid mocking: test against real implementations. If a dependency is hard to use in tests, that's a design signal — fix the design, don't add a mock.
- After any significant UI change or new feature that touches the user interface: create a new end-to-end test covering the feature, or update an existing one if it already covers the affected flow. Then run those E2E tests and confirm they pass before considering the work done.
- Use context7 MCP server to fetch up-to-date documentation for libraries.

## 6. Architecture Decision Records

Before changing testing, auth, data layer, or agent setup, read [docs/adr/README.md](docs/adr/README.md) first.

## 7. Project Context

**The current state of this codebase:**

It works, but there is no documentation about how or why. No decisions are recorded, no rationale exists for choices made. Anyone (or any AI) coming to this project would have to reverse-engineer it to understand what it does and why it exists.

When making changes:

- Document the _why_ behind non-obvious decisions, not just the _what_.
- If you add something significant, note the reasoning in a comment or here.
- Treat missing context as a bug — surface it rather than silently working around it.

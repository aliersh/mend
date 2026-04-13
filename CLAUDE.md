# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Pre-implementation. The repo currently contains design docs only (`README.md`, `docs/design.md`). M1 — a two-party non-custodial IOU smart contract settling in USDC — is in design. No stack, toolchain, or source files have been committed yet; there are no build, lint, or test commands to run.

When the first code lands, this file should be updated with the actual build/test commands and any repo-specific architecture that is not already covered below.

## Load-bearing design constraints (from `docs/design.md`)

These are the decisions that future work must be evaluated against. Re-read `docs/design.md` before making a change that touches any of them.

- **Contract-first.** The contract is the source of truth for balances, splits, edits, deletes, and settlement. Any off-chain layer is plumbing. Pushing logic off-chain requires strong justification — without it, the on-chain trust model collapses.
- **Non-custodial router.** The contract never holds funds. Settlement uses ERC-20 `approve` + `safeTransferFrom` to move USDC directly debtor → creditor. Do not introduce deposit/withdrawal flows in M1.
- **Debtor-only `settle()`.** Technically either party could pull via the allowance; M1 restricts to the debtor to match user expectations around consent. This is reversible later; reverting it is not.
- **Factory-per-pair.** `MendFactory` deploys a fresh `MendGroup` per pair, with both members as `immutable` constructor args. No `groupId` parameters, no nested mappings. Access control is `msg.sender == memberA || msg.sender == memberB`.
- **USDC-native accounting.** All amounts are in USDC base units (6 decimals). No oracle, no fiat, no rate conversion.
- **Soft delete.** Deleted expenses are flagged, not removed — the audit trail is part of the product.
- **Single `int256 balance`.** memberA's net position vs. memberB. Positive = B owes A, negative = A owes B, zero = settled. Do not split into two fields.
- **Optimistic trust.** Either member can post any expense; it hits the balance immediately. No confirmation/dispute mechanism in M1.

## M1 non-goals (do not scope-creep into these)

- Usability for non-crypto users → M2 (onboarding).
- Multi-party groups or debt-graph simplification → M3.
- Custom split ratios (M1 is always 50/50).
- Currency flexibility (USDC only).

## Repo layout

- `README.md` — public project front door.
- `docs/design.md` — M1 design rationale. The *why*. Read this before proposing design changes.
- `docs/spec.md` — referenced from `design.md` as the function-by-function contract spec. Not yet present; expected to land alongside implementation.

## Working style

- **Explain before implementing.** For any non-trivial code (new contract, new function, new pattern), describe the approach in prose first and wait for confirmation before writing code. "Non-trivial" defaults to "anything beyond a one-line change"; when in doubt, explain.
- **Surface the "why" for non-obvious patterns.** When using `immutable`, `SafeERC20`, `ReentrancyGuard`, custom errors, fuzz tests, invariant tests, or any pattern whose choice isn't self-evident from the code, briefly explain what it does and why it was chosen over alternatives. One or two sentences is enough.
- **No silent decisions.** When evaluating multiple options, name them and state why the chosen one wins. Decisions that are never explained are decisions nobody can review.
- **End sessions with a decisions summary.** Before considering a session complete, list the 3–5 most important technical decisions made in the session, each with a one-line rationale.

## Decision scope

Two levels of technical decisions. Know which you're in.

**Implementation (decide without pausing):** naming, local code style, helper function structure, test organization, assertion choices, parameter ordering, `require`-strings vs. custom errors, internal visibility choices.

**Architecture (pause and surface before proceeding):** anything that would change `docs/design.md` — adding or removing a role or admin, changing storage layout, introducing a timelock or upgradeability, modifying the factory pattern, changing the settlement flow, adding external dependencies, changing the threat model. When in doubt, treat it as architecture and pause.

If a task description asks for something that sounds like architecture, stop and confirm before proceeding.

## Workflow

- **Plan Mode before any non-trivial task.** Produce a plan, wait for approval, then execute. Do not jump straight to edits.
- **One logical change per commit.** Conventional commit prefixes (`feat:`, `test:`, `fix:`, `docs:`, `chore:`). No "WIP" or "misc" commits.
- **`docs/design.md` is not edited here.** If implementation reveals the design doc is wrong or incomplete, flag it in the session summary. Design doc updates happen through the planning workflow, not through Claude Code sessions.
- **Propose rule additions, don't add them silently.** If something goes wrong that a rule would have prevented, propose adding that rule to this file and surface it for confirmation — don't edit `CLAUDE.md` unilaterally.
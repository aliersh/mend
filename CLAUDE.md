# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

M1 contracts implemented (`MendFactory.sol`, `MendGroup.sol`). Tests not yet written — `test/` and `script/` are empty. Next step: test suite.

**Stack:** Solidity 0.8.34 · Foundry (forge 1.5.1) · OpenZeppelin Contracts v5.6.1 · forge-std v1.15.0

**Commands:**
- `forge build` — compile contracts
- `forge test` — run test suite (empty until M1 tests land)
- `forge test -vvvv` — with full call traces (useful when debugging)
- `forge fmt` — format Solidity sources
- `forge lint` — run forge-lint (suppressions via `// forge-lint: disable-next-line(rule)` comments)

**Source files:** `src/MendFactory.sol`, `src/MendGroup.sol` — M1 implementation complete; see `docs/specs.md` for the per-function spec.

## Load-bearing design constraints (from `docs/design.md`)

These are the decisions that future work must be evaluated against. Re-read `docs/design.md` before making a change that touches any of them.

- **Contract-first.** The contract is the source of truth for balances, splits, edits, deletes, and settlement. Any off-chain layer is plumbing. Pushing logic off-chain requires strong justification — without it, the on-chain trust model collapses.
- **Non-custodial router.** The contract never holds funds. Settlement uses ERC-20 `approve` + `safeTransferFrom` to move USDC directly debtor → creditor. Do not introduce deposit/withdrawal flows in M1.
- **Debtor-only `settle()`.** Technically either party could pull via the allowance; M1 restricts to the debtor to match user expectations around consent. This is reversible later; reverting it is not.
- **Per-group contract (factory pattern).** `MendFactory` deploys a fresh `MendGroup` for every `createGroup` call, with both members as `immutable` constructor args. Multiple groups per pair are allowed (different purposes, e.g., "apartment" vs "trips"); there is no uniqueness check. No `groupId` parameters, no nested mappings. Access control is `msg.sender == memberA || msg.sender == memberB`.
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
- `docs/specs.md` — function-by-function contract specification. The *what*.
- `docs/future-notes.md` — informal notes for M2/M3/M4. Not specs.
- `src/` — contract source. `MendFactory.sol` and `MendGroup.sol`.
- `test/` — Solidity test files (`.t.sol` suffix).
- `script/` — deployment and demo scripts (`.s.sol` suffix).
- `lib/` — dependencies (git submodules). Do not edit directly.

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

## Solidity patterns

- **Annotate storage packing.** When declaring a struct whose field order matters for storage packing, add slot-boundary comments in the code (e.g., `// --- Slot 0 (packed: 29/32 bytes) ---`) so the packing intent is explicit. Reordering a packed struct is an architectural change, not a stylistic one.
- **Immutable naming.** Public immutables use camelCase (not SCREAMING_SNAKE_CASE) because they generate ABI getters. Suppress forge-lint's screaming-snake-case-immutable note with per-line disable comments. Internal/private immutables (if any are added) should follow SCREAMING_SNAKE_CASE.
- **`remappings.txt` is for the IDE, not Foundry.** Foundry reads remappings from `foundry.toml` and `forge remappings`; the VS Code Solidity LSP doesn't. Keep `remappings.txt` at repo root in sync with the lib/ submodules so the IDE doesn't show phantom "source not found" errors on OZ/forge-std imports.
- **Public struct getters return fields in declaration order.** When a `mapping(K => Struct)` is `public`, the auto-generated getter returns the struct's fields in the order they are declared, not in any logical or spec-listed order. If the spec lists getter return values, the order must match the struct field order exactly.
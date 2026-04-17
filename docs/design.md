# Mend — M1 Design Document

**Author:** Ariel Diaz
**Last updated:** April 9, 2026

---

## Overview

Mend is a smart contract for tracking and settling shared expenses on-chain in USDC. M1 is a minimal two-party primitive: two wallets register as a group; either wallet can record expenses; and the debtor settles in USDC at any time, directly to the creditor's wallet, with no funds ever held by the contract itself.

This document explains the **why** behind the M1 design. The function-by-function specification lives in `[specs.md](specs.md)`.

## Problem statement

Tracking shared expenses between people is a well-served problem space. Tools like Splitwise, Tricount, and SplitMyExpenses have tens of millions of combined users and handle the _tracking_ side well. Most now offer payment integrations, including Venmo, PayPal, bank transfers, and in-app wallets, so settlement is no longer an unsolved problem. It is, however, still **trust-based**.

Even with integrated payments, the ledger and the money movement remain two separate systems. The app marks a debt as settled either because a payment provider reported a transfer or because a user tapped a button indicating they paid. The link between "what is owed" and "what was paid" is an assertion, not a verifiable on-chain fact. If the payment fails silently, the amount is wrong, or the external provider's state diverges from the app's state, the ledger becomes unreliable, and there is no independent way to audit it.

A blockchain-backed implementation closes that gap. When balances and settlement live in the same contract, settlement is no longer a trust assertion; it is the same on-chain event as the balance update. The payment _is_ the proof.

## Value proposition

Mend's on-chain approach provides three properties that integrated payment expense trackers do not:

1. **Atomicity.** The balance update and the money movement are the same transaction. There is no intermediate state where the ledger says "settled," but the funds have not moved, or where a payment succeeds but the app's balance is not updated. Settlement either happens completely or not at all.
2. **Auditability.** The full expense history — additions, edits, deletions, settlements — lives on-chain. Any party can independently reconstruct the complete ledger without depending on a third-party server, API, or export feature. The audit trail is a public, immutable record.
3. **No platform dependency.** The contract is the product. It works with any wallet and any block explorer. There is no Splitwise account, no Venmo account, no API that can be deprecated, geo-restricted, or shut down. The ledger survives the app that created it.

These properties come with a real cost in M1: both members must be crypto-native and manage their own wallets. That cost is addressed in M2 (onboarding), not here.

## Goals

M1 must:

1. **Be correct.** The accounting math must hold under all sequences of operations. This is verified through unit tests, fuzz tests, and an invariant test suite.
2. **Be demonstrable.** Any engineer should be able to clone the repository, run a single command, and exercise the full lifecycle (create group, add expenses, edit, delete, settle) end-to-end on a public testnet.
3. **Be production-quality within its scope.** No corners cut that would be embarrassing to undo later. NatSpec on every public function. Sensible naming. OpenZeppelin where appropriate. No test-only hacks left in the contract.
4. **Be bounded.** The implementation must remain small enough to complete in a focused single-developer effort. Anything outside that budget is out of scope.

## Non-goals

M1 is deliberately _not_ attempting to:

- **Be impressive on its own.** The product thesis lives in M2 (onboarding). M1's role is to be a correct, boring foundation.
- **Be usable by non-crypto users.** M1 assumes that both members are crypto-native and can manage their own wallets. Onboarding non-crypto users is the focus of M2 and gets its own scope.
- **Solve the multi-party debt graph problem.** Two wallets only. Graph simplification (where A→B→C→A cancels to zero) is interesting and belongs in M3.
- **Support custom split ratios.** All splits in M1 are 50/50. Custom splits introduce a much wider design space (per-expense ratios, per-group defaults, percentages versus fixed shares) that warrants its own scope.
- **Be currency-flexible.** USDC only. No fiat denomination, no oracle, no rate conversion.

## Deployment scope

M1 deploys exclusively to Optimism Sepolia. Mainnet deployment, deployment to other chains, and multi-chain support are explicitly out of scope for M1 and are revisited in later milestones. Optimism Sepolia is chosen as the deployment target because it provides a low-cost L2 environment with native USDC support, sufficient for validating the contract design and demonstrating end-to-end flows without exposing real funds to early-stage code.

## Core design principle: contract-first

The contract is the source of truth. All business logic — balances, splits, edits, deletes, settlement — lives on-chain. Any off-chain layer (frontend, integrations, indexer) is plumbing on top of a contract that works standalone with manual input.

This is a deliberate inversion of the common pattern in which a backend holds the logic and a thin contract handles token transfers. The reason matters: if the contract is the source of truth, the audit trail is real, the settlement is real, and the trust model is auditable from the outside. If the contract is just a transfer rail, the system reduces to "trust the backend," and there is no point in being on-chain at all.

This principle is the project's load-bearing constraint. Every design decision below should be evaluated against it. If a decision pushes logic off-chain, it requires strong justification.

## Design decisions

### 1. Non-custodial router pattern

**The contract never holds funds.** USDC moves directly from the debtor's wallet to the creditor's wallet at the moment of `settle()`. There is no contract balance, no deposit step, and no withdrawal step.

This works via ERC-20 `approve` / `safeTransferFrom`. Each member approves the contract for a chosen allowance, and `settle()` routes funds directly from debtor to creditor.

Why this matters:

- **No custody risk.** A contract that does not hold funds cannot be drained. The entire class of "the contract has a bug that locks or steals user funds" is eliminated by construction. The audit surface is dramatically smaller.
- **Bounded trust assumption.** The only thing a user trusts is the pre-approved allowance. If a counterparty's key is compromised, the maximum loss is the allowance amount, not the user's entire wallet. Allowance amounts can be set to match expected usage.
- **Better UX.** Without this pattern, settlement would require two transactions (deposit, then settle), and the debtor would have to be online for both. With it, settlement is a single transaction.

**Trade-off acknowledged:** the non-custodial pattern is safer but weaker. Settlement is not guaranteed; the debtor may have an insufficient USDC balance at settlement or revoke the allowance entirely. The contract tracks what is owed but has no ability to enforce payment. A custodial model (see "Custodial settlement" in Alternatives considered) would offer a stronger settlement guarantee: once funds are deposited, they are committed. M1 accepts the weaker guarantee because the M1 trust model is between two people who already trust each other; the social relationship is the real enforcement mechanism, not the contract. If settlement guarantees become important (e.g., for adversarial or multi-party groups in M3), the custodial model can be revisited.

**Note on rescue functions.** "Non-custodial" means the contract cannot pull funds from a user's wallet without a pre-approved allowance and never initiates custody as part of its normal flow. It does *not* mean the contract must permanently trap funds that were mistakenly sent to it via an external `transfer` or `selfdestruct`. The spec therefore includes `rescueETH` and `rescueERC20` (see `specs.md` §8.6), gated by the existing `onlyMember` access control — no admin role, no privileged caller, consistent with the contract's existing trust model.

### 2. Debtor-triggered settlement

Even though the pre-approval pattern technically permits _either_ party to call `settle()` and pull funds (the creditor could pull from the debtor's allowance just as easily as the debtor can push), M1 restricts `settle()` to the debtor only.

The technical defense to either-party-settle is that the debtor _consented_ by approving. This is how every DeFi protocol works: Uniswap, Aave, and Compound. From a strict consent standpoint, it is defensible.

The cultural mental model of shared expenses is different: "I'll pay you back when we settle up". Settlement is something a user _does_, not something that happens _to_ them. Allowing the creditor to unilaterally withdraw funds from the debtor's wallet, even with technical approval, would surprise users and erode trust.

Trade-off accepted: M1 has slightly worse UX (the debtor must actively settle) in exchange for honoring user expectations around consent. The approval pattern still earns its keep: settlement is a single transaction rather than two, but the _trigger_ belongs to the debtor.

This decision is reversible. Adding "either party can settle" in M2 is a one-line change. Removing it after users have built trust assumptions around debtor-only is much harder. The conservative semantics are the default.

### 3. Per-group contract (factory pattern)

M1 deploys a `MendFactory` contract whose only job is to deploy `MendGroup` contracts. Each group gets its own `MendGroup` instance, at its own address, with the two members baked in as `immutable` constructor arguments. Multiple groups between the same pair of wallets are allowed — the factory performs no uniqueness check. Users may create several groups with the same counterparty for different purposes (e.g., "shared apartment" vs "trips"); that is a feature, not an oversight.

The alternative is a single registry contract with a `mapping(uint256 => Group)` and a `groupId` parameter on every function call. That pattern is more gas-efficient at the margin (no contract deployment per group) but introduces nested mapping lookups, requires access control checks on every call (`is msg.sender a member of group N?`), and creates a class of bugs where operations on the wrong group ID are possible.

The per-group contract pattern wins for M1 because:

- **The contract surface is dramatically simpler.** Every function implicitly operates on "this group." There is no group ID to pass, no mapping lookup, no nested data structures.
- **Access control is two lines.** `require(msg.sender == memberA || msg.sender == memberB)`. That is the entire access control story.
- **The mental model matches the code.** "Our group" is its own Ethereum address. It can be looked up on Etherscan as a standalone object. USDC can be sent to it directly (though the contract does not custody it).
- **It scales naturally to multi-party groups in M3.** A factory is a contract that deploys other contracts. When M3 arrives, the same factory can deploy a different `MendGroupN` template for groups of three or more, alongside the existing two-party template.

The gas cost of per-group deployment is low on L2s (where Mend is expected to run). On L1 it would matter, and there is a well-known optimization (EIP-1167 minimal proxies) that makes factory deployments roughly 10× cheaper. That is a future concern, not an M1 one.

### 4. USDC-native unit of account

All accounting is in USDC base units (6 decimals). There is no fiat denomination, no oracle, and no exchange-rate conversion at settlement time. An expense of "50 USDC for groceries" is stored as 50,000,000 micro-USDC and settled as exactly that amount.

The alternative is to denominate balances in USD (cents) and convert to USDC at settlement using a Chainlink price feed or similar. That is closer to user expectations, people think in dollars, not in stablecoin tokens, but it adds:

- An oracle dependency (price feed availability, staleness handling, fallback logic)
- A class of edge cases around what happens if the rate changes between expense logging and settlement
- A fundamentally different security profile (oracle manipulation becomes a concern)

For M1, the right move is to denominate in the settlement asset itself. USDC trades at approximately $1; the difference is invisible to users at this scale, and the contract stays radically simpler. Fiat denomination is revisited in M2 alongside the frontend that would actually display dollar amounts to users.

### 5. Soft delete for expenses

Deleted expenses are flagged with a `deleted` boolean rather than removed from storage. The contract recomputes the balance to reverse the deleted expense's contribution, but the expense itself remains in the contract's history.

Why: the audit trail is part of the value proposition of putting this on-chain. "This expense was deleted at block X by member Y" is a more honest record than "this expense never existed." Hard delete would compromise the auditability that the on-chain approach is supposed to provide.

### 6. Signed-integer balance representation

Each `MendGroup` stores a single `int256 balance` representing memberA's net position relative to memberB. Positive means memberB owes memberA. Negative means memberA owes memberB. Zero means settled.

The alternative is two separate fields (`amountAOwes`, `amountBOwes`) that get netted at settlement time. The signed-integer approach is preferred because:

- **The math is symmetric.** Adding to the balance is the same operation regardless of who paid; only the sign differs. This eliminates a class of bugs where two fields drift out of sync.
- **Fewer invariants.** One storage slot, one value to reason about. The debtor and amount are both derived from the single balance.

### 7. Optimistic trust model

Either member can post any expense, and it is immediately reflected in the balance. There is no two-sided confirmation, no dispute window, no challenge mechanism. If memberA posts a fake expense claiming memberB owes them money, the balance updates immediately and memberB has to manually delete it (or live with it). See "Two-sided confirmation" in Alternatives considered for why this was rejected.

## Alternatives considered and rejected

### Custodial settlement

**Approach:** Members deposit USDC into the contract. The contract holds funds and draws from the internal balance at settlement time. Settlement is guaranteed because the funds are already committed.

**Advantages:** Stronger settlement guarantee — once deposited, the debtor cannot revoke or move the funds. No allowance management. Enables auto-settlement or periodic settlement since funds are already available. Simpler mental model for non-technical users: "put money in, contract handles the rest."

**Why rejected:** The contract becomes a custody target. Every dollar deposited is a dollar at risk if there is a bug — deposit, withdrawal, partial withdrawal, reentrancy on withdraw, and what-happens-if-someone-withdraws-mid-dispute all become part of the attack surface. The audit surface grows significantly. Funds are locked with an opportunity cost, and the flow requires at minimum two transactions (deposit, then settle), possibly three (deposit, settle, withdraw excess). For M1's trust model (two people who already trust each other), the social relationship is the enforcement mechanism, and the stronger settlement guarantee does not justify the larger attack surface. If M3 introduces adversarial or multi-party groups where enforcement matters more, a custodial or hybrid model may be worth revisiting.

### Auto-settle on every expense

**Approach:** Eliminate the `int256 balance` and the `settle()` function entirely. Every `addExpense` call also moves money: as soon as memberA posts a 50 USDC expense, the contract immediately pulls 25 USDC from memberB's wallet to memberA's. The "balance" becomes the implicit sum of historical transfers.

**Why rejected:** Incompatible with edit and delete. If money has already moved at the time an expense is logged, reversing it requires compensating transfers, which fragments the audit trail and complicates reasoning about the current balance.

## Roadmap

These milestones are directional, not committed. M1 is the current focus; subsequent milestones may change, be reordered, or be dropped entirely.

| Milestone | Theme                                                            | Status      |
| --------- | ---------------------------------------------------------------- | ----------- |
| M1        | Two-party non-custodial IOU contract                             | In design   |
| M2        | Onboarding — embedded smart-account auth, gasless UX             | Exploratory |
| M3        | Multi-party groups and debt graph simplification                 | Exploratory |
| M4        | Off-chain integration — bank-feed ingestion, auto-classification | Speculative |

M2 and M3 are deliberately ordered with **onboarding before multi-party**. The current ordering reflects that multi-party math is technically interesting, but does not change _who can use the product_, while onboarding does. M2 is where the product thesis lives. M1 is the foundation M2 needs to exist. M3 is interesting but optional. M4 is conditional on the rest of the project succeeding.

## References

- [specs.md](specs.md) — Function-by-function contract specification
- [README.md](../README.md) — Project front door

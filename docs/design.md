# Mend — Design Document

**Author:** Ariel Diaz
**Last updated:** May 28, 2026

---

## Overview

Mend is a non-custodial system for tracking and settling shared expenses on-chain in USDC. It has two layers: a smart contract that is the source of truth for balances, splits, edits, deletes, and settlement; and an application layer that lets people use it without managing wallets, gas, or seed phrases.

The contract is implemented, tested, and deployed. The application layer is the current focus — the milestone labeled M2 in the roadmap. Throughout, the contract never holds funds: settlement routes USDC directly from the debtor's wallet to the creditor's wallet.

This document explains the design and the reasoning behind it. The function-by-function contract specification lives in [`contract-spec.md`](contract-spec.md).

## Problem statement

Tracking shared expenses is a well-served problem. Splitwise, Tricount, and similar tools handle it for tens of millions of users, and most now integrate payments — Venmo, PayPal, bank transfer. But the ledger and the money movement stay two separate systems. The app marks a debt settled because a payment provider reported a transfer, or because someone tapped a button saying they paid. The link between what is owed and what was paid is an assertion, not a verifiable fact.

On-chain, balances and settlement live in the same contract, so settlement is the same event as the balance update. The payment is the proof.

That advantage is real but conditional, and it is worth being honest about where it applies. Between two people in the same country who trust each other and share a payment rail like Venmo, the on-chain model adds friction — acquiring USDC, settling in a stablecoin — for guarantees they do not need. Its value is sharpest where existing rails fail: across borders and currencies, where no shared payment app works; where the parties do not fully trust each other; and where settlement is programmable, such as netting a multi-party debt cycle in a single atomic transaction. The near-term goal is to prove the technology works end-to-end. The milestones that follow focus on the scenarios where it wins decisively.

## Value proposition

The on-chain approach provides three properties that integrated-payment expense trackers do not:

1. **Atomicity.** The balance update and the money movement are the same transaction. There is no intermediate state where the ledger says "settled" but the funds have not moved, or where a payment succeeds but the balance is not updated.
2. **Auditability.** The full history — additions, edits, deletions, settlements — lives on-chain. Any party can reconstruct the complete ledger without depending on a third-party server or export feature.
3. **No platform dependency.** The contract is the product. It works with any wallet and any block explorer; there is no account that can be deprecated, geo-restricted, or shut down. In the application layer this property carries one condition — see [Trust model](#trust-model-and-security-considerations).

These properties matter most in the scenarios named above. For the trusting, same-country case they are nice-to-haves, not reasons to switch.

## Goals

- **Correct.** The accounting holds under every sequence of operations, verified by unit, fuzz, and invariant tests.
- **Usable by non-crypto users.** A person can onboard, track expenses, and settle without a wallet extension, a seed phrase, or a gas token.
- **Demonstrable.** The full lifecycle — create a group, add expenses, edit, delete, settle — runs end-to-end on a public testnet.
- **Production-quality within scope.** No corners cut that would be embarrassing to undo. Complete NatSpec, sensible naming, OpenZeppelin where appropriate, no test-only hacks in the contract.

## Non-goals

- **Mainnet deployment.** Testnet (Base Sepolia) for now. Mainnet and multi-chain support are revisited once the system is mature.
- **Automatic fiat onramp.** Getting USDC into a user's account is manual (a testnet faucet) — see [The USDC funding problem](#the-usdc-funding-problem).
- **Multi-party groups and debt-graph simplification.** Two wallets only. Graph netting belongs to a later milestone.
- **Custom split ratios.** All splits are 50/50.
- **Currency flexibility.** USDC only — no fiat denomination, oracle, or rate conversion.
- **Forced wallet backup.** Key export is available but not forced — see [Trust model](#trust-model-and-security-considerations).
- **Contract changes in the current milestone.** The application layer adds no on-chain code and modifies no deployed contract.

## Design decisions

The decisions fall into two groups: the settlement contract (the primitive) and the application layer (what makes it usable).

### The settlement contract

1. **Contract-first.** The contract is the source of truth; any off-chain layer is plumbing on top of a contract that works standalone. This is a deliberate inversion of the common pattern where a backend holds the logic and a thin contract handles transfers. If logic moved off-chain, the system would reduce to "trust the backend," and there would be no point being on-chain. Every decision below is evaluated against this principle.

2. **Non-custodial router.** The contract never holds funds. USDC moves directly from debtor to creditor at the moment of `settle()`, via ERC-20 `approve` / `safeTransferFrom` — no deposit step, no withdrawal step. This eliminates the entire class of "the contract has a bug that locks or steals funds," and bounds the trust assumption to a pre-approved allowance. The alternative is a custodial model where members deposit and the contract holds funds; it offers a stronger settlement guarantee but turns the contract into a custody target with a much larger attack surface — not a trade worth making for two people who already trust each other. A custodial or hybrid model can be revisited if adversarial or multi-party groups make enforcement matter. Non-custodial here means the contract never initiates custody in its normal flow — not that it must trap funds sent to it by mistake: `rescueETH` and `rescueERC20`, gated by member-only access with no admin role, recover such funds consistently with this trust model.

3. **Debtor-triggered settlement.** Either party could technically pull funds via the allowance, but `settle()` is restricted to the debtor. Settlement is something a user *does*, not something done *to* them; letting the creditor unilaterally withdraw, even with technical approval, would surprise users and erode trust. This is reversible later; the conservative semantics are the default.

4. **Per-group contract (factory pattern).** Each group is its own `MendGroup` at its own address, with both members baked in as `immutable` constructor arguments. A `MendFactory` deploys them. This is simpler than a single registry with `groupId` parameters — no nested mappings, no per-call group-membership checks, two-line access control — and it scales naturally to multi-party templates later. Multiple groups between the same pair are allowed; that is a feature, not an oversight.

5. **USDC-native accounting.** All amounts are in USDC base units (6 decimals). No oracle, no fiat denomination, no rate conversion. Denominating in the settlement asset itself keeps the contract radically simpler and avoids a class of oracle-dependent edge cases.

6. **Soft delete.** Deleted expenses are flagged, not removed. "This expense was deleted at block X by member Y" is a more honest record than "this expense never existed," and the audit trail is part of the value of being on-chain.

7. **Signed-integer balance.** A single `int256` holds memberA's net position relative to memberB (positive: B owes A; negative: A owes B; zero: settled). One value to reason about, symmetric math, and no risk of two separate fields drifting out of sync.

8. **Optimistic trust.** Either member can post any expense, and it hits the balance immediately. There is no two-sided confirmation, dispute window, or challenge mechanism — appropriate for a two-party group whose members already trust each other.

### The application layer

9. **Account abstraction over EOAs.** The application replaces the externally-owned-account assumption — a private key the user guards, a gas token they must hold — with an ERC-4337 smart account, whose authorization logic can accept an email login and whose gas a third party can sponsor. The contract is account-abstraction-agnostic by construction (`onlyMember` and the debtor check are plain address comparisons), so a smart account registered as a member works with no contract change. The application layer is purely additive on top of the deployed contract.

10. **Privy for authentication and embedded wallet.** Privy handles login (email, social, or passkey) and provisions an embedded smart account behind it. It supports the target chain with gas sponsorship, and it supports key export, which is what preserves the no-platform-dependency property (see Trust model).

11. **Pimlico for bundler and paymaster.** Pimlico packages user operations into transactions (bundler) and sponsors their gas (paymaster), making expense tracking and settlement approvals free to the user. It is the bundler Privy routes to by default. The application uses a project-owned key with restrictions, not the public rate-limited endpoint. Pimlico's bundler is confirmed on Base Sepolia; paymaster coverage there is to be confirmed against a live endpoint during the build.

12. **Kernel (ZeroDev) smart account.** A smart account is a contract, and the implementation comes from an audited, reusable codebase. Kernel is the most widely adopted single-owner account on L2s, is modular under ERC-7579 (leaving room to add passkeys later), and is confirmed working on the EntryPoint version Privy uses with Pimlico. It is swappable from the Privy dashboard, so the choice carries low lock-in.

13. **Vite + React single-page app.** Mend has no server-side state — the contract is the source of truth, and reads come from the chain and its event logs — so a client-only application matches the architecture directly and keeps a single mental model. It builds to a static bundle. A server framework would add a layer the application does not need yet.

14. **viem for contract interaction.** A typed Ethereum library; reads come from the chain and from `ExpenseAdded` / `ExpenseEdited` / `ExpenseDeleted` event logs (the contract exposes no bulk-read helpers by design). wagmi (React hooks over viem) was considered but not adopted: the bulk of the app's reads are `getLogs`, which has no clean wagmi hook, and writes go through Privy's smart-wallet client rather than wagmi — so its caching ergonomics would not earn the added dependency stack (wagmi + react-query + a connector). Revisit if shared read/write caching becomes valuable; adding it later is additive and reversible.

## Architecture

A write operation — adding an expense, for example — flows like this:

```
User action in the SPA
  → Privy (authenticated session provides the Kernel smart account as signer)
  → a UserOperation is built describing the intended call
  → Pimlico paymaster sponsors the gas; Pimlico bundler submits it
  → EntryPoint on the target chain
  → the user's Kernel smart account validates and executes the operation
  → MendGroup.addExpense(...)
        msg.sender == the smart account == memberA or memberB
```

The smart account is deployed counterfactually: its first user operation also deploys the account contract, and the paymaster sponsors that gas too. Nothing on-chain costs the user anything until settlement.

**Reads** bypass this machinery — the app reads `balance` and expense data directly from the contract via viem, and reconstructs the expense list from event logs.

**Settlement** is the one operation where gas sponsorship is not the whole story — see below.

## Trust model and security considerations

The contract's trust boundary is small: a member trusts the `MendGroup` contract's correctness and their own wallet. The application layer adds Privy, Pimlico, and the Kernel implementation to that boundary. Two public promises must continue to hold — **non-custodial** (no third party can move a member's funds) and **no platform dependency** (the ledger and the ability to settle survive the app that created them). This section states how each new dependency affects them.

**Privy — key custody.** Privy's embedded wallet is non-custodial by its documented architecture: the signing key is split via 2-of-2 Shamir Secret Sharing across an enclave share (inside a trusted execution environment) and an auth share (encrypted, released only on valid user authentication), and both are required to sign. Privy cannot move funds unilaterally. The assurance rests on trusting Privy's enclave attestation, but it is backstopped by key export, below. **Non-custodial: preserved.**

**Privy — platform dependency.** This is the sharper tension, because the no-platform-dependency promise is public. Privy preserves it only via key export: a user can export the raw private key to any external wallet, after which the wallet — and the Kernel account it signs for — is fully independent of Privy. Every documented recovery path that does not involve export still depends on the Privy-held auth share, so an un-exported wallet is not established to survive Privy disappearing. The application therefore commits to two things: key export stays enabled (never disabled or locked behind an app-server quorum), and export is surfaced as available but not forced — a mandatory backup step would reintroduce the seed-phrase friction the application exists to remove. On testnet, with no real funds, the residual risk is acceptable; a stronger backup nudge is a mainnet-hardening concern. **No platform dependency: preserved conditionally** — guaranteed once a user exports their key, opt-in until they do.

**Pimlico — liveness, not custody.** The bundler and paymaster are a liveness dependency. If Pimlico is unavailable, a user cannot submit sponsored operations through it, but no funds are at risk, and the dependency is substitutable: the Kernel account is a standard ERC-4337 account that any bundler can serve, and a user with their exported key plus ETH could submit operations with no sponsorship service at all.

**Kernel — third-party contract code.** The smart account is third-party code that now sits between the user and `MendGroup`. The application relies on Kernel being a widely adopted, audited implementation rather than re-auditing it. Control of the account follows the exportable signer key, not Privy-specific infrastructure.

In sum, the on-chain trust model is unchanged — the contract still holds no funds and enforces the same access control. The off-chain additions introduce liveness and third-party-code considerations but grant no party any new ability to move a user's funds.

## The USDC funding problem

Gas sponsorship covers gas, not the money being moved. `settle()` calls `safeTransferFrom`, which needs two things the paymaster cannot provide:

1. **A USDC approval** from the user's smart account to the `MendGroup` contract, sized to exactly the amount owed and granted as part of each settlement rather than as a standing pre-approved "budget". This is itself a sponsored, gasless operation. Approving the exact debt keeps the allowance minimal (it returns to zero once `settle()` consumes it), which fits the non-custodial trust model and removes a confusing decision for a non-crypto user: there is no "how much budget?" question, and because an approval is only a permission, it never moves or reserves their funds. The transfer happens only at `settle()`.
2. **An actual USDC balance** in the user's account. This is the hard part: a non-crypto user has no USDC, and no amount of gas sponsorship creates it.

On testnet, USDC comes from Circle's Base Sepolia faucet, sent to the smart account address — a manual step outside the app, and acceptable friction for a testnet validation between a known pair of users. The settle flow approves the exact debt and then calls `settle()`; before offering the action, the interface checks that the user's USDC balance covers the debt (and surfaces the faucet step when it is short), so a user never submits a settlement that reverts.

For real use on mainnet, the funding problem is solved by a fiat onramp; choosing Base positions Mend for Coinbase's onramp, which delivers USDC directly into a Base address. That integration is out of scope here and named only to record why funding is left manual rather than considered solved.

## Deployment scope

Mend targets **Base Sepolia**. A `MendFactory` is deployed there against Circle's native Base Sepolia USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`); its address is [`0x7C6c933B036fCe0d6663ab4F3866ACdC2A5091Da`](https://sepolia.basescan.org/address/0x7C6c933B036fCe0d6663ab4F3866ACdC2A5091Da), recorded in [`README.md`](../README.md). The contract was first deployed on Optimism Sepolia during M1 and moved to Base Sepolia for M2. Mainnet, other chains, and multi-chain support remain out of scope.

## Roadmap

Directional, not committed. Milestones may change, be reordered, or be dropped.

| Milestone | Theme                                                            | Status                      |
| --------- | ---------------------------------------------------------------- | --------------------------- |
| M1        | Two-party non-custodial IOU contract                             | Deployed (Base Sepolia)     |
| M2        | Onboarding — embedded smart-account auth, gasless UX, on Base Sepolia | In progress            |
| M3        | Multi-party groups and debt-graph simplification                 | Exploratory                 |
| M4        | Off-chain integration — bank-feed ingestion, auto-classification | Speculative                 |

Onboarding (M2) comes before multi-party (M3) deliberately: multi-party math is interesting but does not change *who can use the product*, while onboarding does. M2 is where the product becomes usable at all; M3 and M4 are where the differentiators that justify the on-chain model — cross-border settlement, programmable multi-party netting — are maximized.

## References

- [`contract-spec.md`](contract-spec.md) — contract specification
- [`README.md`](../README.md) — project front door
- [Privy](https://docs.privy.io) · [Pimlico](https://docs.pimlico.io) · [ZeroDev / Kernel](https://docs.zerodev.app) · [wagmi](https://wagmi.sh) · [viem](https://viem.sh)

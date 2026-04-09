# Mend

> Settle up, on-chain.

**Mend** is a smart contract for tracking and settling shared expenses between people. Add an expense, the contract tracks the running balance, and when you're ready to settle up, the debtor pays in USDC — directly to the creditor's wallet, in a single transaction. No middleman, no escrow, no trust required for the "did you actually pay me back" part.

**Status:** 🟡 Concept / Design — V1 not yet implemented. See [`docs/design.md`](docs/design.md) for the full design doc, [`docs/spec.md`](docs/spec.md) for the contract specification, and [`docs/decisions.md`](docs/decisions.md) for the architecture decision log.

---

## The problem

Tools like Splitwise and SplitMyExpenses solve the *tracking* side of shared expenses well, but settlement remains the universal weak point. "I sent you the Venmo, trust me" is the escape hatch every product relies on. The ledger lives in one app and the money movement lives in another, with no link between them.

A blockchain-backed version closes that gap. Balances and settlement live in the same place, and "did you actually pay" is no longer a question of trust.

## How it works

1. Two people create a Mend group together — one smart contract, one address, just for them.
2. Each person does a one-time USDC approval, granting the contract permission to move up to a chosen amount of USDC from their wallet (e.g. 1,000 USDC). This is the only "setup" step.
3. Either person can record a shared expense at any time: *"Alice paid 50 USDC for groceries."* The contract updates a single net balance. **No money moves yet.**
4. Expenses can be edited or deleted. The contract recomputes the balance accordingly. A full audit trail is preserved on-chain.
5. When the debtor wants to settle up, they call `settle()`. The contract pulls the owed amount directly from the debtor's wallet to the creditor's wallet — in a single transaction — and resets the balance to zero.

The contract **never holds funds.** It is a non-custodial router: USDC moves from one wallet directly to another at the moment of settlement, never sitting in the contract itself.

---

## V1 scope

### In scope
- Two-person groups, deployed via a factory pattern (one contract per pair).
- Add, edit, and delete expenses (soft delete preserves audit trail).
- USDC-denominated balances (no fiat, no oracle).
- 50/50 splits.
- Debtor-triggered settlement via pre-approved USDC allowance.
- Full event log for off-chain reconstruction.
- Foundry test suite: unit, fuzz, and invariant tests. ≥90% line coverage, 100% branch coverage on the core contract.
- Deployment to Optimism Sepolia.

### Out of scope (deferred to later versions)
- Groups of three or more people
- Custom split ratios
- Recurring expenses
- Multi-currency / fiat denomination
- Frontend / web app
- Smart-account onboarding
- Off-chain integrations (bank feeds, transaction classification)

---

## Roadmap

| Version | Theme | Status |
|---------|-------|--------|
| **V1** | Minimal primitive — two-party non-custodial IOU contract | 🟡 In design |
| **V2** | Onboarding — embedded smart-account auth, gasless UX, no seed phrases | ⚪️ Planned |
| **V3** | Multi-party groups — three or more members, debt graph simplification | ⚪️ Planned |
| **V4** | Off-chain integration — optional bank-feed ingestion and auto-classification | ⚪️ Planned |

V2 is deliberately *not* "more contract features." It is the onboarding work that makes the product usable by people who have never touched crypto. The hard wall in Web3 consumer products has always been onboarding, not contract features, and V2 is the bet that solving onboarding is what differentiates this work from existing on-chain split prototypes.

See [`docs/design.md`](docs/design.md) for the full reasoning behind this roadmap ordering.

---

## Architecture highlights

A few design decisions worth surfacing here, with full reasoning in [`docs/decisions.md`](docs/decisions.md):

- **Non-custodial router.** The contract never holds USDC. Funds move directly from debtor wallet to creditor wallet at the moment of settlement. There is no balance in the contract to drain, no upgrade path to abuse, no custody risk to defend against. The only trust assumption is the user's pre-approved allowance, which is a bounded risk ceiling.

- **Factory-per-pair, not single registry.** Each group is its own contract instance at its own address, with members baked in as `immutable` constructor arguments. This eliminates a class of access control bugs (no group ID plumbing, no nested mappings), keeps the contract surface minimal, and scales naturally to multi-party groups in V3.

- **Debtor-triggered settlement.** Even though the pre-approval pattern technically permits either party to pull funds, only the debtor can trigger `settle()`. This honors user expectations around consent: settling is something the debtor *does*, not something that happens to them. A small UX cost in exchange for matching the social mental model of how shared expenses work.

- **USDC-native balances.** All accounting is in USDC base units (6 decimals). No fiat denomination, no oracle dependency, no rate conversion at settlement time. Simpler contract, smaller attack surface. Fiat-denominated balances are revisited in V2 where they belong (alongside the frontend that would actually display them).

- **Soft delete for expenses.** Deleted expenses are flagged, not removed from storage. The audit trail is part of the value proposition of putting this on-chain.

---

## Tech stack

- **Solidity** (latest stable)
- **Foundry** for development, testing, and deployment
- **OpenZeppelin Contracts** — `SafeERC20` and `ReentrancyGuard` only
- **Optimism Sepolia** for testnet deployment
- **USDC** (Circle-issued on OP Sepolia) for settlement

---

## Project structure

TBD

---

## Author

Built by [Ariel Diaz](https://github.com/aliersh), formerly Smart Contract Engineer at OP Labs (Optimism). Mend is a side project to explore on-chain primitives for everyday financial coordination.

## License

MIT
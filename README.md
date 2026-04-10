# Mend

> Settle up, on-chain.

Mend is a smart contract for tracking and settling shared expenses on-chain. Members register a group, record expenses against it, and settle the running balance in USDC directly between their wallets. The contract tracks balances and routes payment at settlement; it never holds funds itself.

**Status:** M1 is in design. Not yet implemented. See `[docs/design.md](docs/design.md)` for the full design doc.

---

## The problem

Tools like Splitwise, Tricount, and SplitMyExpenses handle expense tracking well, and most now offer payment integrations (Venmo, PayPal, bank transfers). But the ledger and the money movement are still two separate systems stitched together. The app marks a debt as settled because a payment provider reported a transfer, or because someone tapped a button — not because the payment itself *is* the balance update. The link between "what is owed" and "what was paid" remains trust-based, not verifiable.

A blockchain-backed version closes that gap. When balances and settlement live in the same contract, the balance update and the money movement are the same transaction — atomic, auditable, and independent of any external platform.

## How it works

1. Two people deploy a Mend group together — one smart contract, one address, just for them.
2. Each person does a one-time USDC approval, granting the contract permission to move up to a chosen amount from their wallet (e.g., 1,000 USDC).
3. Either person can record a shared expense at any time. The contract updates a single net balance. No money moves yet.
4. Expenses can be edited or deleted. The contract recomputes the balance accordingly. A full audit trail is preserved on-chain.
5. When the debtor wants to settle up, they call `settle()`. The contract pulls the owed amount from the debtor's wallet to the creditor's wallet in a single transaction, and resets the balance to zero.

The contract never holds funds. USDC moves directly from one wallet to another at the time of settlement.

---

## Roadmap

Directional, not committed. M1 is the current focus; everything beyond it is exploratory and may change, be reordered, or dropped entirely.


| Milestone | Theme                                                            | Status      |
| --------- | ---------------------------------------------------------------- | ----------- |
| **M1**    | Two-party non-custodial IOU contract                             | In design   |
| **M2**    | Onboarding — embedded smart-account auth, gasless UX             | Exploratory |
| **M3**    | Multi-party groups and debt graph simplification                 | Exploratory |
| **M4**    | Off-chain integration — bank-feed ingestion, auto-classification | Speculative |


See `[docs/design.md](docs/design.md)` for the reasoning behind the milestone ordering.

---

## About

Mend is a side project by [Ariel Diaz](https://github.com/aliersh), formerly Smart Contract Engineer at OP Labs (Optimism), an exploration of on-chain primitives for everyday financial coordination.

## License

MIT
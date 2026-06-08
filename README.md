# Ponti

> Settle up, on-chain.

[![CI](https://img.shields.io/github/actions/workflow/status/aliersh/ponti/test.yml?branch=main&label=CI)](https://github.com/aliersh/ponti/actions/workflows/test.yml)
[![Solidity](https://img.shields.io/badge/solidity-0.8.34-363636)](contracts/foundry.toml)
[![Built with Foundry](https://img.shields.io/badge/built%20with-Foundry-black)](https://getfoundry.sh)
[![Network](https://img.shields.io/badge/network-Base%20Sepolia-0052FF)](https://sepolia.basescan.org)
[![PontiFactory](https://img.shields.io/badge/PontiFactory-0x1746…Cb210-0052FF)](https://sepolia.basescan.org/address/0x17463e06C303e30044609a9a412d7DB4746Cb210)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

<!--
  Badges to add later, when the supporting infrastructure exists:
  - Test coverage, once `forge coverage` is wired into CI (e.g., Codecov)
  - Audit / formal verification badge, if and when an audit is completed
  - Gas snapshot, once a reproducible gas baseline is tracked
-->

Ponti is a non-custodial primitive for shared expenses. Members deploy a group, record expenses against it, and settle the running balance in USDC directly between their wallets: atomically, on-chain, with no third party in the middle.

Existing trackers like Splitwise get the tracking right, and many now link a payment app (Venmo, Zelle) to settle. But the ledger and the money stay two systems: "settled" means someone tapped a button after paying elsewhere, not that the payment and the record are the same event. Ponti keeps balances and settlement in the same place, so the payment is the proof.

**Status:** M1 (the contract) is deployed to Base Sepolia, `PontiFactory` at [`0x1746…Cb210`](https://sepolia.basescan.org/address/0x17463e06C303e30044609a9a412d7DB4746Cb210). M2 (onboarding) is in progress; see the [roadmap](#roadmap).

---

## How it works

1. Two people deploy a Ponti group together: one smart contract, one address, just for them.
2. Either person can record a shared expense at any time. The contract updates a single net balance. No money moves yet.
3. Expenses can be edited or deleted. The contract recomputes the balance accordingly. A full audit trail is preserved on-chain.
4. When the debtor wants to settle up, they call `settle()`. A single transaction approves exactly the amount owed and moves it from the debtor's wallet to the creditor's wallet, then resets the balance to zero — no standing allowance, and the contract never holds funds.

## Getting started

Ponti is built with [Foundry](https://getfoundry.sh).

```bash
git clone https://github.com/aliersh/ponti.git
cd ponti/contracts
forge install   # fetches the forge-std and openzeppelin-contracts submodules
forge build
forge test
```

Most of the suite (unit, fuzz, and invariant tests) runs with no configuration. The fork tests run against Base Sepolia and read the `BASE_SEPOLIA_RPC_URL` environment variable; set it in a `contracts/.env` file to run them.

## Documentation

- [`docs/design.md`](docs/design.md): the design and the reasoning behind it
- [`docs/contract-spec.md`](docs/contract-spec.md): the contract's function-by-function specification
- [`docs/app-spec.md`](docs/app-spec.md): the web app specification (flows and integration)
- [`docs/subgraph-spec.md`](docs/subgraph-spec.md): the indexer (The Graph subgraph) specification

## Security

Ponti is deployed to testnet (Base Sepolia) only and has not been audited. **Do not use it with real funds.** The contract is non-custodial by design: it never holds funds, and settlement moves USDC directly between members' wallets. That property has not been independently reviewed.

## Roadmap

Directional, not committed. Everything beyond M1 is exploratory and may change, be reordered, or be dropped.

| Milestone | Theme                                                              | Status                  |
| --------- | ------------------------------------------------------------------ | ----------------------- |
| **M1**    | Two-party non-custodial IOU contract                               | Deployed (Base Sepolia) |
| **M2**    | Onboarding: embedded smart-account auth, gasless UX, on Base Sepolia | In progress           |
| **M3**    | Multi-party groups and debt-graph simplification                   | Exploratory             |
| **M4**    | Off-chain integration: bank-feed ingestion, auto-classification    | Speculative             |

See [`docs/design.md`](docs/design.md) for the reasoning behind the milestone ordering.

## About

Built by [Ariel Diaz](https://github.com/aliersh).

## License

MIT

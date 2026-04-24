# Mend

> Settle up, on-chain.

[![CI](https://img.shields.io/github/actions/workflow/status/aliersh/mend/test.yml?branch=main&label=CI)](https://github.com/aliersh/mend/actions/workflows/test.yml)
[![Solidity](https://img.shields.io/badge/solidity-0.8.34-363636)](foundry.toml)
[![Built with Foundry](https://img.shields.io/badge/built%20with-Foundry-black)](https://getfoundry.sh)
[![Network](https://img.shields.io/badge/network-Optimism%20Sepolia-FF0420)](https://sepolia-optimism.etherscan.io)
[![MendFactory](https://img.shields.io/badge/MendFactory-0x7c6c…091da-FF0420)](https://testnet-explorer.optimism.io/address/0x7c6c933b036fce0d6663ab4f3866acdc2a5091da)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

<!--
  Badges to add later, when the supporting infrastructure exists:
  - Test coverage — once `forge coverage` is wired into CI (e.g., Codecov)
  - Audit / formal verification badge — if and when an audit is completed
  - Gas snapshot — once a reproducible gas baseline is tracked
-->

Mend is a non-custodial primitive for shared expenses. Members deploy a group, record expenses against it, and settle the running balance in USDC directly between their wallets — atomically, on-chain, with no third party in the middle.

**Status:** M1 deployed to Optimism Sepolia. `MendFactory` at [`0x7c6c933b036fce0d6663ab4f3866acdc2a5091da`](https://testnet-explorer.optimism.io/address/0x7c6c933b036fce0d6663ab4f3866acdc2a5091da). See [`docs/specs.md`](docs/specs.md) for the full specification and [`docs/design.md`](docs/design.md) for design rationale.

---

## Why Mend exists

Splitting expenses with people you trust shouldn't be hard. But it is. Existing tools, like Splitwise, get the tracking part right. The moment of settlement is where they fall short. The ledger lives in one app and the money lives in another, with nothing connecting them. What fills the gap is friction: being methodical about logging every expense, depending on others to do the same, and chasing settlements that may or may not happen. At the end, "I sent you the Venmo" is the only proof that exists, and it depends entirely on trust.

Mend closes that gap. Balances and settlement live in the same place, on-chain, and "did you actually pay" stops being a question of trust. The technology is incidental. If a different stack could deliver less friction tomorrow, that would be the right tool. Today, smart contracts on a low-cost L2 are what make this possible: cheap enough to use casually, secure enough to handle real money, and finally mature enough that the ecosystem is no longer hostile to non-technical users.

Mend is built with the conviction that digital products that touch money, and digital products in general, deserve to be made with care. Care in the engineering: formal specs, invariant-tested contracts, a design that earns trust by construction rather than asking for it. Care in the product: language designed for humans rather than the crypto subculture, flows that hide complexity instead of celebrating it, visual quality that signals seriousness. This is a problem worth solving well.

The goal is for Mend to be used. Not as a proof of concept, not as a portfolio piece, but as a real tool that real people use to settle expenses with the people in their life. M1 is the foundation: a minimal, audited primitive deployed to Optimism Sepolia. The first step toward a product that hides its plumbing and focuses on the experience of getting things settled. Whether Mend grows beyond that is to be discovered, but the foundation is being built as if it will.

## How it works

1. Two people deploy a Mend group together — one smart contract, one address, just for them.
2. Each person does a one-time USDC approval, granting the contract permission to move up to a chosen amount from their wallet (e.g., 1,000 USDC).
3. Either person can record a shared expense at any time. The contract updates a single net balance. No money moves yet.
4. Expenses can be edited or deleted. The contract recomputes the balance accordingly. A full audit trail is preserved on-chain.
5. When the debtor wants to settle up, they call `settle()`. The contract pulls the owed amount from the debtor's wallet to the creditor's wallet in a single transaction, and resets the balance to zero.

---

## Roadmap

Directional, not committed. M1 is the current focus; everything beyond it is exploratory and may change, be reordered, or dropped entirely.


| Milestone | Theme                                                            | Status      |
| --------- | ---------------------------------------------------------------- | ----------- |
| **M1**    | Two-party non-custodial IOU contract                             | Deployed to Optimism Sepolia            |
| **M2**    | Onboarding — embedded smart-account auth, gasless UX             | Exploratory |
| **M3**    | Multi-party groups and debt graph simplification                 | Exploratory |
| **M4**    | Off-chain integration — bank-feed ingestion, auto-classification | Speculative |


See [docs/design.md](docs/design.md) for the reasoning behind the milestone ordering.

---

## About

Built by [Ariel Diaz](https://github.com/aliersh), formerly Smart Contract Engineer at OP Labs (Optimism).

## License

MIT
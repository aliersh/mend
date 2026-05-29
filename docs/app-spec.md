# Mend — Application Spec

**Status:** In development. Covers onboarding, group creation, expense entry, and reads. This document grows as more of the app is built.
**Companions:** [`design.md`](design.md) (the *why*), [`contract-spec.md`](contract-spec.md) (the contract interface).

---

## Scope

What the app does:

- **Onboarding.** Email/social login (Privy) that provisions a Kernel smart account.
- **Create a group** with a counterparty — gasless `createGroup`.
- **Add an expense** to a group — gasless `addExpense`.
- **List groups** and **view a group's balance + expense history** — reads.

Not yet built (added here as they land):

- Editing and deleting expenses.
- Settlement, including the USDC approval (surfaced as "budget") and the funding flow.
- Group naming, friendlier counterparty discovery (ENS / contacts / QR), visual polish, and automated frontend tests.

## Stack and layout

- Frontend lives in `app/` within the mend monorepo: Vite + React SPA.
- Auth + embedded wallet: **Privy**. Smart account: **Kernel** (ZeroDev), via Privy. Bundler + paymaster: **Pimlico**. Contract reads/writes: **wagmi + viem**.
- Target chain: **Base Sepolia** (chain id 84532). Factory: `0x7C6c933B036fCe0d6663ab4F3866ACdC2A5091Da`. USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Config via Vite env vars (`VITE_`-prefixed, client-side). No backend, no server secrets.

## Flows

Writes go through the account-abstraction stack (UserOperation → Pimlico paymaster sponsors gas → Pimlico bundler → EntryPoint → user's Kernel smart account → contract). Reads are direct viem calls and event-log queries — they do not touch the AA stack.

### 1. Onboarding / login

The user logs in with email or social (Privy), which provisions a Kernel smart account. That smart account's address is the user's identity in Mend (it is what gets registered as a group member). The account is counterfactual until its first write, which deploys it — sponsored, so onboarding costs the user nothing.

### 2. Groups list (home)

Read-only. Query the factory's `GroupCreated(group, memberA, memberB)` logs where `memberA` or `memberB` equals the user's smart-account address, and render the list (group + counterparty). The empty state offers the create-group action.

### 3. Create group

- Input: the counterparty's address (manual entry for now; friendlier discovery is deferred).
- Write (gasless): `factory.createGroup(counterparty)`. This is the user's first UserOperation, so it also deploys their smart account.
- Validate client-side before sending — non-zero address, not the user's own address — to avoid a (sponsored) revert (`InvalidMemberAddress`, `CannotGroupWithSelf`).
- On success, navigate to the new group.

### 4. Group detail

Read-only. Show the current `balance` (direct call) and the expense history (reconstructed from `ExpenseAdded` / `ExpenseEdited` / `ExpenseDeleted` events for that group). The signed `int256` balance is interpreted for display: positive → the counterparty owes the user; negative → the user owes; zero → settled. Show direction + absolute amount in USDC.

### 5. Add expense

- Input: payer (the user or the counterparty), amount (USDC), description.
- Write (gasless): `group.addExpense(payer, amount, description)`.
- Validate client-side: amount > 0, description non-empty, payer is a member.
- On success, refresh the balance and expense list.

## Reads and state

No backend. Lists come from event logs (viem `getLogs`); current balance from a direct call. After a write confirms, refetch the affected reads. The app holds the authenticated session and the selected group in client state only.

## Config and secrets

- `VITE_PRIVY_APP_ID` — public Privy app id (safe client-side by design).
- Pimlico bundler/paymaster URL with a restricted key (domain / chain / contract allowlist), per `design.md`. Client-side is acceptable on testnet.
- No private keys and no server secrets in the frontend.

## Verification

- **Manual end-to-end checklist** on Base Sepolia: fresh email login → smart account provisioned → `createGroup` (confirm on Basescan that the transaction is sponsored and the user paid no gas) → `addExpense` (gasless) → balance reflects it → logging in as the counterparty shows the same group. The first sponsored write is also what confirms the paymaster works for a Kernel account on this chain.
- Automated frontend tests are not yet in scope.

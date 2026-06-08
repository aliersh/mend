# Ponti — app

Vite + React single-page app for Ponti. Login via Privy (email/social) provisions
a Kernel smart account; writes go out as Pimlico-sponsored UserOperations, so the
user pays no gas. Target chain: Base Sepolia (84532).

## Setup

### 1. Dashboards (one-time)

**Pimlico** (dashboard.pimlico.io)

1. Create an API key with **Bundler** methods and **Verifying Paymaster** enabled.
   The v2 endpoint is `https://api.pimlico.io/v2/84532/rpc?apikey=<KEY>` (same URL
   serves bundler and paymaster).
2. Create a **sponsorship policy** scoped to Base Sepolia. Do **not** add a
   sender allowlist — the smart account is counterfactual and its first
   transaction is its own deployment. Note the policy id (`sp_...`).
3. Allow the dev origin `http://localhost:5173`.

**Privy** (dashboard.privy.io)

1. Create an app; copy the **App ID**.
2. Enable **Email** login.
3. Enable **smart wallets** and select **Kernel**.
4. Add network **Base Sepolia (84532)**; paste the Pimlico v2 URL into both the
   **Bundler URL** and **Paymaster URL** fields. Ensure Privy's Kernel/EntryPoint
   version matches the Pimlico endpoint.
5. Add allowed origin `http://localhost:5173`.

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

```
VITE_PRIVY_APP_ID=<Privy app id>
VITE_PIMLICO_SPONSORSHIP_POLICY_ID=<sp_... or leave empty>
```

The Pimlico API key is **not** here — it lives in the Privy dashboard.

### 3. Run

```
pnpm install
pnpm dev      # http://localhost:5173
```

## Verifying gasless createGroup

1. Log in with email. The UI shows your smart-account address. **Do not send it
   any ETH.**
2. Paste a counterparty address (any valid address other than your own), then
   **Create group**.
3. The UI shows a Basescan link as soon as the transaction is submitted (and the
   new group address once the receipt is read). On the transaction:
   - status **Success**, with a `GroupCreated` event naming your smart account;
   - your smart account still holds **0 ETH** — it paid nothing;
   - the **paymaster** is Pimlico's paymaster. The top-level `from` is the
     bundler's EOA, not your smart account — view the smart-account address page
     (its UserOperations) to see the op and its paymaster.

An unfunded account cannot pay gas, so a confirmed `createGroup` is itself proof
the transaction was sponsored.

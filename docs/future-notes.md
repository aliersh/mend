# Mend — Future Notes

Notes captured during development that apply to future milestones. These are
NOT specs — they are reminders, ideas, and constraints to revisit when
planning M2/M3/M4. Do not treat as decisions until promoted to the relevant
milestone's design doc.

Notes here are append-only and casual. Keep each note short (2–5 lines).
If a note needs more explanation, it probably belongs in the design doc of
the milestone that will implement it.

## M2 (Onboarding)

### Group organization / naming

Users may create multiple groups with the same counterparty for different purposes (e.g., "needs" vs "wants", "shared apartment" vs "trips"). The contract does not store group names or categories — this is UX concern.

Frontend should:
- Allow users to name/label groups client-side.
- Group the list by counterparty or by custom folders.
- Show group creation date and total activity as sort/filter keys.

## M3 (Multi-party groups)

### Group membership mutability

M1 uses `immutable` memberA/memberB — a group is a fixed pair of wallets. When planning M3, decide:

- Adding a new member to an existing group → requires mutable membership, which changes the security model.
- OR: closing the old group and opening a new one with N+1 members → keeps immutability but loses the old group's balance history link.

Recommendation default: stick with immutability per contract, deploy new contract when membership changes. Revisit if UX demand warrants otherwise.

## M4 (Off-chain integration)

(empty for now)

## Deployment

### Revisit deployment target

The contract is on Base Sepolia (migrated from Optimism Sepolia for M2). When
the system is mature and validated, evaluate deployment to Base mainnet —
which also positions Mend for Coinbase's onramp delivering USDC directly to
a Base address (see `docs/design.md`). Other L2s and cross-chain support are
speculative and depend on demand and use cases that emerge.

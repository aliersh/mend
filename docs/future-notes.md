# Mend — Future Notes

Notes captured during development that apply to future milestones. These are
NOT specs — they are reminders, ideas, and constraints to revisit when
planning M2/M3/M4. Do not treat as decisions until promoted to the relevant
milestone's design doc.

Notes here are append-only and casual. Keep each note short (2–5 lines).
If a note needs more explanation, it probably belongs in the design doc of
the milestone that will implement it.

## M2 (Onboarding)

### UX vocabulary

Surface ERC-20 allowance to users as **"budget"** — e.g., "Your Mend budget:
$1,000". Tooltip: "This is the maximum amount Mend can pull from your wallet
when you settle. You can increase it anytime."

Avoid the words "approval", "allowance", "transferFrom", "spender", or any
ERC-20 jargon in user-facing copy. Internal code and tests still use the
technical terms (they come from the standard and cannot be renamed).

### Allowance UX requirements

The frontend MUST check the current allowance (via USDC's `allowance()` view
function) before offering the Settle button. Failure modes to handle:

- Allowance insufficient for the current balance → show a banner
  "Re-approve USDC before settling" with a button that triggers the approval
  flow first.
- Allowance below 20% of the original approved amount → soft warning
  "Your budget is running low."

Do NOT let the user click Settle and watch the transaction revert. Gas is
wasted even on reverting transactions.

## M3 (Multi-party groups)

(empty for now)

## M4 (Off-chain integration)

(empty for now)

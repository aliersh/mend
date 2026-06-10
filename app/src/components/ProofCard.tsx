// Temporary dev surface — verifies the token system (colors, fonts, radius, shadow,
// accent, figures) in light and dark. Reachable at /_proof; the theme follows the OS.
// Throwaway; remove once the token system is confirmed.

export function ProofCard() {
  return (
    <div className="min-h-screen bg-bg text-ink p-18">
      {/* Card: proves surface + border + shadow + rounded */}
      <div className="bg-surface border border-border rounded shadow-card p-18 max-w-sm">

        {/* Eyebrow: proves font-ui + text-muted */}
        <p className="font-ui text-muted text-xs uppercase tracking-widest mb-3">
          Token proof
        </p>

        {/* Big display amount: proves font-display + pnum. Amount is text-ink, NOT accent. */}
        <div className="font-display text-ink pnum text-4xl font-semibold mb-18">
          28.00{' '}
          <span className="text-muted text-xl tracking-wide">USDC</span>
        </div>

        {/* List amounts: proves font-ui + tnum (tabular, decimal-aligned) */}
        <div className="font-ui text-ink tnum text-sm flex flex-col gap-2 mb-18">
          <div className="flex justify-between">
            <span className="text-muted">Dinner split</span>
            <span>12.50</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Coffee</span>
            <span>−4.00</span>
          </div>
        </div>

        {/* Accent affordances: proves accent + accent-ink + accent-soft. Color is for
            actions/edges only — no numbers are ever colored with accent. */}
        <div className="flex gap-3 items-center">
          <button className="bg-accent text-accent-ink rounded px-3 py-2 font-ui text-sm font-medium">
            Settle up
          </button>
          <span className="bg-accent-soft text-accent rounded-sm px-2 py-1 font-ui text-xs font-medium">
            Pending
          </span>
        </div>
      </div>
    </div>
  )
}

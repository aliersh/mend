// brand.tsx — Ponti brand primitives
//
// Wordmark: "ponti" in Schibsted Grotesk bold, tight tracking.
// Mark:     two-circle "bridge" SVG — horizontal bar in accent,
//           left circle in ink, right circle in accent.
//           Uses var(--…) SVG attrs directly (two distinct tokens in one mark).

// ── Wordmark ───────────────────────────────────────────────────────────────────
interface WordmarkProps {
  size?: number
  color?: string
}

export function Wordmark({ size = 22, color = 'var(--ink)' }: WordmarkProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '-0.03em', /* prototype components.jsx */
        color,
        lineHeight: 1,
      }}
    >
      ponti
    </span>
  )
}

// ── Mark ───────────────────────────────────────────────────────────────────────
// Dimensions: width = s, height = s * 0.46 (aspect from viewBox 100 × 46).
// Colors: line + right circle = var(--accent); left circle = var(--ink).
// Do NOT use currentColor — two distinct tokens coexist in one element.

interface MarkProps {
  s?: number
}

export function Mark({ s = 28 }: MarkProps) {
  return (
    <svg
      width={s}
      height={s * 0.46}
      viewBox="0 0 100 46"
      fill="none"
      style={{ display: 'block' }}
    >
      <line
        x1="14"
        y1="23"
        x2="86"
        y2="23"
        stroke="var(--accent)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="14" cy="23" r="11" fill="var(--ink)" />
      <circle cx="86" cy="23" r="11" fill="var(--accent)" />
    </svg>
  )
}

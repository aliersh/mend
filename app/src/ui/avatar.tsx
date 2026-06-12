// avatar.tsx — Initial avatar primitive
//
// Circular avatar driven by either a single initial character or a person icon.
// When `initial` is a non-empty string, renders the letter centered.
// When `initial` is empty (no nickname), renders a neutral person silhouette
// using `currentColor` so the glyph inherits the circle's tone color.
// Tone controls background/text color pair:
//   accent  → bg-accent-soft / text-accent  (default)
//   neutral → bg-surface-2   / text-muted
// Size is a number (px); drives width, height, fontSize, and icon size inline.

interface AvatarProps {
  initial: string
  tone?: 'accent' | 'neutral'
  size?: number
}

function PersonIcon({ size }: { size: number }) {
  const px = Math.round(size * 0.5)
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

export function Avatar({ initial, tone = 'accent', size = 44 }: AvatarProps) {
  const isAccent = tone === 'accent'
  return (
    <div
      className={[
        'inline-flex items-center justify-center rounded-full shrink-0 font-ui font-bold',
        isAccent ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
      ].join(' ')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4, /* size-proportional; prototype components.jsx */
      }}
    >
      {initial ? initial : <PersonIcon size={size} />}
    </div>
  )
}

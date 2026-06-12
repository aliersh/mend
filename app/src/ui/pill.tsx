// pill.tsx — Status/label pill primitive
//
// Tones:
//   neutral → bg-surface-2 / text-muted  (default)
//   accent  → bg-accent-soft / text-accent
//   ok      → same as neutral (settled-up state)

import type { ReactNode } from 'react'

interface PillProps {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'ok'
}

const toneClasses: Record<NonNullable<PillProps['tone']>, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent:  'bg-accent-soft text-accent',
  ok:      'bg-surface-2 text-muted',
}

export function Pill({ children, tone = 'neutral' }: PillProps) {
  return (
    <span
      className={[
        'inline-flex items-center font-ui font-semibold rounded-pill',
        'text-xs',     /* 12px = text-xs */
        'px-[9px] py-[4px]', /* prototype components.jsx */
        'gap-[5px]',   /* 5px gap — prototype components.jsx */
        toneClasses[tone],
      ].join(' ')}
    >
      {children}
    </span>
  )
}

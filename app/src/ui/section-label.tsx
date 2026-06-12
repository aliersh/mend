// section-label.tsx — Uppercase tracked muted section header
//
// Renders a row with the section label on the left and an optional
// right-slot element (e.g. a button or count). Spacing: 0 2px 2px
// matches the prototype's subtle bottom nudge.

import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  right?: ReactNode
}

export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between px-[2px] pb-[2px]"> {/* prototype components.jsx */}
      <span
        className={[
          'font-ui font-bold uppercase text-muted',
          'text-xs',      /* 12px = text-xs */
          'tracking-[.07em]', /* prototype components.jsx */
        ].join(' ')}
      >
        {children}
      </span>
      {right}
    </div>
  )
}

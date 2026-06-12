// EmptyState.tsx — Centered card with icon, title, body, optional CTA.
// Reused for the "no groups yet" empty state and the "network error" state.
// Port of prototype screens.jsx EmptyState.

import type { ReactNode } from 'react'
import { Button } from '../ui'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  body: string
  cta?: string
  onCta?: () => void
  /** 'error' → ghost button variant; default → primary button variant */
  tone?: 'error' | 'default'
}

export function EmptyState({ icon, title, body, cta, onCta, tone = 'default' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center p-[40px_20px] bg-surface border border-border rounded-sm">
      {/* prototype screens.jsx: opacity 0.9 for non-error icons */}
      <div style={{ opacity: tone === 'error' ? 1 : 0.9, marginBottom: 2 }}>{icon}</div>
      <span
        className="font-display font-bold text-ink"
        style={{ fontSize: 19, letterSpacing: '-0.02em' }} /* prototype screens.jsx */
      >
        {title}
      </span>
      <span
        className="font-ui text-muted"
        style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 280 }} /* prototype screens.jsx */
      >
        {body}
      </span>
      {cta && (
        <div style={{ marginTop: 6 }}>
          <Button variant={tone === 'error' ? 'ghost' : 'primary'} onClick={onCta}>
            {cta}
          </Button>
        </div>
      )}
    </div>
  )
}

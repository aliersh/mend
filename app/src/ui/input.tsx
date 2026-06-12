// input.tsx — Input + Field primitives
//
// Input: extends React.InputHTMLAttributes; merges consumer className.
//   Base: font-ui text-ink bg-surface border-border rounded-sm w-full
//   Focus: focus-visible accent ring/border for a11y.
//   Padding: 13px top/bottom, 14px left/right — from prototype components.jsx.
//
// Field: label + optional hint wrapper.
//   Renders a <label> column; label text is font-ui font-semibold text-muted ~13px;
//   hint (if provided) is text-muted ~12px below the child.

import type { InputHTMLAttributes } from 'react'

// ── Input ──────────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // All native input attributes are accepted; className is merged, not replaced.
}

export function Input({ className = '', ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={[
        'font-ui text-base text-ink bg-surface',
        'border border-border rounded-sm w-full outline-none',
        'px-[14px] py-[13px]', /* 13/14px padding — prototype components.jsx */
        // Focus-visible: accent ring + border color change
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}

// ── Field ──────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-[7px]"> {/* 7px gap — prototype components.jsx */}
      <span className="font-ui font-semibold text-muted text-[13px]"> {/* 13px — prototype components.jsx */}
        {label}
      </span>
      {children}
      {hint && (
        <span className="font-ui text-muted text-xs"> {/* 12px = text-xs */}
          {hint}
        </span>
      )}
    </label>
  )
}

// SignIn.tsx — Branded sign-in screen (headless email LOGIN via Privy).
//
// State machine → view:
//   initial | sending-code         → idle   (email entry)
//   awaiting-code-input | submitting-code → code    (OTP entry)
//   error                          → stays on the current view with inline message
//   done                           → nothing (App's auth gate falls through)
//
// Does NOT touch providers.tsx or wallet-headless config (those are F4).

import { useState, useEffect, useRef } from 'react'
import { useLoginWithEmail } from '@privy-io/react-auth'
import { Mark, Wordmark, Input, Button, Shield } from '../ui'

// Simple email sanity check — not RFC-exhaustive, enough to gate the button.
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

const RESEND_COOLDOWN_S = 30

export function SignIn() {
  const { sendCode, loginWithCode, state } = useLoginWithEmail()

  // Local view state: we drive off `state.status` for the primary gate,
  // but keep `view` so "Use a different email" can force-return to idle
  // without fighting Privy's state (which may still be 'awaiting-code-input').
  const [view, setView] = useState<'idle' | 'code'>('idle')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  // Resend cooldown: seconds remaining; 0 = resend enabled.
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rate-limit error from resend (separate from Privy's state.error so it
  // persists across state transitions without touching the main error slot).
  const [resendError, setResendError] = useState(false)

  // Sync view with Privy status on forward transitions (Privy drives forward;
  // backward is local via "Use a different email").
  useEffect(() => {
    if (
      state.status === 'awaiting-code-input' ||
      state.status === 'submitting-code'
    ) {
      setView('code')
    }
  }, [state.status])

  // --- helpers ----------------------------------------------------------------

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_S)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!)
          cooldownRef.current = null
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  async function handleSendCode() {
    if (!looksLikeEmail(email)) return
    setResendError(false)
    try {
      await sendCode({ email: email.trim() })
      startCooldown()
    } catch {
      // sendCode failure stays quiet; state.status will flip to 'error' if Privy
      // surfaces it. We only need to catch unexpected throws here.
    }
  }

  async function handleConfirmCode() {
    if (code.length !== 6) return
    try {
      await loginWithCode({ code })
    } catch {
      // Privy surfaces the error via state.status === 'error'; no separate catch needed.
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !looksLikeEmail(email)) return
    setResendError(false)
    try {
      await sendCode({ email: email.trim() })
      startCooldown()
    } catch (err) {
      // Rate-limit or network error: show calm inline message, keep resend disabled.
      setResendError(true)
    }
  }

  function handleUseDifferentEmail() {
    setView('idle')
    setCode('')
    setResendError(false)
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current)
      cooldownRef.current = null
    }
    setCooldown(0)
  }

  // --- derived flags ---------------------------------------------------------

  const isSending = state.status === 'sending-code'
  const isSubmitting = state.status === 'submitting-code'
  const hasError = state.status === 'error'

  // Error copy: never raw, never alarm-red — interpret into friendly text.
  function friendlyError(forView: 'idle' | 'code'): string | null {
    if (!hasError) return null
    if (forView === 'code') {
      return "That code didn't match — try again or resend."
    }
    return "Something went sideways — check your email address and try again."
  }

  // --- render ----------------------------------------------------------------

  return (
    <div
      className="min-h-screen flex flex-col bg-bg px-[24px]" /* 24px — prototype screens.jsx §8.1 */
    >
      {/* ── Centered content column ── */}
      <div className="flex-1 flex flex-col justify-center gap-[26px]"> {/* 26px gap — prototype screens.jsx §8.1 */}

        {view === 'idle' ? (
          /* ── Screen 1: Email entry ── */
          <>
            {/* Brand block */}
            <div className="flex flex-col gap-[18px]"> {/* 18px gap — prototype screens.jsx §8.1 */}
              <Mark s={44} /> {/* 44px — prototype screens.jsx §8.1 */}
              <Wordmark size={40} /> {/* 40px — prototype screens.jsx §8.1 */}
              <h1
                className="m-0 text-ink"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 27,          /* 27px — prototype screens.jsx §8.1 */
                  fontWeight: 700,
                  lineHeight: 1.12,
                  letterSpacing: '-0.02em',
                  textWrap: 'balance',
                } as React.CSSProperties}
              >
                For people who share expenses, but not the same place.
              </h1>
              <p
                className="m-0 text-muted"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 15,          /* 15px — prototype screens.jsx §8.1 */
                  lineHeight: 1.5,
                }}
              >
                One balance, wherever you live. Settle directly, in USDC.
              </p>
            </div>

            {/* Input + CTA */}
            <div className="flex flex-col gap-[10px]">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSendCode()
                }}
              />
              <Button
                variant="primary"
                full
                disabled={!looksLikeEmail(email) || isSending}
                onClick={() => void handleSendCode()}
              >
                {isSending ? 'Sending…' : 'Continue with email'}
              </Button>
            </div>

            {/* Inline error (idle view) */}
            {hasError && view === 'idle' && (
              <p
                className="m-0 text-muted text-center"
                style={{ fontFamily: 'var(--font-ui)', fontSize: 13 }}
              >
                {friendlyError('idle')}
              </p>
            )}
          </>
        ) : (
          /* ── Screen 2: Code entry ── */
          <>
            {/* Brand block */}
            <div className="flex flex-col gap-[18px]">
              <Mark s={44} />
              <Wordmark size={40} />
              <h1
                className="m-0 text-ink"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 27,          /* 27px — prototype screens.jsx §8.1 */
                  fontWeight: 700,
                  lineHeight: 1.12,
                  letterSpacing: '-0.02em',
                  textWrap: 'balance',
                } as React.CSSProperties}
              >
                Check your email
              </h1>
              <p
                className="m-0 text-muted"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 15,
                  lineHeight: 1.5,
                }}
              >
                We sent a 6-digit code to {email}. Pop it in below.
              </p>
            </div>

            {/* Code input + actions */}
            <div className="flex flex-col gap-[10px]">
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleConfirmCode()
                }}
                // tnum: tabular figures so digits don't jitter; centered + spaced for legibility.
                className="tnum text-center tracking-[0.18em]"
              />

              {/* Inline error — sits directly below the code input; accent for contrast, never red */}
              {hasError && (
                <div className="bg-accent-soft text-accent rounded-sm px-3 py-2 font-ui font-medium text-sm">
                  {friendlyError('code')}
                </div>
              )}

              <Button
                variant="primary"
                full
                disabled={code.length !== 6 || isSubmitting}
                onClick={() => void handleConfirmCode()}
              >
                {isSubmitting ? 'Confirming…' : 'Confirm code'}
              </Button>

              <Button
                variant="quiet"
                onClick={handleUseDifferentEmail}
              >
                Use a different email
              </Button>
            </div>

            {/* Resend row */}
            <div className="flex flex-col items-center gap-[6px]">
              {cooldown > 0 ? (
                <span
                  className="text-muted"
                  style={{ fontFamily: 'var(--font-ui)', fontSize: 13 }}
                >
                  Resend in {cooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  className="text-muted underline-offset-2 hover:text-ink transition-colors"
                  style={{ fontFamily: 'var(--font-ui)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Resend code
                </button>
              )}

              {/* Rate-limit / network calm message — never red */}
              {resendError && (
                <span
                  className="text-muted text-center"
                  style={{ fontFamily: 'var(--font-ui)', fontSize: 12 }}
                >
                  Give it a moment, then try again.
                </span>
              )}
            </div>

          </>
        )}
      </div>

      {/* ── Footer reassurance ── */}
      <div
        className="flex items-center gap-[8px] justify-center text-muted"
        style={{ padding: '20px 0 26px' }} /* 20/26px — prototype screens.jsx §8.1 */
      >
        <span className="inline-flex">
          <Shield color="var(--muted)" size={15} />
        </span>
        <span
          style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5 }} /* 12.5px — prototype screens.jsx §8.1 */
        >
          Ponti never holds your money. It only keeps the count.
        </span>
      </div>
    </div>
  )
}

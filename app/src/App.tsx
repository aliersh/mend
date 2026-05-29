import { useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { submitCreateGroup, fetchGroupAddress } from './lib/createGroup'

// The smart account's address is the user's identity in Mend (the member that
// gets registered). Privy exposes it as a linked account of type smart_wallet.
function useSmartAccountAddress(): Address | undefined {
  const { user } = usePrivy()
  return useMemo(() => {
    const sw = user?.linkedAccounts.find((a) => a.type === 'smart_wallet')
    return sw && 'address' in sw ? (sw.address as Address) : undefined
  }, [user])
}

export function App() {
  const { ready, authenticated, login, logout } = usePrivy()
  const { client } = useSmartWallets()
  const smartAccount = useSmartAccountAddress()

  const [counterparty, setCounterparty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [group, setGroup] = useState<Address | null>(null)
  const [groupNote, setGroupNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Validate client-side so we never spend a (sponsored) UserOp on a sure revert.
  const validationError = useMemo(() => {
    if (!counterparty) return null
    if (!isAddress(counterparty)) return 'Not a valid address.'
    if (smartAccount && getAddress(counterparty) === getAddress(smartAccount)) {
      return 'Cannot create a group with yourself.'
    }
    return null
  }, [counterparty, smartAccount])

  if (!ready) return <main style={page}><p>Loading…</p></main>

  if (!authenticated) {
    return (
      <main style={page}>
        <h1>Mend</h1>
        <button onClick={login}>Log in</button>
      </main>
    )
  }

  const canSubmit = !!client && !!counterparty && !validationError && !submitting

  async function onCreate() {
    if (!client || !isAddress(counterparty)) return
    setSubmitting(true)
    setError(null)
    setTxHash(null)
    setGroup(null)
    setGroupNote(null)
    try {
      // The hash is the proof the sponsored write went out — surface it first.
      const hash = await submitCreateGroup(
        async (req) => (await client.sendTransaction(req)) as Hex,
        counterparty,
      )
      setTxHash(hash)
      // Best-effort: a receipt/parse failure here does not mean the transaction
      // failed (the Basescan link is the proof of that).
      try {
        setGroup(await fetchGroupAddress(hash))
      } catch (e) {
        setGroupNote(e instanceof Error ? e.message : String(e))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={page}>
      <h1>Mend</h1>
      <p>
        Smart account: <code>{smartAccount ?? 'provisioning…'}</code>{' '}
        <button onClick={logout}>Log out</button>
      </p>

      <h2>Create group</h2>
      <input
        placeholder="Counterparty address (0x…)"
        value={counterparty}
        onChange={(e) => setCounterparty(e.target.value.trim())}
        style={{ width: 440, fontFamily: 'monospace' }}
      />
      <div>
        <button onClick={onCreate} disabled={!canSubmit}>
          {submitting ? 'Sending (sponsored)…' : 'Create group'}
        </button>
      </div>
      {validationError && <p style={{ color: 'crimson' }}>{validationError}</p>}

      {txHash && (
        <div>
          <p>
            Transaction submitted (sponsored):{' '}
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              view on Basescan
            </a>
          </p>
          {group && (
            <p>
              Group created: <code>{group}</code>
            </p>
          )}
          {groupNote && (
            <p style={{ color: 'darkorange' }}>
              Submitted, but could not read the group address yet: {groupNote}
            </p>
          )}
        </div>
      )}
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
    </main>
  )
}

const page: React.CSSProperties = {
  maxWidth: 640,
  margin: '2rem auto',
  padding: '0 1rem',
  fontFamily: 'system-ui, sans-serif',
}

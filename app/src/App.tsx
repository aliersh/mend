import { useEffect, useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { formatUnits, getAddress, isAddress, type Address, type Hex } from 'viem'
import { submitCreateGroup, fetchGroupAddress } from './lib/createGroup'
import { fetchMyGroups, type GroupItem } from './lib/fetchGroups'
import {
  fetchBalance,
  fetchExpenseHistory,
  reconstructExpenses,
  interpretBalance,
  type ExpenseEntry,
  type BalanceDisplay,
} from './lib/fetchGroup'

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

  // ── home state ──────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null)

  // ── create-group state (unchanged from Phase 1) ──────────────────────────────
  const [counterparty, setCounterparty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [createdGroup, setCreatedGroup] = useState<Address | null>(null)
  const [groupNote, setGroupNote] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── detail state ─────────────────────────────────────────────────────────────
  const [balance, setBalance] = useState<bigint | null>(null)
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const validationError = useMemo(() => {
    if (!counterparty) return null
    if (!isAddress(counterparty)) return 'Not a valid address.'
    if (smartAccount && getAddress(counterparty) === getAddress(smartAccount)) {
      return 'Cannot create a group with yourself.'
    }
    return null
  }, [counterparty, smartAccount])

  // Load groups whenever the smart account becomes available.
  useEffect(() => {
    if (!smartAccount) return
    loadGroups(smartAccount)
  }, [smartAccount])

  // Load balance + expense history when a group is selected.
  useEffect(() => {
    if (!selectedGroup || !smartAccount) return
    setBalance(null)
    setExpenses([])
    setDetailError(null)
    setLoadingDetail(true)
    Promise.all([
      fetchBalance(selectedGroup.address),
      fetchExpenseHistory(selectedGroup.address, selectedGroup.createdBlock),
    ])
      .then(([bal, logs]) => {
        setBalance(bal)
        setExpenses(reconstructExpenses(logs))
      })
      .catch((e) => setDetailError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingDetail(false))
  }, [selectedGroup, smartAccount])

  async function loadGroups(account: Address) {
    setLoadingGroups(true)
    try {
      setGroups(await fetchMyGroups(account))
    } finally {
      setLoadingGroups(false)
    }
  }

  if (!ready) return <main style={page}><p>Loading…</p></main>

  if (!authenticated) {
    return (
      <main style={page}>
        <h1>Mend</h1>
        <button onClick={login}>Log in</button>
      </main>
    )
  }

  // ── detail view ───────────────────────────────────────────────────────────────
  if (selectedGroup && smartAccount) {
    const display: BalanceDisplay | null =
      balance !== null
        ? interpretBalance(balance, smartAccount, selectedGroup.memberA)
        : null

    return (
      <main style={page}>
        <button onClick={() => setSelectedGroup(null)}>← Back</button>
        <h1>Mend</h1>
        <h2>Group with <code style={{ fontSize: '0.85em' }}>{selectedGroup.counterparty}</code></h2>
        <p style={{ color: 'grey', fontSize: '0.8em' }}>
          Contract: <code>{selectedGroup.address}</code>
        </p>

        <h3>Balance</h3>
        {loadingDetail && <p>Loading…</p>}
        {detailError && <p style={{ color: 'crimson' }}>Error: {detailError}</p>}
        {display && (
          <p>
            {display.direction === 'settled' && 'Settled'}
            {display.direction === 'counterparty_owes_me' && (
              <>Counterparty owes you <strong>{display.amount} USDC</strong></>
            )}
            {display.direction === 'i_owe_counterparty' && (
              <>You owe counterparty <strong>{display.amount} USDC</strong></>
            )}
          </p>
        )}

        <h3>Expenses</h3>
        {expenses.length === 0 && !loadingDetail && <p style={{ color: 'grey' }}>No expenses yet.</p>}
        {expenses.filter((e) => !e.deleted).map((e) => (
          <div key={String(e.id)} style={expenseRow}>
            <span><strong>{e.description}</strong></span>
            <span>{formatUnits(e.amount, 6)} USDC — paid by <code style={{ fontSize: '0.85em' }}>{e.payer}</code></span>
          </div>
        ))}
      </main>
    )
  }

  // ── home view ─────────────────────────────────────────────────────────────────
  const canSubmit = !!client && !!counterparty && !validationError && !submitting

  async function onCreate() {
    if (!client || !isAddress(counterparty) || !smartAccount) return
    setSubmitting(true)
    setCreateError(null)
    setTxHash(null)
    setCreatedGroup(null)
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
        setCreatedGroup(await fetchGroupAddress(hash))
        await loadGroups(smartAccount)
      } catch (e) {
        setGroupNote(e instanceof Error ? e.message : String(e))
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
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

      <h2>Your groups</h2>
      {loadingGroups && <p>Loading…</p>}
      {!loadingGroups && groups.length === 0 && (
        <p style={{ color: 'grey' }}>No groups yet. Create one below.</p>
      )}
      {groups.map((g) => (
        <div
          key={g.address}
          style={groupRow}
          onClick={() => setSelectedGroup(g)}
        >
          <code style={{ fontSize: '0.85em' }}>{g.address}</code>
          <span style={{ color: 'grey', fontSize: '0.85em' }}>
            with <code>{g.counterparty}</code>
          </span>
        </div>
      ))}

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
          {createdGroup && (
            <p>
              Group created: <code>{createdGroup}</code>
            </p>
          )}
          {groupNote && (
            <p style={{ color: 'darkorange' }}>
              Submitted, but could not read the group address yet: {groupNote}
            </p>
          )}
        </div>
      )}
      {createError && <p style={{ color: 'crimson' }}>Error: {createError}</p>}
    </main>
  )
}

const page: React.CSSProperties = {
  maxWidth: 640,
  margin: '2rem auto',
  padding: '0 1rem',
  fontFamily: 'system-ui, sans-serif',
}

const groupRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '0.5rem',
  marginBottom: '0.5rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  cursor: 'pointer',
}

const expenseRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '0.5rem',
  marginBottom: '0.5rem',
  border: '1px solid #eee',
  borderRadius: 4,
}

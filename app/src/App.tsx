import { useEffect, useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { formatUnits, getAddress, isAddress, parseUnits, type Address, type Hex } from 'viem'
import { USDC_ADDRESS } from './config'
import { publicClient } from './lib/client'
import { submitCreateGroup, fetchGroupAddress } from './lib/createGroup'
import { submitAddExpense } from './lib/addExpense'
import { submitEditExpense } from './lib/editExpense'
import { submitDeleteExpense } from './lib/deleteExpense'
import { submitApprove, submitSettle, fetchUsdcBalance } from './lib/settle'
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

  // ── settle state ─────────────────────────────────────────────────────────────
  const [usdcBalance, setUsdcBalance]       = useState<bigint | null>(null)
  const [settleSubmitting, setSettleSubmitting] = useState(false)
  const [settleError, setSettleError]       = useState<string | null>(null)

  // ── add-expense state ─────────────────────────────────────────────────────────
  const [addPayer, setAddPayer]             = useState<'me' | 'counterparty'>('me')
  const [addAmount, setAddAmount]           = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addSubmitting, setAddSubmitting]   = useState(false)
  const [addError, setAddError]             = useState<string | null>(null)

  // ── edit-expense state ────────────────────────────────────────────────────────
  const [editingId,       setEditingId]       = useState<bigint | null>(null)
  const [editPayer,       setEditPayer]       = useState<'me' | 'counterparty'>('me')
  const [editAmount,      setEditAmount]      = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSubmitting,  setEditSubmitting]  = useState(false)
  const [editError,       setEditError]       = useState<string | null>(null)

  // ── delete-expense state ──────────────────────────────────────────────────────
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError,      setDeleteError]      = useState<string | null>(null)

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

  async function loadDetail(group: GroupItem, opts?: { silent?: boolean }) {
    if (!opts?.silent) {
      setBalance(null)
      setExpenses([])
      setDetailError(null)
      setUsdcBalance(null)
      setSettleError(null)
      setLoadingDetail(true)
    }
    try {
      const [bal, logs, usdc] = await Promise.all([
        fetchBalance(group.address),
        fetchExpenseHistory(group.address, group.createdBlock),
        smartAccount ? fetchUsdcBalance(smartAccount) : Promise.resolve(null),
      ])
      setBalance(bal)
      setExpenses(reconstructExpenses(logs))
      setUsdcBalance(usdc)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e))
    } finally {
      if (!opts?.silent) setLoadingDetail(false)
    }
  }

  // Load balance + expense history when a group is selected.
  useEffect(() => {
    if (!selectedGroup || !smartAccount) return
    loadDetail(selectedGroup)
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

    async function onSettle() {
      if (!client || !smartAccount || !selectedGroup || balance === null) return
      const debt = balance < 0n ? -balance : balance
      setSettleSubmitting(true)
      setSettleError(null)
      try {
        const approveHash = await submitApprove(
          async (req) => (await client.sendTransaction(req)) as Hex,
          USDC_ADDRESS,
          selectedGroup.address,
          debt,
        )
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
        const settleHash = await submitSettle(
          async (req) => (await client.sendTransaction(req)) as Hex,
          selectedGroup.address,
        )
        await publicClient.waitForTransactionReceipt({ hash: settleHash })
        await loadDetail(selectedGroup, { silent: true })
      } catch (e) {
        setSettleError(e instanceof Error ? e.message : String(e))
      } finally {
        setSettleSubmitting(false)
      }
    }

    async function onAddExpense() {
      if (!client || !smartAccount || !selectedGroup) return
      let parsedAmount: bigint
      try {
        parsedAmount = parseUnits(addAmount, 6)
      } catch {
        setAddError('Invalid amount.')
        return
      }
      if (parsedAmount <= 0n) {
        setAddError('Amount must be greater than 0.')
        return
      }
      if (!addDescription.trim()) {
        setAddError('Description is required.')
        return
      }
      const payer = addPayer === 'me' ? smartAccount : selectedGroup.counterparty
      setAddSubmitting(true)
      setAddError(null)
      try {
        const hash = await submitAddExpense(
          async (req) => (await client.sendTransaction(req)) as Hex,
          selectedGroup.address,
          payer,
          parsedAmount,
          addDescription.trim(),
        )
        await publicClient.waitForTransactionReceipt({ hash })
        await loadDetail(selectedGroup, { silent: true })
        setAddAmount('')
        setAddDescription('')
      } catch (e) {
        setAddError(e instanceof Error ? e.message : String(e))
      } finally {
        setAddSubmitting(false)
      }
    }

    function onStartEdit(expense: ExpenseEntry) {
      setEditingId(expense.id)
      setEditPayer(smartAccount && getAddress(expense.payer) === getAddress(smartAccount) ? 'me' : 'counterparty')
      setEditAmount(formatUnits(expense.amount, 6))
      setEditDescription(expense.description)
      setEditError(null)
    }

    function onCancelEdit() {
      setEditingId(null)
      setEditError(null)
    }

    async function onSaveEdit() {
      if (!client || !smartAccount || !selectedGroup || editingId === null) return
      let parsedAmount: bigint
      try {
        parsedAmount = parseUnits(editAmount, 6)
      } catch {
        setEditError('Invalid amount.')
        return
      }
      if (parsedAmount <= 0n) {
        setEditError('Amount must be greater than 0.')
        return
      }
      if (!editDescription.trim()) {
        setEditError('Description is required.')
        return
      }
      const payer = editPayer === 'me' ? smartAccount : selectedGroup.counterparty
      setEditSubmitting(true)
      setEditError(null)
      try {
        const hash = await submitEditExpense(
          async (req) => (await client.sendTransaction(req)) as Hex,
          selectedGroup.address,
          editingId,
          payer,
          parsedAmount,
          editDescription.trim(),
        )
        await publicClient.waitForTransactionReceipt({ hash })
        await loadDetail(selectedGroup, { silent: true })
        setEditingId(null)
      } catch (e) {
        setEditError(e instanceof Error ? e.message : String(e))
      } finally {
        setEditSubmitting(false)
      }
    }

    async function onDeleteExpense(expenseId: bigint) {
      if (!client || !smartAccount || !selectedGroup) return
      if (!window.confirm('Delete this expense?')) return
      setDeleteSubmitting(true)
      setDeleteError(null)
      try {
        const hash = await submitDeleteExpense(
          async (req) => (await client.sendTransaction(req)) as Hex,
          selectedGroup.address,
          expenseId,
        )
        await publicClient.waitForTransactionReceipt({ hash })
        await loadDetail(selectedGroup, { silent: true })
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : String(e))
      } finally {
        setDeleteSubmitting(false)
      }
    }

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

        {display?.direction === 'i_owe_counterparty' && balance !== null && (() => {
          const debt = balance < 0n ? -balance : balance
          return (
            <>
              <h3>Settle</h3>
              {usdcBalance !== null && usdcBalance < debt ? (
                <p>
                  You need{' '}
                  <strong>{formatUnits(debt - usdcBalance, 6)} more USDC</strong>
                  {' '}to settle.{' '}
                  <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">
                    Get testnet USDC
                  </a>
                </p>
              ) : (
                <div>
                  <button onClick={onSettle} disabled={settleSubmitting || !client}>
                    {settleSubmitting ? 'Settling…' : `Settle ${display.amount} USDC`}
                  </button>
                  {settleError && <p style={{ color: 'crimson' }}>{settleError}</p>}
                </div>
              )}
            </>
          )
        })()}

        <h3>Expenses</h3>
        {expenses.length === 0 && !loadingDetail && <p style={{ color: 'grey' }}>No expenses yet.</p>}
        {deleteError && <p style={{ color: 'crimson' }}>{deleteError}</p>}
        {expenses.filter((e) => !e.deleted).map((e) => (
          <div key={String(e.id)} style={expenseRow}>
            {editingId === e.id ? (
              <div>
                <div>
                  <label>
                    <input
                      type="radio" name="edit-payer" value="me"
                      checked={editPayer === 'me'}
                      onChange={() => setEditPayer('me')}
                    /> I paid
                  </label>
                  {' '}
                  <label>
                    <input
                      type="radio" name="edit-payer" value="counterparty"
                      checked={editPayer === 'counterparty'}
                      onChange={() => setEditPayer('counterparty')}
                    /> Counterparty paid
                  </label>
                </div>
                <input
                  placeholder="Amount (USDC)"
                  value={editAmount}
                  onChange={(ev) => setEditAmount(ev.target.value)}
                />
                <input
                  placeholder="Description"
                  value={editDescription}
                  onChange={(ev) => setEditDescription(ev.target.value)}
                />
                <div>
                  <button onClick={onSaveEdit} disabled={editSubmitting || !client}>
                    {editSubmitting ? 'Saving…' : 'Save'}
                  </button>
                  {' '}
                  <button onClick={onCancelEdit} disabled={editSubmitting}>Cancel</button>
                </div>
                {editError && <p style={{ color: 'crimson' }}>{editError}</p>}
              </div>
            ) : (
              <div>
                <span><strong>{e.description}</strong></span>
                {' '}
                <span>{formatUnits(e.amount, 6)} USDC — paid by <code style={{ fontSize: '0.85em' }}>{e.payer}</code></span>
                {' '}
                <button onClick={() => onStartEdit(e)} disabled={deleteSubmitting || editingId !== null}>Edit</button>
                {' '}
                <button onClick={() => onDeleteExpense(e.id)} disabled={deleteSubmitting || editingId !== null}>
                  {deleteSubmitting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        ))}

        <h3>Add expense</h3>
        <div>
          <label>
            <input
              type="radio" name="payer" value="me"
              checked={addPayer === 'me'}
              onChange={() => setAddPayer('me')}
            /> I paid
          </label>
          {' '}
          <label>
            <input
              type="radio" name="payer" value="counterparty"
              checked={addPayer === 'counterparty'}
              onChange={() => setAddPayer('counterparty')}
            /> Counterparty paid
          </label>
        </div>
        <input
          placeholder="Amount (USDC, e.g. 12.50)"
          value={addAmount}
          onChange={(e) => setAddAmount(e.target.value)}
        />
        <input
          placeholder="Description"
          value={addDescription}
          onChange={(e) => setAddDescription(e.target.value)}
        />
        <div>
          <button onClick={onAddExpense} disabled={addSubmitting || !client}>
            {addSubmitting ? 'Sending (sponsored)…' : 'Add expense'}
          </button>
        </div>
        {addError && <p style={{ color: 'crimson' }}>{addError}</p>}
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

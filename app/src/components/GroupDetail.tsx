import { useEffect, useState } from 'react'
import type { Address, Hex } from 'viem'
import type { CSSProperties } from 'react'
import { fetchBalance, fetchExpenseHistory, reconstructExpenses, interpretBalance } from '../lib/fetchGroup'
import type { ExpenseEntry, BalanceDisplay } from '../lib/fetchGroup'
import { fetchUsdcBalance } from '../lib/settle'
import type { GroupItem } from '../lib/fetchGroups'
import { SettleSection } from './SettleSection'
import { AddExpenseForm } from './AddExpenseForm'
import { ExpenseList } from './ExpenseList'

type SendUserOperation = (req: { to: Address; data: Hex }) => Promise<Hex>

type Props = {
  group: GroupItem
  smartAccount: Address
  send: SendUserOperation | undefined
  onBack: () => void
}

// Returns raw fetched values without committing state -- used by both loadDetail
// and pollUntilChanged so the fetch logic lives in one place.
async function fetchDetail(
  groupAddress: Parameters<typeof fetchBalance>[0],
  createdBlock: bigint,
  smartAccount: Parameters<typeof fetchUsdcBalance>[0],
) {
  const [bal, logs, usdc] = await Promise.all([
    fetchBalance(groupAddress),
    fetchExpenseHistory(groupAddress, createdBlock),
    fetchUsdcBalance(smartAccount),
  ])
  return { bal, expenses: reconstructExpenses(logs), usdc }
}

// Index-aligned: safe because reconstructExpenses always returns entries sorted
// by id ascending. Covers all write types: add (length change), edit (amount/
// description/payer change), delete (deleted flag change), settle (balance change
// detected at call site, not here).
function snapshotsMatch(a: ExpenseEntry[], b: ExpenseEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    if (
      x.id !== y.id ||
      x.deleted !== y.deleted ||
      x.amount !== y.amount ||
      x.description !== y.description ||
      x.payer !== y.payer
    ) return false
  }
  return true
}

export function GroupDetail({ group, smartAccount, send, onBack }: Props) {
  const [balance, setBalance] = useState<bigint | null>(null)
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null)

  async function loadDetail(opts?: { silent?: boolean }) {
    if (!opts?.silent) {
      setBalance(null)
      setExpenses([])
      setDetailError(null)
      setUsdcBalance(null)
      setLoadingDetail(true)
    }
    try {
      const { bal, expenses, usdc } = await fetchDetail(group.address, group.createdBlock, smartAccount)
      setBalance(bal)
      setExpenses(expenses)
      setUsdcBalance(usdc)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e))
    } finally {
      if (!opts?.silent) setLoadingDetail(false)
    }
  }

  // Polls until the on-chain state differs from the pre-write snapshot, or 4
  // attempts are exhausted. Commits each fetch result regardless of match so
  // the UI always shows the freshest read. Fetch errors consume the attempt
  // budget (with delay) rather than aborting -- fetchBalance/fetchUsdcBalance
  // are not covered by collectInWindows retry, so continuing gives them a real
  // second chance before giving up.
  async function pollUntilChanged(preBalance: bigint | null, preExpenses: ExpenseEntry[]) {
    for (let i = 0; i < 4; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 500))
      try {
        const { bal, expenses, usdc } = await fetchDetail(group.address, group.createdBlock, smartAccount)
        setBalance(bal)
        setExpenses(expenses)
        setUsdcBalance(usdc)
        if (bal !== preBalance || !snapshotsMatch(expenses, preExpenses)) break
      } catch {
        continue
      }
    }
  }

  // Fires once on mount. GroupDetail is unmounted and remounted whenever the
  // selected group changes, so this is equivalent to the original
  // useEffect([selectedGroup, smartAccount]) in the parent.
  useEffect(() => {
    loadDetail()
  }, [])

  const display: BalanceDisplay | null =
    balance !== null ? interpretBalance(balance, smartAccount, group.memberA) : null

  // Captures balance/expenses from the current render (pre-write values) and
  // polls until the chain reflects the change.
  const reload = () => pollUntilChanged(balance, expenses)

  return (
    <main style={page}>
      <button onClick={onBack}>← Back</button>
      <h1>Mend</h1>
      <h2>Group with <code style={{ fontSize: '0.85em' }}>{group.counterparty}</code></h2>
      <p style={{ color: 'grey', fontSize: '0.8em' }}>
        Contract: <code>{group.address}</code>
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

      {display?.direction === 'i_owe_counterparty' && balance !== null && (
        <SettleSection
          balance={balance}
          usdcBalance={usdcBalance}
          display={display}
          send={send}
          groupAddress={group.address}
          onSettled={reload}
        />
      )}

      <ExpenseList
        expenses={expenses}
        loadingDetail={loadingDetail}
        send={send}
        groupAddress={group.address}
        smartAccount={smartAccount}
        counterparty={group.counterparty}
        onMutated={reload}
      />

      <AddExpenseForm
        send={send}
        groupAddress={group.address}
        smartAccount={smartAccount}
        counterparty={group.counterparty}
        onAdded={reload}
      />
    </main>
  )
}

const page: CSSProperties = {
  maxWidth: 640,
  margin: '2rem auto',
  padding: '0 1rem',
  fontFamily: 'system-ui, sans-serif',
}

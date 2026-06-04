import { formatUnits, getAddress, type Address } from 'viem'
import { groupAbi } from '../config'
import { publicClient } from './client'
import { querySubgraph } from './subgraph'

export type ExpenseEntry = {
  id: bigint
  payer: Address
  amount: bigint
  description: string
  createdAt: number
  deleted: boolean
}

export type BalanceDisplay = {
  direction: 'counterparty_owes_me' | 'i_owe_counterparty' | 'settled'
  amount: string
}

export async function fetchBalance(groupAddress: Address): Promise<bigint> {
  return publicClient.readContract({
    address: groupAddress,
    abi: groupAbi,
    functionName: 'balance',
  })
}

const EXPENSES_QUERY = `
  query Expenses($group: ID!) {
    group(id: $group) {
      expenses(orderBy: expenseId, orderDirection: asc) {
        expenseId
        payer
        amount
        description
        createdAt
        deleted
      }
    }
  }
`

type SubgraphExpense = {
  expenseId: string
  payer: string
  amount: string
  description: string
  createdAt: string
  deleted: boolean
}

export async function fetchExpenseHistory(groupAddress: Address): Promise<ExpenseEntry[]> {
  // Lowercase: Group.id is stored as toHexString() (lowercase) in the subgraph.
  const group = groupAddress.toLowerCase()
  const data = await querySubgraph<{ group: { expenses: SubgraphExpense[] } | null }>(
    EXPENSES_QUERY,
    { group },
  )
  return (data.group?.expenses ?? []).map((e) => ({
    id: BigInt(e.expenseId),
    payer: getAddress(e.payer),
    amount: BigInt(e.amount),
    description: e.description,
    createdAt: Number(e.createdAt),
    deleted: e.deleted,
  }))
}

export async function fetchGroupMembers(
  address: Address,
): Promise<{ memberA: Address; memberB: Address }> {
  const [memberA, memberB] = await Promise.all([
    publicClient.readContract({ address, abi: groupAbi, functionName: 'memberA' }),
    publicClient.readContract({ address, abi: groupAbi, functionName: 'memberB' }),
  ])
  return { memberA, memberB }
}

// Sign convention: balance > 0 means memberB owes memberA; < 0 means memberA owes memberB.
// memberB not needed: two members only, so "not memberA" == memberB.
export function interpretBalance(
  balance: bigint,
  smartAccount: Address,
  memberA: Address,
): BalanceDisplay {
  const abs = balance < 0n ? -balance : balance
  const amount = formatUnits(abs, 6)

  if (balance === 0n) return { direction: 'settled', amount }

  const isMemberA = getAddress(smartAccount) === getAddress(memberA)
  const positiveOwesMe = isMemberA ? balance > 0n : balance < 0n

  return {
    direction: positiveOwesMe ? 'counterparty_owes_me' : 'i_owe_counterparty',
    amount,
  }
}

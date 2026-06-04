import { getAddress, type Address } from 'viem'
import { querySubgraph } from './subgraph'

export type GroupItem = {
  address: Address
  memberA: Address
  memberB: Address
  counterparty: Address
  createdBlock: bigint
}

const GROUPS_QUERY = `
  query Groups($addr: Bytes!) {
    groups(where: { or: [{ memberA: $addr }, { memberB: $addr }] }) {
      id
      memberA
      memberB
      createdBlock
    }
  }
`

type SubgraphGroup = {
  id: string
  memberA: string
  memberB: string
  createdBlock: string
}

export async function fetchMyGroups(smartAccount: Address): Promise<GroupItem[]> {
  // Lowercase: filter input normalized to match subgraph's stored lowercase Bytes.
  const addr = smartAccount.toLowerCase()
  const data = await querySubgraph<{ groups: SubgraphGroup[] }>(GROUPS_QUERY, { addr })
  return data.groups.map((g) => {
    const memberA = getAddress(g.memberA)
    const memberB = getAddress(g.memberB)
    return {
      address: getAddress(g.id),
      memberA,
      memberB,
      counterparty: memberA === getAddress(smartAccount) ? memberB : memberA,
      createdBlock: BigInt(g.createdBlock),
    }
  })
}

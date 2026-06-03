import { getAddress, getAbiItem, type Address } from 'viem'
import { FACTORY_ADDRESS, FACTORY_DEPLOY_BLOCK, factoryAbi } from '../config'
import { publicClient, collectInWindows } from './client'

export type GroupItem = {
  address: Address
  memberA: Address
  memberB: Address
  counterparty: Address
  createdBlock: bigint
}

// Two getLogs instead of one — indexed args can only filter one value per field;
// the two sets are disjoint (contract forbids self-grouping), so concat without dedup.
export async function fetchMyGroups(smartAccount: Address): Promise<GroupItem[]> {
  const head = await publicClient.getBlockNumber()
  const [aLogs, bLogs] = await Promise.all([
    collectInWindows(FACTORY_DEPLOY_BLOCK, head, (from, to) =>
      publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: getAbiItem({ abi: factoryAbi, name: 'GroupCreated' }),
        args: { memberA: smartAccount },
        fromBlock: from,
        toBlock: to,
      }),
    ),
    collectInWindows(FACTORY_DEPLOY_BLOCK, head, (from, to) =>
      publicClient.getLogs({
        address: FACTORY_ADDRESS,
        event: getAbiItem({ abi: factoryAbi, name: 'GroupCreated' }),
        args: { memberB: smartAccount },
        fromBlock: from,
        toBlock: to,
      }),
    ),
  ])

  return [...aLogs, ...bLogs].map((log) => {
    const memberA = log.args.memberA!
    const memberB = log.args.memberB!
    return {
      address: log.args.group!,
      memberA,
      memberB,
      counterparty:
        getAddress(memberA) === getAddress(smartAccount) ? memberB : memberA,
      createdBlock: log.blockNumber!,
    }
  })
}

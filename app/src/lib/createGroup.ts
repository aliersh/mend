import {
  encodeFunctionData,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem'
import { FACTORY_ADDRESS, factoryAbi } from '../config'
import { publicClient } from './client'

// Privy's useSmartWallets() client turns this request into a sponsored
// UserOperation. We type only the call we make, so this module stays decoupled
// from Privy's client type. We deliberately omit `chain`: the SmartWallets
// client is already bound to a single chain (defaultChain/supportedChains in
// providers.tsx), so passing it again is redundant. It is also the one field
// whose viem `Chain` type won't unify across Privy's pinned viem copy and ours.
type SendUserOperation = (request: {
  to: Address
  data: Hex
}) => Promise<Hex>

// Send the createGroup call and return the hash as soon as it is available. The
// first write from a counterfactual account also deploys it; the paymaster
// sponsors both. The returned hash is the proof the sponsored write went out —
// resolving the new group address (below) is a separate, best-effort step.
export async function submitCreateGroup(
  send: SendUserOperation,
  counterparty: Address,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createGroup',
    args: [counterparty],
  })
  return send({ to: FACTORY_ADDRESS, data })
}

// Resolve the deployed group address from the receipt's GroupCreated log. Kept
// separate from submission so a receipt/parse failure never masks a write that
// actually landed on-chain.
export async function fetchGroupAddress(txHash: Hex): Promise<Address> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  const [event] = parseEventLogs({
    abi: factoryAbi,
    eventName: 'GroupCreated',
    logs: receipt.logs,
  })
  if (!event) {
    throw new Error('Transaction confirmed but no GroupCreated event was found.')
  }
  return event.args.group
}

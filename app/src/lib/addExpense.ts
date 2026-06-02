import { encodeFunctionData, type Address, type Hex } from 'viem'
import { groupAbi } from '../config'

// Same decoupled shape as createGroup.ts: type only the call we make, omit
// `chain` (the SmartWallets client is already bound to one chain).
type SendUserOperation = (request: { to: Address; data: Hex }) => Promise<Hex>

export async function submitAddExpense(
  send: SendUserOperation,
  groupAddress: Address,
  payer: Address,
  amount: bigint,       // USDC base units (6 decimals) — caller converts
  description: string,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: groupAbi,
    functionName: 'addExpense',
    args: [payer, amount, description],
  })
  return send({ to: groupAddress, data })
}

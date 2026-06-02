import { encodeFunctionData, type Address, type Hex } from 'viem'
import { groupAbi } from '../config'

type SendUserOperation = (request: { to: Address; data: Hex }) => Promise<Hex>

export async function submitEditExpense(
  send: SendUserOperation,
  groupAddress: Address,
  expenseId: bigint,
  newPayer: Address,
  newAmount: bigint,       // USDC base units (6 decimals) — caller converts
  newDescription: string,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: groupAbi,
    functionName: 'editExpense',
    args: [expenseId, newPayer, newAmount, newDescription],
  })
  return send({ to: groupAddress, data })
}

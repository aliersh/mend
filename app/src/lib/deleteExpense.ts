import { encodeFunctionData, type Address, type Hex } from 'viem'
import { groupAbi } from '../config'

type SendUserOperation = (request: { to: Address; data: Hex }) => Promise<Hex>

export async function submitDeleteExpense(
  send: SendUserOperation,
  groupAddress: Address,
  expenseId: bigint,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: groupAbi,
    functionName: 'deleteExpense',
    args: [expenseId],
  })
  return send({ to: groupAddress, data })
}

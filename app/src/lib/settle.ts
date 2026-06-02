import { encodeFunctionData, type Address, type Hex } from 'viem'
import { groupAbi, usdcAbi, USDC_ADDRESS } from '../config'
import { publicClient } from './client'

// Same decoupled shape as addExpense.ts / createGroup.ts: type only the call
// we make, omit `chain` (the SmartWallets client is already bound to one chain).
type SendUserOperation = (request: { to: Address; data: Hex }) => Promise<Hex>

// Step 1 of settle: grant the group contract an exact allowance for the debt.
// Approving only the exact amount limits exposure — the contract can pull no more.
export async function submitApprove(
  send: SendUserOperation,
  usdcAddress: Address,
  spender: Address,
  amount: bigint,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: usdcAbi,
    functionName: 'approve',
    args: [spender, amount],
  })
  return send({ to: usdcAddress, data })
}

// Step 2 of settle: call settle() on the group contract. The contract pulls
// exactly abs(balance) USDC via the allowance granted in step 1.
export async function submitSettle(
  send: SendUserOperation,
  groupAddress: Address,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: groupAbi,
    functionName: 'settle',
  })
  return send({ to: groupAddress, data })
}

// Read the debtor's USDC balance to gate the settle button before submission.
export async function fetchUsdcBalance(account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [account],
  })
}

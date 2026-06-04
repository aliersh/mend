import { createPublicClient, http } from 'viem'
import { CHAIN, RPC_URL } from '../config'

// Shared read client for on-chain readContract calls (balance, members, USDC).
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })

// 4 total attempts: initial + 3 retries with 300/600/1200ms delays.
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [300, 600, 1200]
  let lastError: unknown
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt < 3) await new Promise((r) => setTimeout(r, delays[attempt]))
    }
  }
  throw lastError
}

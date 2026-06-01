import { createPublicClient, http } from 'viem'
import { CHAIN, RPC_URL } from '../config'

// Shared read client, pointed at RPC_URL (a getLogs-capable endpoint; see config).
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })

// eth_getLogs block ranges are capped per RPC (~10k on the default/provider RPCs).
// Split [fromBlock, toBlock] into windows and concatenate. Lower this if an
// overriding RPC rejects the range ("Invalid parameters").
const LOG_WINDOW = 9000n

export async function collectInWindows<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetchWindow: (from: bigint, to: bigint) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = fromBlock; from <= toBlock; from += LOG_WINDOW) {
    const to = from + LOG_WINDOW - 1n
    out.push(...(await fetchWindow(from, to > toBlock ? toBlock : to)))
  }
  return out
}

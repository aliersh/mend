import { baseSepolia } from 'viem/chains'
import { factoryAbi, groupAbi } from './generated/contracts'
export { factoryAbi, groupAbi }

export const CHAIN = baseSepolia

// Deployed MendFactory and Circle's native USDC on Base Sepolia.
export const FACTORY_ADDRESS = '0x7C6c933B036fCe0d6663ab4F3866ACdC2A5091Da' as const
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

// Lower bound for factory log queries — never scan from genesis.
export const FACTORY_DEPLOY_BLOCK = 42151193n

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID
export const SPONSORSHIP_POLICY_ID = import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID
// Reads RPC. The chain's canonical public endpoint caps getLogs ranges near 3k
// blocks and can't serve the factory's full history, so default to a public RPC
// that handles ~10k-block windows (verified). Override with VITE_RPC_URL.
// The free public default is unreliable for getLogs: it times out under load and
// lags behind the chain head when indexing recent blocks, causing post-write reads
// to return stale data. A dedicated endpoint (e.g. Alchemy) set via VITE_RPC_URL
// is needed for reliable reads.
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? 'https://base-sepolia.drpc.org'


// Minimal USDC interface: allowance approval and balance check for the settle flow.
export const usdcAbi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

import { baseSepolia } from 'viem/chains'
import { factoryAbi, groupAbi } from './generated/contracts'
export { factoryAbi, groupAbi }

export const CHAIN = baseSepolia

// Deployed MendFactory and Circle's native USDC on Base Sepolia.
export const FACTORY_ADDRESS = '0x7C6c933B036fCe0d6663ab4F3866ACdC2A5091Da' as const
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

// Factory deploy block — used as createdBlock fallback on cold-load.
export const FACTORY_DEPLOY_BLOCK = 42151193n

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID
export const SPONSORSHIP_POLICY_ID = import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID
// Reads RPC — used for on-chain readContract calls (balance, members, USDC).
// Override with VITE_RPC_URL if the public default is unreliable.
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? 'https://base-sepolia.drpc.org'
export const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL


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

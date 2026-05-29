import { baseSepolia } from 'viem/chains'

export const CHAIN = baseSepolia

// Deployed MendFactory and Circle's native USDC on Base Sepolia.
export const FACTORY_ADDRESS = '0x7C6c933B036fCe0d6663ab4F3866ACdC2A5091Da' as const
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID
export const SPONSORSHIP_POLICY_ID = import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID

// Minimal factory interface: the one write this phase makes, the event we read
// back from the receipt, and the constructor-validation errors so viem can
// decode a sponsored revert into a named error instead of a raw selector.
export const factoryAbi = [
  {
    type: 'function',
    name: 'createGroup',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'otherMember', type: 'address' }],
    outputs: [{ name: 'group', type: 'address' }],
  },
  {
    type: 'event',
    name: 'GroupCreated',
    inputs: [
      { name: 'group', type: 'address', indexed: true },
      { name: 'memberA', type: 'address', indexed: true },
      { name: 'memberB', type: 'address', indexed: true },
    ],
  },
  { type: 'error', name: 'CannotGroupWithSelf', inputs: [] },
  { type: 'error', name: 'InvalidMemberAddress', inputs: [] },
] as const

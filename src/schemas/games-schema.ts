import type { CollectionSchema } from 'deepspace/schema'

export type EntryType = 'buyin' | 'cashout'

export type Entry = {
  id: string
  playerId: string
  type: EntryType
  amountCents: number
  at: string
  /** Set when the entry came from approving a buy-in request. */
  requestId?: string
}

export const FELTS = ['green', 'blue', 'burgundy'] as const
export type Felt = (typeof FELTS)[number]

/**
 * How a closed game absorbs a miscount (cash-outs ≠ buy-ins). Players pay the
 * host before they play, so losers are never charged more: either the winners
 * share the difference or the host does.
 */
export const MISCOUNT_METHODS = ['winners-proportional', 'winners-equal', 'host-covers'] as const
export type MiscountMethod = (typeof MISCOUNT_METHODS)[number]

export type Game = {
  name: string
  /** Legacy: codes now live in gameCodes. Old games keep theirs here until an admin secures them. */
  code?: string | null
  status: 'open' | 'closed'
  entries: Entry[]
  closedAt?: string
  /** Missing on games created before buy-in requests existed. */
  declinedRequestIds?: string[]
  /** Missing on games created before felt colors existed; those show green. */
  felt?: Felt
  /** Payouts the host marked paid, keyed by the player paid. */
  paidPayments?: string[]
  /** Chosen when the host closes a game whose count is off. */
  miscountMethod?: MiscountMethod
}

const noAccess = { read: false, create: false, update: false, delete: false }

// The host is the game's creator, so 'own' means "only this game's host".
// The ledger lives on the game record because only the host ever writes it.
export const gamesSchema: CollectionSchema = {
  name: 'games',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 80 },
    // Kept (not required, not immutable) so the secureJoinCodes action can clear old codes.
    { name: 'code', storage: 'text', interpretation: 'plain' },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['open', 'closed'] },
      default: 'open',
    },
    { name: 'entries', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'closedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'declinedRequestIds', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'felt', storage: 'text', interpretation: { kind: 'select', options: [...FELTS] }, default: 'green' },
    { name: 'paidPayments', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'miscountMethod', storage: 'text', interpretation: { kind: 'select', options: [...MISCOUNT_METHODS] } },
  ],
  uniqueOn: ['code'],
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

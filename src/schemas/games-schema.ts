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

export type Game = {
  name: string
  code: string
  status: 'open' | 'closed'
  entries: Entry[]
  closedAt?: string
  /** Missing on games created before buy-in requests existed. */
  declinedRequestIds?: string[]
  /** Missing on games created before felt colors existed; those show green. */
  felt?: Felt
  /** Settle-up payments the host marked paid, keyed `${from}:${to}`. */
  paidPayments?: string[]
}

const noAccess = { read: false, create: false, update: false, delete: false }

// The host is the game's creator, so 'own' means "only this game's host".
// The ledger lives on the game record because only the host ever writes it.
export const gamesSchema: CollectionSchema = {
  name: 'games',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 80 },
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true },
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
  ],
  uniqueOn: ['code'],
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

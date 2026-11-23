import type { CollectionSchema } from 'deepspace/schema'

export type EntryType = 'buyin' | 'cashout'

export type Entry = {
  id: string
  playerId: string
  type: EntryType
  amountCents: number
  at: string
}

export type Game = {
  name: string
  code: string
  status: 'open' | 'closed'
  entries: Entry[]
  closedAt?: string
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
  ],
  uniqueOn: ['code'],
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

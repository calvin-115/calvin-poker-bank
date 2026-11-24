import type { CollectionSchema } from 'deepspace/schema'

export type Player = {
  gameId: string
  userId: string
}

const noAccess = { read: false, create: false, update: false, delete: false }

// Seats are created only by the hostGame / joinGame actions, which check the
// join code. userBound + ownerField: a member can only remove their own seat.
export const playersSchema: CollectionSchema = {
  name: 'players',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
  ],
  uniqueOn: ['gameId', 'userId'],
  ownerField: 'userId',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: true, create: false, update: false, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

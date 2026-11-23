import type { CollectionSchema } from 'deepspace/schema'

export type Player = {
  gameId: string
  userId: string
}

const noAccess = { read: false, create: false, update: false, delete: false }

// userBound + ownerField: a member can only add or remove themselves.
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
    member: { read: true, create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

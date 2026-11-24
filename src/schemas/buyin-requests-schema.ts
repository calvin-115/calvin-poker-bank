import type { CollectionSchema } from 'deepspace/schema'

export type BuyinRequest = {
  gameId: string
  userId: string
  amountCents: number
}

const noAccess = { read: false, create: false, update: false, delete: false }

// A player asks the host for a buy-in. The host never writes these rows:
// approving adds a ledger entry tagged with the request id, declining adds the
// id to the game's declinedRequestIds. Both are single writes to the game, which
// only the host can make, so a player can't approve their own request.
export const buyinRequestsSchema: CollectionSchema = {
  name: 'buyinRequests',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'amountCents', storage: 'number', interpretation: 'plain', required: true, immutable: true },
  ],
  ownerField: 'userId',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: true, create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

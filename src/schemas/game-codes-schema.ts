import type { CollectionSchema } from 'deepspace/schema'

export type GameCode = {
  gameId: string
  code: string
  /** Everyone who may read this code: the host and every player who joined. */
  members: string[]
}

const noAccess = { read: false, create: false, update: false, delete: false }

// Join codes live apart from games because games are readable by every member
// and the platform has no per-field read rules. Only the server actions in
// src/actions write these rows, so nobody can mint a code for someone else's game.
export const gameCodesSchema: CollectionSchema = {
  name: 'gameCodes',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'members', storage: 'text', interpretation: { kind: 'json' }, default: [] },
  ],
  uniqueOn: ['code'],
  collaboratorsField: 'members',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: 'collaborator', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

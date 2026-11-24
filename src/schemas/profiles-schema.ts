import type { CollectionSchema } from 'deepspace/schema'

/**
 * A player's name and picture in this app. The sign-in account's name and
 * photo belong to the identity provider (the users collection refuses app
 * writes to them), so app-chosen ones live here. Empty means "use the account's".
 */
export type Profile = {
  userId: string
  displayName: string
  avatarUrl: string
  /** Where players pay this person when they host. Missing on profiles made before Venmo support. */
  venmoUsername?: string
}

const noAccess = { read: false, create: false, update: false, delete: false }

export const profilesSchema: CollectionSchema = {
  name: 'profiles',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain', maxLength: 40, default: '' },
    { name: 'avatarUrl', storage: 'text', interpretation: { kind: 'url' }, default: '' },
    { name: 'venmoUsername', storage: 'text', interpretation: 'plain', maxLength: 30, default: '' },
  ],
  uniqueOn: ['userId'],
  ownerField: 'userId',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

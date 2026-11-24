import { useQuery, useUserLookup } from 'deepspace'
import type { Profile } from '@/schemas/profiles-schema'

/** Names and pictures as players chose them in Settings, falling back to their sign-in account's. */
export function usePeople() {
  const { getName, getUser } = useUserLookup()
  const { records } = useQuery<Profile>('profiles')
  const profiles = new Map(records.map((r) => [r.data.userId, r.data]))

  return {
    nameOf: (userId: string) => profiles.get(userId)?.displayName || getName(userId) || 'Unknown',
    imageOf: (userId: string) => profiles.get(userId)?.avatarUrl || getUser(userId)?.imageUrl || undefined,
  }
}

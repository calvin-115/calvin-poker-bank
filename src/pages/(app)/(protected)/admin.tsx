import { useState } from 'react'
import { useAuth, useUser, useUsers } from 'deepspace'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'

// The nav hides this page from members, but the real guard is the server:
// setRole is refused unless the caller is already an admin.
export default function AdminPage() {
  const { userId } = useAuth()
  const { user } = useUser()
  const { users, usersLoaded, setRole } = useUsers()

  if (user?.role !== 'admin') {
    return <p className="px-6 py-12 text-foreground">Admins only.</p>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Admin</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Admins can edit any game and manage other admins.
      </p>
      {!usersLoaded && <p className="text-sm text-muted-foreground">Loading…</p>}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3">
            <span>
              <span className="font-medium">{u.name}</span>
              <span className="ml-2 text-sm text-muted-foreground">{u.email}</span>
            </span>
            {u.id === userId ? (
              <span className="text-sm text-muted-foreground">{u.role} (you)</span>
            ) : u.role === 'admin' ? (
              <Button size="sm" variant="secondary" onClick={() => setRole(u.id, 'member')}>Remove admin</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setRole(u.id, 'admin')}>Make admin</Button>
            )}
          </li>
        ))}
      </ul>

      <SecureJoinCodes />
    </div>
  )
}

function SecureJoinCodes() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string>()

  async function run() {
    setBusy(true)
    try {
      const { moved } = await callAction<{ moved: number }>('secureJoinCodes', {})
      setResult(moved === 0 ? 'All join codes are already secured.' : `Secured ${moved} game${moved === 1 ? '' : 's'}.`)
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Could not secure join codes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Secure old join codes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Games created before join codes were made private still keep their code where any member could read it. This moves
        those codes so only each game's players and admins can see them. Safe to run more than once.
      </p>
      <Button className="mt-4" onClick={run} disabled={busy}>
        {busy ? 'Securing…' : 'Secure old join codes'}
      </Button>
      {result && <p className="mt-3 text-sm">{result}</p>}
    </section>
  )
}

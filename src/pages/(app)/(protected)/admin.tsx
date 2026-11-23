import { useAuth, useUser, useUsers } from 'deepspace'
import { Button } from '@/components/ui'

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
    </div>
  )
}

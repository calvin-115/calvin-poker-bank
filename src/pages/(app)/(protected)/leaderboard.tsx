import { Link } from 'react-router-dom'
import { useAuth, useQuery, useUserLookup } from 'deepspace'
import { cn } from '@/lib/utils'
import { formatCents, lifetimePnl, playerTotals } from '@/lib/poker'
import type { Game } from '@/schemas/games-schema'

export default function LeaderboardPage() {
  const { userId } = useAuth()
  const { getName } = useUserLookup()
  const { records, status } = useQuery<Game>('games', { where: { status: 'closed' } })

  // Only closed games count: open games are still in play.
  const games = [...records].sort((a, b) => (b.data.closedAt ?? '').localeCompare(a.data.closedAt ?? ''))
  const rows = lifetimePnl(games.map((g) => g.data))
  const me = rows.find((r) => r.playerId === userId)
  const myGames = games.filter((g) => g.data.entries.some((e) => e.playerId === userId))

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Leaderboard</h1>

      <section className="mb-10 rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Your lifetime P&amp;L</p>
        <p data-testid="my-pnl" className={cn('text-4xl font-bold', pnlColor(me?.netCents ?? 0))}>
          {formatCents(me?.netCents ?? 0, { signed: true })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          across {me?.games ?? 0} closed game{me?.games === 1 ? '' : 's'}
        </p>
        {myGames.length > 0 && (
          <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
            {myGames.map((g) => {
              const net = playerTotals([userId!], g.data.entries)[0].netCents
              return (
                <li key={g.recordId} className="flex justify-between py-2">
                  <Link to={`/games/${g.recordId}`} className="hover:underline">{g.data.name}</Link>
                  <span className={pnlColor(net)}>{formatCents(net, { signed: true })}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <h2 className="mb-3 text-lg font-semibold">Everyone</h2>
      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'ready' && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No closed games yet.</p>
      )}
      <ol data-testid="leaderboard" className="divide-y divide-border rounded-lg border border-border">
        {rows.map((r, i) => (
          <li key={r.playerId} className={cn('flex items-center justify-between px-4 py-3', r.playerId === userId && 'bg-muted')}>
            <span>
              <span className="mr-3 inline-block w-5 text-muted-foreground">{i + 1}</span>
              {getName(r.playerId) ?? 'Unknown'}
              <span className="ml-2 text-sm text-muted-foreground">{r.games} game{r.games === 1 ? '' : 's'}</span>
            </span>
            <span className={cn('font-medium', pnlColor(r.netCents))}>{formatCents(r.netCents, { signed: true })}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function pnlColor(cents: number) {
  if (cents > 0) return 'text-success'
  if (cents < 0) return 'text-destructive'
  return undefined
}

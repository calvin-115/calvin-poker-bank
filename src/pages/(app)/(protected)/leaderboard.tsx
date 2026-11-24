import { Link } from 'react-router-dom'
import { useAuth, useQuery, useUserLookup } from 'deepspace'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatCents, lifetimePnl, playerTotals } from '@/lib/poker'
import type { Game } from '@/schemas/games-schema'

export default function LeaderboardPage() {
  const { userId } = useAuth()
  const { getName, getUser } = useUserLookup()
  const { records, status } = useQuery<Game>('games', { where: { status: 'closed' } })

  // Only closed games count: open games are still in play.
  const games = [...records].sort((a, b) => (b.data.closedAt ?? '').localeCompare(a.data.closedAt ?? ''))
  const rows = lifetimePnl(games.map((g) => g.data))
  const me = rows.find((r) => r.playerId === userId)
  const myGames = games.filter((g) => g.data.entries.some((e) => e.playerId === userId))

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leaderboard</h1>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Your lifetime P&amp;L</p>
        <p data-testid="my-pnl" className={cn('mt-1 text-4xl font-semibold tracking-tight', pnlColor(me?.netCents ?? 0))}>
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
                <li key={g.recordId}>
                  <Link to={`/games/${g.recordId}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-foreground">
                    <span className="min-w-0">
                      <span className="block truncate">{g.data.name}</span>
                      {g.data.closedAt && (
                        <span className="block text-xs text-muted-foreground">
                          {new Date(g.data.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </span>
                    <span className={cn('font-medium', pnlColor(net))}>{formatCents(net, { signed: true })}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <h2 className="mb-2 mt-8 text-sm font-medium text-muted-foreground">Everyone</h2>
      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'ready' && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No closed games yet.</p>
      )}
      {rows.length > 0 && (
        <ol data-testid="leaderboard" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((r, i) => {
            const name = getName(r.playerId) ?? 'Unknown'
            const isYou = r.playerId === userId
            // Medals are for winners only: third place can still be down money.
            const medal = r.netCents > 0 ? MEDALS[i] : undefined
            return (
              <li key={r.playerId} className={cn('flex items-center gap-3 px-4 py-3', isYou && 'bg-accent/40')}>
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    medal ?? 'text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                <Avatar className="size-8">
                  <AvatarImage src={getUser(r.playerId)?.imageUrl} />
                  <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{name}{isYou && ' (you)'}</span>
                  <span className="block text-xs text-muted-foreground">{r.games} game{r.games === 1 ? '' : 's'}</span>
                </span>
                <span className={cn('text-base font-semibold', pnlColor(r.netCents))}>{formatCents(r.netCents, { signed: true })}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

const MEDALS = ['bg-amber-400 text-black', 'bg-zinc-300 text-black', 'bg-orange-400 text-black']

function pnlColor(cents: number) {
  if (cents > 0) return 'text-success'
  if (cents < 0) return 'text-destructive'
  return undefined
}

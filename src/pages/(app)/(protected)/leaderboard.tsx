import { Link } from 'react-router-dom'
import { getUserColor, useAuth, useQuery, type RecordData } from 'deepspace'
import { Crown } from 'lucide-react'
import { AnimatedCents } from '@/components/AnimatedCents'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { cn } from '@/lib/utils'
import { closedGameTotals, formatCents, lifetimePnl, type ClosedGame, type LifetimeRow } from '@/lib/poker'
import { usePeople } from '@/lib/use-people'
import { playerNights, playerStats, type PlayerStats, type Result } from '@/lib/stats'
import type { Game } from '@/schemas/games-schema'

const MEDALS = ['bg-amber-400 text-black', 'bg-zinc-300 text-black', 'bg-orange-400 text-black']
const FORM_COLOR: Record<Result, string> = { up: 'bg-success', down: 'bg-destructive', even: 'bg-muted-foreground' }

export default function LeaderboardPage() {
  const { userId } = useAuth()
  const { nameOf, imageOf } = usePeople()
  const { records, status } = useQuery<Game>('games', { where: { status: 'closed' } })

  // Only closed games count: open games are still in play.
  const games = [...records].sort((a, b) => (b.data.closedAt ?? '').localeCompare(a.data.closedAt ?? ''))
  const closedOf = (g: RecordData<Game>): ClosedGame => ({
    entries: g.data.entries,
    hostId: g.createdBy,
    miscountMethod: g.data.miscountMethod,
  })
  const oldestFirst = [...games].reverse().map(closedOf)
  const rows = lifetimePnl(games.map(closedOf))
  const statsOf = (playerId: string) => playerStats(playerNights(oldestFirst, playerId))
  const me = rows.find((r) => r.playerId === userId)
  const myStats = userId ? statsOf(userId) : undefined
  const myGames = games.flatMap((g) => {
    const mine = closedGameTotals(closedOf(g)).find((t) => t.playerId === userId)
    return mine ? [{ game: g, netCents: mine.netCents }] : []
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-foreground sm:px-6 lg:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">Leaderboard</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 lg:col-start-2 lg:row-start-1">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Your lifetime P&amp;L</p>
            <p data-testid="my-pnl" className={cn('mt-1 font-display text-5xl font-bold tracking-tight', pnlColor(me?.netCents ?? 0))}>
              <AnimatedCents cents={me?.netCents ?? 0} signed />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              across {me?.games ?? 0} closed game{me?.games === 1 ? '' : 's'}
            </p>
          </div>

          {myStats && (myStats.biggestWinCents !== null || myStats.longestUpStreak > 1 || myStats.streak) && (
            <div className="grid grid-cols-2 gap-2">
              {myStats.biggestWinCents !== null && (
                <Best label="Biggest night" value={formatCents(myStats.biggestWinCents, { signed: true })} tone="text-success" />
              )}
              {myStats.longestUpStreak > 1 && <Best label="Best streak" value={`${myStats.longestUpStreak} up`} />}
              {myStats.streak && (
                <Best
                  label="Right now"
                  value={`${myStats.streak.count} ${myStats.streak.result} in a row`}
                  tone={myStats.streak.result === 'up' ? 'text-success' : 'text-destructive'}
                />
              )}
            </div>
          )}

          {myGames.length > 0 && (
            <ul className="divide-y divide-border border-t border-border text-sm">
              {myGames.map(({ game: g, netCents: net }) => {
                return (
                  <li key={g.recordId}>
                    <Link to={`/games/${g.recordId}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                      <span className="min-w-0">
                        <span className="block truncate">{g.data.name}</span>
                        {g.data.closedAt && (
                          <span className="block text-xs text-muted-foreground">
                            {new Date(g.data.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </span>
                      <span className={cn('font-display font-bold', pnlColor(net))}>{formatCents(net, { signed: true })}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-6 lg:col-start-1 lg:row-start-1">
          {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
          {status === 'ready' && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No closed games yet.</p>
          )}

          {rows.length > 0 && (
            <Podium rows={rows.slice(0, 3)} nameOf={nameOf} imageOf={imageOf} />
          )}

          {rows.length > 0 && (
            <section>
              <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">Standings</h2>
              <ol data-testid="leaderboard" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {rows.map((r, i) => (
                  <StandingRow
                    key={r.playerId}
                    row={r}
                    rank={i + 1}
                    name={nameOf(r.playerId)}
                    imageUrl={imageOf(r.playerId)}
                    isYou={r.playerId === userId}
                    stats={statsOf(r.playerId)}
                  />
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Best({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-display text-lg font-bold', tone)}>{value}</p>
    </div>
  )
}

/** Top three on felt, arranged 2–1–3 like a real podium. */
function Podium({
  rows,
  nameOf,
  imageOf,
}: {
  rows: LifetimeRow[]
  nameOf: (id: string) => string
  imageOf: (id: string) => string | undefined
}) {
  const places = [1, 0, 2].filter((i) => rows[i])
  const heights = ['h-28', 'h-20', 'h-14']
  return (
    <section className="felt felt-ring rounded-2xl px-4 pb-0 pt-6" aria-label="Top three">
      <div className="mx-auto grid max-w-xl grid-cols-3 items-end gap-3">
        {places.map((i) => {
          const row = rows[i]
          const name = nameOf(row.playerId)
          return (
            <div key={row.playerId} className="flex flex-col items-center gap-2 text-center text-[#f2e6cf]">
              {i === 0 && <Crown className="size-6 text-primary" aria-hidden />}
              <Avatar className={cn('ring-2 ring-[#1b120d]', i === 0 ? 'size-16 ring-primary' : 'size-12')}>
                <AvatarImage src={imageOf(row.playerId)} />
                <AvatarFallback className="font-semibold text-[#22150c]" style={{ background: getUserColor(row.playerId) }}>
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="w-full truncate text-sm font-semibold">{name}</span>
              <div
                className={cn(
                  'flex w-full flex-col items-center justify-start gap-1 rounded-t-xl bg-rail/90 pt-2 shadow-[inset_0_1px_0_rgba(217,164,65,0.6)]',
                  heights[i],
                )}
              >
                <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-bold', row.netCents > 0 ? MEDALS[i] : 'bg-muted text-muted-foreground')}>
                  {i + 1}
                </span>
                <span className={cn('font-display text-base font-bold', row.netCents > 0 ? 'text-success' : row.netCents < 0 ? 'text-destructive' : '')}>
                  {formatCents(row.netCents, { signed: true })}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StandingRow({
  row,
  rank,
  name,
  imageUrl,
  isYou,
  stats,
}: {
  row: LifetimeRow
  rank: number
  name: string
  imageUrl: string | undefined
  isYou: boolean
  stats: PlayerStats
}) {
  // Medals are for winners only: third place can still be down money.
  const medal = row.netCents > 0 ? MEDALS[rank - 1] : undefined
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', isYou && 'bg-primary/5')}>
      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', medal ?? 'text-muted-foreground')}>
        {rank}
      </span>
      <Avatar className={cn('size-9', isYou && 'ring-2 ring-primary')}>
        <AvatarImage src={imageUrl} />
        <AvatarFallback className="text-xs font-semibold text-[#22150c]" style={{ background: getUserColor(row.playerId) }}>
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {name}
          {isYou && ' (you)'}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {row.games} game{row.games === 1 ? '' : 's'}
          <span className="inline-flex gap-1" aria-label={`Last ${stats.form.length}: ${stats.form.join(', ')}`}>
            {stats.form.map((r, i) => (
              <span key={i} className={cn('size-2 rounded-full', FORM_COLOR[r])} />
            ))}
          </span>
          {stats.streak && stats.streak.count > 1 && (
            <span className={cn('rounded-full px-1.5 py-px font-medium', stats.streak.result === 'up' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
              {stats.streak.count} {stats.streak.result} in a row
            </span>
          )}
        </span>
      </span>
      <span className={cn('font-display text-lg font-bold', pnlColor(row.netCents))}>{formatCents(row.netCents, { signed: true })}</span>
    </li>
  )
}

function pnlColor(cents: number) {
  if (cents > 0) return 'text-success'
  if (cents < 0) return 'text-destructive'
  return undefined
}

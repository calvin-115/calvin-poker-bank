import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUserColor, useQuery, type RecordData } from 'deepspace'
import { GameStatusBadge } from '@/components/GameStatusBadge'
import { Button, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatCents } from '@/lib/poker'
import { usePeople } from '@/lib/use-people'
import { FELTS, type Felt, type Game } from '@/schemas/games-schema'
import type { Player } from '@/schemas/players-schema'

export default function GamesPage() {
  const navigate = useNavigate()
  const { error } = useToast()
  const { nameOf } = usePeople()
  const { records: games, status } = useQuery<Game>('games', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: players } = useQuery<Player>('players')

  const [name, setName] = useState('')
  const [felt, setFelt] = useState<Felt>('green')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  // Hosting and joining go through server actions so join codes never reach
  // people who aren't in the game (see src/actions).
  async function enterGame(action: 'hostGame' | 'joinGame', params: Record<string, unknown>, failure: string) {
    setBusy(true)
    try {
      const { gameId } = await callAction<{ gameId: string }>(action, params)
      navigate(`/games/${gameId}`)
    } catch (err) {
      error(failure, err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    enterGame('hostGame', { name: name.trim(), felt }, 'Could not create game')
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault()
    enterGame('joinGame', { code }, 'Could not join game')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-foreground sm:px-6 lg:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">Games</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4 sm:grid-cols-2 lg:sticky lg:top-6 lg:grid-cols-1">
          <form onSubmit={handleJoin} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl font-bold">Join a game</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Ask the host for the 6-character code.</p>
            <Label htmlFor="join-code" className="sr-only">Game code</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              className="mt-4 h-14 border-2 border-dashed border-primary/50 bg-background/60 text-center font-mono text-2xl uppercase tracking-[0.35em] text-primary md:text-2xl"
              required
            />
            <Button type="submit" className="mt-3 h-11 w-full" disabled={busy || !code.trim()}>
              Join game
            </Button>
          </form>

          <form onSubmit={handleCreate} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl font-bold">Host a game</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">You run the bank and approve buy-ins.</p>
            <Label htmlFor="game-name" className="sr-only">Game name</Label>
            <Input
              id="game-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday night"
              maxLength={80}
              className="mt-4 h-12"
              required
            />
            <fieldset className="mt-3 flex items-center gap-3">
              <legend className="sr-only">Felt color</legend>
              <span className="text-xs text-muted-foreground" aria-hidden>Felt</span>
              {FELTS.map((f) => (
                <label key={f} className="cursor-pointer">
                  <input
                    type="radio"
                    name="felt"
                    value={f}
                    checked={felt === f}
                    onChange={() => setFelt(f)}
                    className="peer sr-only"
                  />
                  <span
                    data-felt={f}
                    title={`${f[0].toUpperCase()}${f.slice(1)} felt`}
                    className="felt block size-8 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-card transition peer-checked:ring-primary peer-focus-visible:ring-ring"
                  />
                  <span className="sr-only">{f}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" variant="secondary" className="mt-4 h-11 w-full" disabled={busy || !name.trim()}>
              Create game
            </Button>
          </form>
        </div>

        <section>
          <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">Tables</h2>
          {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
          {status === 'ready' && games.length === 0 && (
            <p className="text-sm text-muted-foreground">No games yet. Host the first one.</p>
          )}
          {games.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {games.map((g) => (
                <li key={g.recordId}>
                  <GameCard
                    game={g}
                    hostName={nameOf(g.createdBy)}
                    playerIds={players.filter((p) => p.data.gameId === g.recordId).map((p) => p.data.userId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function GameCard({ game, hostName, playerIds }: { game: RecordData<Game>; hostName: string; playerIds: string[] }) {
  const potCents = game.data.entries.filter((e) => e.type === 'buyin').reduce((sum, e) => sum + e.amountCents, 0)
  const shownSeats = playerIds.slice(0, 10)
  return (
    <Link
      to={`/games/${game.recordId}`}
      data-felt={game.data.felt ?? 'green'}
      className="group block rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.7)]"
    >
      <div className="relative mx-auto aspect-[2/1] w-[88%]">
        <div className="felt felt-ring absolute inset-0 rounded-[50%]" />
        <span className="absolute inset-0 grid place-items-center font-display text-2xl font-bold text-[#f2e6cf]">
          {formatCents(potCents)}
        </span>
        {shownSeats.map((playerId, i) => {
          const angle = Math.PI / 2 + (i * 2 * Math.PI) / shownSeats.length
          return (
            <span
              key={playerId}
              className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
              style={{
                left: `${50 + 52 * Math.cos(angle)}%`,
                top: `${50 + 56 * Math.sin(angle)}%`,
                background: getUserColor(playerId),
              }}
            />
          )
        })}
      </div>
      <div className="mt-4 flex items-start justify-between gap-2 px-1">
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-bold">{game.data.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {hostName} · {playerIds.length} player{playerIds.length === 1 ? '' : 's'}
          </span>
        </span>
        <GameStatusBadge status={game.data.status} />
      </div>
    </Link>
  )
}

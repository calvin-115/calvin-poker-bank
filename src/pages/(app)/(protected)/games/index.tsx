import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useMutations, useQuery, useUserLookup } from 'deepspace'
import { ChevronRight } from 'lucide-react'
import { GameStatusBadge } from '@/components/GameStatusBadge'
import { Button, Input, Label, useToast } from '@/components/ui'
import type { Game } from '@/schemas/games-schema'
import type { Player } from '@/schemas/players-schema'

// No 0/O or 1/I, so codes read cleanly across a table.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export default function GamesPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { error } = useToast()
  const { getName } = useUserLookup()
  const { records: games, status } = useQuery<Game>('games', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: players } = useQuery<Player>('players')
  const gameMutations = useMutations<Game>('games')
  const playerMutations = useMutations<Player>('players')
  const ready = gameMutations.ready && playerMutations.ready

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    try {
      const gameId = await gameMutations.createConfirmed({
        name: name.trim(),
        code: generateCode(),
        status: 'open',
        entries: [],
      })
      await playerMutations.createConfirmed({ gameId, userId })
      navigate(`/games/${gameId}`)
    } catch (err) {
      error('Could not create game', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    const game = games.find((g) => g.data.code === code.trim().toUpperCase())
    if (!game) {
      error('No game with that code')
      return
    }
    if (game.data.status === 'closed') {
      error('That game is closed')
      return
    }
    const alreadyJoined = players.some((p) => p.data.gameId === game.recordId && p.data.userId === userId)
    setBusy(true)
    try {
      if (!alreadyJoined) {
        await playerMutations.createConfirmed({ gameId: game.recordId, userId })
      }
      navigate(`/games/${game.recordId}`)
    } catch (err) {
      error('Could not join game', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Games</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <form onSubmit={handleJoin} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Join a game</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Ask the host for the 6-character code.</p>
          <Label htmlFor="join-code" className="sr-only">Game code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
            maxLength={6}
            autoComplete="off"
            className="mt-4 h-12 text-center font-mono text-xl uppercase tracking-[0.3em] md:text-xl"
            required
          />
          <Button type="submit" className="mt-3 h-11 w-full" disabled={!ready || busy || !code.trim()}>
            Join game
          </Button>
        </form>

        <form onSubmit={handleCreate} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Host a game</h2>
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
          <Button type="submit" variant="secondary" className="mt-3 h-11 w-full" disabled={!ready || busy || !name.trim()}>
            Create game
          </Button>
        </form>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-medium text-muted-foreground">All games</h2>
      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'ready' && games.length === 0 && (
        <p className="text-sm text-muted-foreground">No games yet. Host the first one.</p>
      )}
      {games.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {games.map((g) => {
            const playerCount = players.filter((p) => p.data.gameId === g.recordId).length
            return (
              <li key={g.recordId}>
                <Link to={`/games/${g.recordId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.data.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {getName(g.createdBy) ?? 'Unknown'} · {playerCount} player{playerCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <GameStatusBadge status={g.data.status} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

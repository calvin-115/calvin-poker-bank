import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useMutations, useQuery, useUserLookup } from 'deepspace'
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
    <div className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Games</h1>

      <div className="mb-10 grid gap-6 sm:grid-cols-2">
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Host a game</h2>
          <Label htmlFor="game-name">Game name</Label>
          <Input
            id="game-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday night"
            maxLength={80}
            required
          />
          <Button type="submit" className="mt-4 w-full" disabled={!ready || busy || !name.trim()}>
            Create game
          </Button>
        </form>

        <form onSubmit={handleJoin} className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Join a game</h2>
          <Label htmlFor="join-code">Game code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
            maxLength={6}
            className="uppercase"
            required
          />
          <Button type="submit" className="mt-4 w-full" disabled={!ready || busy || !code.trim()}>
            Join game
          </Button>
        </form>
      </div>

      <h2 className="mb-3 text-lg font-semibold">All games</h2>
      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'ready' && games.length === 0 && (
        <p className="text-sm text-muted-foreground">No games yet. Host the first one.</p>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {games.map((g) => (
          <li key={g.recordId}>
            <Link to={`/games/${g.recordId}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted">
              <span>
                <span className="font-medium">{g.data.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  hosted by {getName(g.createdBy) ?? 'Unknown'}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{g.data.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

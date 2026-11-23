import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useMutations, useQuery, useUser, useUserLookup } from 'deepspace'
import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatCents, ledgerSummary, parseDollars, playerTotals, settle, type PlayerTotal } from '@/lib/poker'
import type { Entry, EntryType, Game } from '@/schemas/games-schema'
import type { Player } from '@/schemas/players-schema'

export default function GamePage() {
  const { id } = useParams()
  const { userId } = useAuth()
  const { user } = useUser()
  const { getName } = useUserLookup()
  const { records: games, status } = useQuery<Game>('games')
  const { records: players } = useQuery<Player>('players', { where: { gameId: id } })
  const { put, ready } = useMutations<Game>('games')

  const game = games.find((g) => g.recordId === id)

  if (status === 'loading') {
    return <p className="px-6 py-12 text-muted-foreground">Loading…</p>
  }
  if (!game) {
    return (
      <div className="px-6 py-12 text-foreground">
        <p>Game not found.</p>
        <Link to="/games" className="text-sm underline">Back to games</Link>
      </div>
    )
  }

  const isHost = game.createdBy === userId
  const isOpen = game.data.status === 'open'
  // The server enforces this too: only the host ('own') or an admin can write a game.
  const canManage = ready && (isHost || user?.role === 'admin')
  const canEdit = canManage && isOpen

  const entries = game.data.entries
  const totals = playerTotals(players.map((p) => p.data.userId), entries)
  const summary = ledgerSummary(totals)
  const nameOf = (playerId: string) => `${getName(playerId) ?? 'Unknown'}${playerId === userId ? ' (you)' : ''}`

  function saveEntries(next: Entry[]) {
    put(game!.recordId, { entries: next })
  }

  function addEntry(playerId: string, type: EntryType, amountCents: number) {
    const entry: Entry = { id: crypto.randomUUID(), playerId, type, amountCents, at: new Date().toISOString() }
    // A player has one cash-out; setting it again replaces the old one.
    const kept = type === 'cashout' ? entries.filter((e) => !(e.playerId === playerId && e.type === 'cashout')) : entries
    saveEntries([...kept, entry])
  }

  function setStatus(next: Game['status']) {
    put(game!.recordId, next === 'closed' ? { status: next, closedAt: new Date().toISOString() } : { status: next })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <Link to="/games" className="text-sm text-muted-foreground hover:text-foreground">← All games</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{game.data.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosted by {nameOf(game.createdBy)} · <span data-testid="game-status">{game.data.status}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Join code</p>
          <p data-testid="game-code" className="font-mono text-2xl tracking-widest">{game.data.code}</p>
        </div>
      </div>

      <section className="mt-8 overflow-x-auto rounded-lg border border-border">
        <table data-testid="ledger" className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 text-right font-medium">Bought in</th>
              <th className="px-4 py-2 text-right font-medium">Cashed out</th>
              <th className="px-4 py-2 text-right font-medium">Net</th>
              {canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {totals.map((t) => (
              <PlayerRow
                key={t.playerId}
                total={t}
                name={nameOf(t.playerId)}
                isHostRow={t.playerId === game.createdBy}
                canEdit={canEdit}
                onAdd={addEntry}
              />
            ))}
          </tbody>
          <tfoot className="border-t border-border font-medium">
            <tr>
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{formatCents(summary.totalInCents)}</td>
              <td className="px-4 py-2 text-right">{formatCents(summary.totalOutCents)}</td>
              <td className="px-4 py-2" colSpan={canEdit ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </section>

      <MismatchBanner summary={summary} nameOf={nameOf} hasCashouts={totals.some((t) => t.cashoutCents !== null)} />

      {canManage && (
        <div className="mt-6 flex items-center gap-3">
          {isOpen ? (
            <Button onClick={() => setStatus('closed')} disabled={!summary.canClose}>
              Close game
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStatus('open')}>
              Reopen game
            </Button>
          )}
          {isOpen && !summary.canClose && (
            <span className="text-sm text-muted-foreground">Closing needs every cash-out entered and the totals to match.</span>
          )}
        </div>
      )}

      {(summary.canClose || !isOpen) && <Settlement totals={totals} nameOf={nameOf} closed={!isOpen} />}

      <EntryLog entries={entries} nameOf={nameOf} canEdit={canEdit} onRemove={(entryId) => saveEntries(entries.filter((e) => e.id !== entryId))} />
    </div>
  )
}

function PlayerRow({
  total,
  name,
  isHostRow,
  canEdit,
  onAdd,
}: {
  total: PlayerTotal
  name: string
  isHostRow: boolean
  canEdit: boolean
  onAdd: (playerId: string, type: EntryType, amountCents: number) => void
}) {
  const [buyin, setBuyin] = useState('')
  const [cashout, setCashout] = useState('')

  function submit(e: FormEvent, type: EntryType) {
    e.preventDefault()
    const cents = parseDollars(type === 'buyin' ? buyin : cashout)
    if (cents === null || (type === 'buyin' && cents === 0)) return
    onAdd(total.playerId, type, cents)
    if (type === 'buyin') setBuyin('')
    else setCashout('')
  }

  return (
    <tr data-testid="ledger-row">
      <td className="px-4 py-2">
        {name}
        {isHostRow && <span className="ml-2 text-xs text-muted-foreground">host</span>}
      </td>
      <td className="px-4 py-2 text-right">{formatCents(total.buyinCents)}</td>
      <td className="px-4 py-2 text-right">{total.cashoutCents === null ? '—' : formatCents(total.cashoutCents)}</td>
      <td
        className={cn(
          'px-4 py-2 text-right font-medium',
          total.cashoutCents !== null && total.netCents > 0 && 'text-success',
          total.cashoutCents !== null && total.netCents < 0 && 'text-destructive',
        )}
      >
        {total.cashoutCents === null ? '—' : formatCents(total.netCents, { signed: true })}
      </td>
      {canEdit && (
        <td className="px-4 py-2">
          <div className="flex justify-end gap-2">
            <form onSubmit={(e) => submit(e, 'buyin')} className="flex gap-1">
              <Input
                aria-label={`Buy-in amount for ${name}`}
                inputMode="decimal"
                value={buyin}
                onChange={(e) => setBuyin(e.target.value)}
                placeholder="$"
                className="h-8 w-20"
              />
              <Button type="submit" size="sm" variant="secondary">Buy in</Button>
            </form>
            <form onSubmit={(e) => submit(e, 'cashout')} className="flex gap-1">
              <Input
                aria-label={`Cash-out chips for ${name}`}
                inputMode="decimal"
                value={cashout}
                onChange={(e) => setCashout(e.target.value)}
                placeholder="chips"
                className="h-8 w-20"
              />
              <Button type="submit" size="sm" variant="secondary">Cash out</Button>
            </form>
          </div>
        </td>
      )}
    </tr>
  )
}

function MismatchBanner({
  summary,
  nameOf,
  hasCashouts,
}: {
  summary: ReturnType<typeof ledgerSummary>
  nameOf: (id: string) => string
  hasCashouts: boolean
}) {
  if (!hasCashouts) return null
  if (summary.waitingOn.length > 0) {
    return (
      <p className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm">
        Waiting on cash-outs from {summary.waitingOn.map(nameOf).join(', ')}.
      </p>
    )
  }
  if (summary.differenceCents !== 0) {
    const direction = summary.differenceCents > 0 ? 'more' : 'less'
    return (
      <p data-testid="mismatch" className="mt-4 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Cash-outs don't match buy-ins: {formatCents(Math.abs(summary.differenceCents))} {direction} in chips than was bought in. Recount the stacks.
      </p>
    )
  }
  return null
}

function Settlement({ totals, nameOf, closed }: { totals: PlayerTotal[]; nameOf: (id: string) => string; closed: boolean }) {
  const payments = settle(totals)
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{closed ? 'Settle up' : 'Settle up (preview)'}</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everyone broke even. Nothing to pay.</p>
      ) : (
        <ul data-testid="settlement" className="divide-y divide-border rounded-lg border border-border">
          {payments.map((p) => (
            <li key={`${p.from}-${p.to}`} className="flex justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{nameOf(p.from)}</span> pays <span className="font-medium">{nameOf(p.to)}</span>
              </span>
              <span className="font-medium">{formatCents(p.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function EntryLog({
  entries,
  nameOf,
  canEdit,
  onRemove,
}: {
  entries: Entry[]
  nameOf: (id: string) => string
  canEdit: boolean
  onRemove: (entryId: string) => void
}) {
  if (entries.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Activity</h2>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {[...entries].reverse().map((e) => (
          <li key={e.id} className="flex items-center justify-between px-4 py-2">
            <span>
              <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>{' '}
              {nameOf(e.playerId)} {e.type === 'buyin' ? 'bought in' : 'cashed out'} {formatCents(e.amountCents)}
            </span>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => onRemove(e.id)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

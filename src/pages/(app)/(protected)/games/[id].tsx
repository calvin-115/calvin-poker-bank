import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useMutations, useQuery, useUser, useUserLookup, type RecordData } from 'deepspace'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { GameStatusBadge } from '@/components/GameStatusBadge'
import { Avatar, AvatarFallback, AvatarImage, Button, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatCents, ledgerSummary, parseDollars, playerTotals, settle, type PlayerTotal } from '@/lib/poker'
import type { BuyinRequest } from '@/schemas/buyin-requests-schema'
import type { Entry, EntryType, Game } from '@/schemas/games-schema'
import type { Player } from '@/schemas/players-schema'

export default function GamePage() {
  const { id } = useParams()
  const { userId } = useAuth()
  const { user } = useUser()
  const { getName, getUser } = useUserLookup()
  const { records: games, status } = useQuery<Game>('games')
  const { records: players } = useQuery<Player>('players', { where: { gameId: id } })
  const { put, ready } = useMutations<Game>('games')
  const { records: requests } = useQuery<BuyinRequest>('buyinRequests', { where: { gameId: id } })
  const requestMutations = useMutations<BuyinRequest>('buyinRequests')
  const { error } = useToast()

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

  const isPlayer = players.some((p) => p.data.userId === userId)
  const approvedIds = new Set(entries.flatMap((e) => (e.requestId ? [e.requestId] : [])))
  const declinedIds = new Set(game.data.declinedRequestIds ?? [])
  const unapproved = requests.filter((r) => !approvedIds.has(r.recordId))
  const pending = unapproved.filter((r) => !declinedIds.has(r.recordId))
  const myRequests = unapproved.filter((r) => r.data.userId === userId)

  function saveEntries(next: Entry[]) {
    put(game!.recordId, { entries: next })
  }

  function addEntry(playerId: string, type: EntryType, amountCents: number, requestId?: string) {
    const entry: Entry = { id: crypto.randomUUID(), playerId, type, amountCents, at: new Date().toISOString(), requestId }
    // A player has one cash-out; setting it again replaces the old one.
    const kept = type === 'cashout' ? entries.filter((e) => !(e.playerId === playerId && e.type === 'cashout')) : entries
    saveEntries([...kept, entry])
  }

  function removeEntry(entryId: string) {
    const removed = entries.find((e) => e.id === entryId)
    const next = entries.filter((e) => e.id !== entryId)
    // Without this, removing an approved buy-in would send its request back to pending.
    put(
      game!.recordId,
      removed?.requestId ? { entries: next, declinedRequestIds: [...declinedIds, removed.requestId] } : { entries: next },
    )
  }

  function declineRequest(requestId: string) {
    put(game!.recordId, { declinedRequestIds: [...declinedIds, requestId] })
  }

  async function requestBuyin(amountCents: number) {
    if (!userId) return
    try {
      await requestMutations.createConfirmed({ gameId: game!.recordId, userId, amountCents })
    } catch (err) {
      error('Could not send request', err instanceof Error ? err.message : undefined)
    }
  }

  function setStatus(next: Game['status']) {
    put(game!.recordId, next === 'closed' ? { status: next, closedAt: new Date().toISOString() } : { status: next })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        All games
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{game.data.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <GameStatusBadge data-testid="game-status" status={game.data.status} />
            Hosted by {nameOf(game.createdBy)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Join code</p>
          <p data-testid="game-code" className="font-mono text-xl font-semibold tracking-[0.2em]">{game.data.code}</p>
        </div>
      </header>

      {canEdit && pending.length > 0 && (
        <PendingRequests
          requests={pending}
          nameOf={nameOf}
          onApprove={(r) => addEntry(r.data.userId, 'buyin', r.data.amountCents, r.recordId)}
          onDecline={declineRequest}
        />
      )}

      {isOpen && isPlayer && !canManage && (
        <RequestBuyin
          requests={myRequests}
          declinedIds={declinedIds}
          disabled={!requestMutations.ready}
          onRequest={requestBuyin}
          onRemove={(requestId) => requestMutations.remove(requestId)}
        />
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Pot</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatCents(summary.totalInCents)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Players</dt>
            <dd className="mt-0.5 font-medium">{totals.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cashed out</dt>
            <dd className="mt-0.5 font-medium">{formatCents(summary.totalOutCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Players</h2>
        <ul data-testid="player-list" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {totals.map((t) => (
            <PlayerRow
              key={t.playerId}
              total={t}
              name={nameOf(t.playerId)}
              imageUrl={getUser(t.playerId)?.imageUrl}
              isHostRow={t.playerId === game.createdBy}
              isYou={t.playerId === userId}
              canEdit={canEdit}
              onAdd={addEntry}
            />
          ))}
        </ul>
      </section>

      <MismatchBanner summary={summary} nameOf={nameOf} hasCashouts={totals.some((t) => t.cashoutCents !== null)} />

      {canManage && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {isOpen ? (
            <Button onClick={() => setStatus('closed')} disabled={!summary.canClose} className="w-full sm:w-auto">
              Close game
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStatus('open')} className="w-full sm:w-auto">
              Reopen game
            </Button>
          )}
          {isOpen && !summary.canClose && (
            <span className="text-sm text-muted-foreground">Closing needs every cash-out entered and the totals to match.</span>
          )}
        </div>
      )}

      {(summary.canClose || !isOpen) && <Settlement totals={totals} nameOf={nameOf} closed={!isOpen} />}

      <EntryLog entries={entries} nameOf={nameOf} canEdit={canEdit} onRemove={removeEntry} />
    </div>
  )
}

function PendingRequests({
  requests,
  nameOf,
  onApprove,
  onDecline,
}: {
  requests: RecordData<BuyinRequest>[]
  nameOf: (id: string) => string
  onApprove: (request: RecordData<BuyinRequest>) => void
  onDecline: (requestId: string) => void
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Buy-in requests</h2>
      <ul data-testid="buyin-requests" className="divide-y divide-border overflow-hidden rounded-2xl border border-warning/40 bg-card">
        {requests.map((r) => (
          <li key={r.recordId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium">{nameOf(r.data.userId)}</span>{' '}
              <span className="text-base font-semibold">{formatCents(r.data.amountCents)}</span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Button size="sm" variant="ghost" onClick={() => onDecline(r.recordId)}>Decline</Button>
              <Button size="sm" onClick={() => onApprove(r)}>Approve</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RequestBuyin({
  requests,
  declinedIds,
  disabled,
  onRequest,
  onRemove,
}: {
  requests: RecordData<BuyinRequest>[]
  declinedIds: Set<string>
  disabled: boolean
  onRequest: (amountCents: number) => void
  onRemove: (requestId: string) => void
}) {
  const [amount, setAmount] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const cents = parseDollars(amount)
    if (cents === null || cents === 0) return
    onRequest(cents)
    setAmount('')
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Need chips?</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">The host approves each buy-in before it goes in the ledger.</p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          aria-label="Buy-in request amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="$"
          className="min-w-0"
        />
        <Button type="submit" disabled={disabled}>Request buy-in</Button>
      </form>
      {requests.length > 0 && (
        <ul data-testid="my-requests" className="mt-3 divide-y divide-border border-t border-border text-sm">
          {requests.map((r) => {
            const declined = declinedIds.has(r.recordId)
            return (
              <li key={r.recordId} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{formatCents(r.data.amountCents)}</span>
                  <span className={cn('ml-2 text-xs', declined ? 'text-destructive' : 'text-muted-foreground')}>
                    {declined ? 'Declined' : 'Waiting for host'}
                  </span>
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRemove(r.recordId)}>
                  {declined ? 'Dismiss' : 'Cancel'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PlayerRow({
  total,
  name,
  imageUrl,
  isHostRow,
  isYou,
  canEdit,
  onAdd,
}: {
  total: PlayerTotal
  name: string
  imageUrl: string | undefined
  isHostRow: boolean
  isYou: boolean
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

  const cashedOut = total.cashoutCents !== null

  return (
    <li data-testid="ledger-row" className={cn('px-4 py-3', isYou && 'bg-accent/40')}>
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarImage src={imageUrl} />
          <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {name}
            {isHostRow && <span className="ml-2 text-xs font-normal text-muted-foreground">host</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            In {formatCents(total.buyinCents)} · Out {total.cashoutCents === null ? '—' : formatCents(total.cashoutCents)}
          </p>
        </div>
        <p
          className={cn(
            'text-base font-semibold',
            cashedOut && total.netCents > 0 && 'text-success',
            cashedOut && total.netCents < 0 && 'text-destructive',
            !cashedOut && 'text-muted-foreground',
          )}
        >
          {cashedOut ? formatCents(total.netCents, { signed: true }) : '—'}
        </p>
      </div>
      {canEdit && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:pl-12">
          <form onSubmit={(e) => submit(e, 'buyin')} className="flex gap-1.5">
            <Input
              aria-label={`Buy-in amount for ${name}`}
              inputMode="decimal"
              value={buyin}
              onChange={(e) => setBuyin(e.target.value)}
              placeholder="$"
              className="h-9 min-w-0"
            />
            <Button type="submit" size="sm" variant="secondary">Buy in</Button>
          </form>
          <form onSubmit={(e) => submit(e, 'cashout')} className="flex gap-1.5">
            <Input
              aria-label={`Cash-out chips for ${name}`}
              inputMode="decimal"
              value={cashout}
              onChange={(e) => setCashout(e.target.value)}
              placeholder="chips"
              className="h-9 min-w-0"
            />
            <Button type="submit" size="sm" variant="secondary">Cash out</Button>
          </form>
        </div>
      )}
    </li>
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
      <p className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
        Waiting on cash-outs from {summary.waitingOn.map(nameOf).join(', ')}.
      </p>
    )
  }
  if (summary.differenceCents !== 0) {
    const direction = summary.differenceCents > 0 ? 'more' : 'less'
    return (
      <p data-testid="mismatch" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{closed ? 'Settle up' : 'Settle up (preview)'}</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everyone broke even. Nothing to pay.</p>
      ) : (
        <ul data-testid="settlement" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {payments.map((p) => (
            <li key={`${p.from}-${p.to}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{nameOf(p.from)}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">pays</span>
                <span className="truncate font-medium">{nameOf(p.to)}</span>
              </span>
              <span className="text-base font-semibold">{formatCents(p.amountCents)}</span>
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
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Activity</h2>
      <ul className="divide-y divide-border rounded-2xl border border-border text-xs text-muted-foreground">
        {[...entries].reverse().map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <span>
              <span className="mr-2">{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              <span className="text-foreground">{nameOf(e.playerId)}</span> {e.type === 'buyin' ? 'bought in' : 'cashed out'} {formatCents(e.amountCents)}
            </span>
            {canEdit && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRemove(e.id)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

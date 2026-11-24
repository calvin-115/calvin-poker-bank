import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUserColor, useAuth, useMutations, useQuery, useUser, type RecordData } from 'deepspace'
import { AlertTriangle, ArrowRight, Check, ChevronLeft, Coins, Crown } from 'lucide-react'
import { AnimatedCents } from '@/components/AnimatedCents'
import { GameStatusBadge } from '@/components/GameStatusBadge'
import { PokerTable, type TableSeat } from '@/components/PokerTable'
import { Avatar, AvatarFallback, AvatarImage, Button, buttonVariants, Input, Modal, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { usePeople } from '@/lib/use-people'
import { venmoPayUrl } from '@/lib/venmo'
import {
  finalTotals,
  formatCents,
  ledgerSummary,
  parseDollars,
  playerTotals,
  settledTotals,
  type FinalTotal,
  type PlayerTotal,
} from '@/lib/poker'
import type { BuyinRequest } from '@/schemas/buyin-requests-schema'
import type { GameCode } from '@/schemas/game-codes-schema'
import { MISCOUNT_METHODS, type Entry, type EntryType, type Game, type MiscountMethod } from '@/schemas/games-schema'
import type { Player } from '@/schemas/players-schema'

export default function GamePage() {
  const { id } = useParams()
  const { userId } = useAuth()
  const { user } = useUser()
  const { nameOf: displayName, imageOf, venmoOf } = usePeople()
  const { records: games, status } = useQuery<Game>('games')
  const { records: players } = useQuery<Player>('players', { where: { gameId: id } })
  const { put, ready } = useMutations<Game>('games')
  const { records: requests } = useQuery<BuyinRequest>('buyinRequests', { where: { gameId: id } })
  const { records: codes } = useQuery<GameCode>('gameCodes', { where: { gameId: id } })
  const requestMutations = useMutations<BuyinRequest>('buyinRequests')
  const { error } = useToast()
  const [chosenMethod, setChosenMethod] = useState<MiscountMethod>()

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
  const nameOf = (playerId: string) => `${displayName(playerId)}${playerId === userId ? ' (you)' : ''}`

  const isPlayer = players.some((p) => p.data.userId === userId)
  // The server only returns a code row to the game's players and admins. Old
  // games keep their code on the game until an admin secures it from /admin.
  const joinCode = codes[0]?.data.code ?? (isPlayer ? game.data.code : null)
  const approvedIds = new Set(entries.flatMap((e) => (e.requestId ? [e.requestId] : [])))
  const declinedIds = new Set(game.data.declinedRequestIds ?? [])
  const unapproved = requests.filter((r) => !approvedIds.has(r.recordId))
  const pending = unapproved.filter((r) => !declinedIds.has(r.recordId))
  const myRequests = unapproved.filter((r) => r.data.userId === userId)
  const paidPayments = new Set(game.data.paidPayments ?? [])

  // Open games preview the host's pick. Closed games settle exactly as the leaderboard does.
  const final = isOpen
    ? finalTotals(totals, game.createdBy, chosenMethod)
    : settledTotals(totals, game.createdBy, game.data.miscountMethod)
  // Null while the count is off and nothing is picked yet: show the count as entered.
  const shown: FinalTotal[] = final ?? totals.map((t) => ({ ...t, adjustmentCents: 0, payoutCents: t.cashoutCents ?? 0 }))
  const countIsOff = summary.allCashedOut && summary.differenceCents !== 0
  const canCloseNow = summary.allCashedOut && final !== null

  const seats: TableSeat[] = shown.map((t) => ({
    playerId: t.playerId,
    name: displayName(t.playerId),
    color: getUserColor(t.playerId),
    imageUrl: imageOf(t.playerId),
    caption: t.cashoutCents === null ? `in ${formatCents(t.buyinCents)}` : formatCents(t.netCents, { signed: true }),
    tone: t.cashoutCents === null || t.netCents === 0 ? 'neutral' : t.netCents > 0 ? 'up' : 'down',
    isYou: t.playerId === userId,
    buyinCents: t.buyinCents,
  }))
  const winner = [...shown].sort((a, b) => b.netCents - a.netCents)[0]

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

  function togglePaid(key: string) {
    const next = paidPayments.has(key) ? [...paidPayments].filter((k) => k !== key) : [...paidPayments, key]
    put(game!.recordId, { paidPayments: next })
  }

  /** Resolves true once the server has the request, so the pay prompt only opens for a real request. */
  async function requestBuyin(amountCents: number) {
    if (!userId) return false
    try {
      await requestMutations.createConfirmed({ gameId: game!.recordId, userId, amountCents })
      return true
    } catch (err) {
      error('Could not send request', err instanceof Error ? err.message : undefined)
      return false
    }
  }

  function closeGame() {
    put(game!.recordId, {
      status: 'closed',
      closedAt: new Date().toISOString(),
      ...(countIsOff ? { miscountMethod: chosenMethod } : {}),
    })
  }

  function reopenGame() {
    setChosenMethod(undefined)
    put(game!.recordId, { status: 'open' })
  }

  return (
    <div data-felt={game.data.felt ?? 'green'} className="mx-auto max-w-6xl px-4 py-6 text-foreground sm:px-6 lg:py-10">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        All games
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold tracking-tight lg:text-4xl">{game.data.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <GameStatusBadge data-testid="game-status" status={game.data.status} />
            Hosted by {nameOf(game.createdBy)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-primary/40 bg-card px-4 py-2 text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Join code</p>
          {joinCode ? (
            <p data-testid="game-code" className="font-mono text-xl font-semibold tracking-[0.25em] text-primary lg:text-2xl">
              {joinCode}
            </p>
          ) : (
            <p className="py-1 text-sm text-muted-foreground">Players only</p>
          )}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-4 lg:col-start-1 lg:row-start-1">
          {!isOpen && winner && (
            <Recap gameId={game.recordId} winnerName={nameOf(winner.playerId)} winnerCents={winner.netCents} potCents={summary.totalInCents} playerCount={totals.length} />
          )}
          <PokerTable seats={seats} potCents={summary.totalInCents} />
        </div>

        <aside className="grid gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
              hostName={displayName(game.createdBy)}
              hostVenmo={venmoOf(game.createdBy)}
              note={`${game.data.name} buy-in`}
            />
          )}

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">Bank</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Bought in</dt>
                <dd className="mt-0.5 font-display text-xl font-bold"><AnimatedCents cents={summary.totalInCents} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cashed out</dt>
                <dd className="mt-0.5 font-display text-xl font-bold"><AnimatedCents cents={summary.totalOutCents} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Players</dt>
                <dd className="mt-0.5 font-display text-xl font-bold">{totals.length}</dd>
              </div>
            </dl>
            {!canManage && isOpen && (
              <MismatchBanner summary={summary} nameOf={nameOf} hasCashouts={totals.some((t) => t.cashoutCents !== null)} />
            )}
            {canManage && isOpen && summary.waitingOn.length > 0 && totals.some((t) => t.cashoutCents !== null) && (
              <p className="mt-4 rounded-xl border border-border bg-muted px-3 py-2.5 text-sm">
                Waiting on cash-outs from {summary.waitingOn.map(nameOf).join(', ')}.
              </p>
            )}
            {!isOpen && game.data.miscountMethod && summary.differenceCents !== 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                {summary.differenceCents > 0 ? 'Bank was ' : 'Bank had '}
                {formatCents(Math.abs(summary.differenceCents))} {summary.differenceCents > 0 ? 'short' : 'extra'} ·{' '}
                {METHOD_COPY[game.data.miscountMethod].label.toLowerCase()}
              </p>
            )}
            {canManage && (
              <div className="mt-4 grid gap-2">
                {isOpen ? (
                  <Button onClick={closeGame} disabled={!canCloseNow} className="w-full">
                    Close game
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={reopenGame} className="w-full">
                    Reopen game
                  </Button>
                )}
                {isOpen && !canCloseNow && (
                  <span className="text-xs text-muted-foreground">
                    {summary.allCashedOut
                      ? 'Pick how to settle the miscount below, or fix the cash-outs.'
                      : 'Closing needs every cash-out entered.'}
                  </span>
                )}
              </div>
            )}
          </section>

          {canManage && isOpen && countIsOff && (
            <MiscountPanel
              totals={totals}
              hostId={game.createdBy}
              differenceCents={summary.differenceCents}
              potCents={summary.totalInCents}
              chosen={chosenMethod}
              onChoose={setChosenMethod}
              nameOf={nameOf}
            />
          )}

          {final && (summary.allCashedOut || !isOpen) && (
            <Payouts
              shown={shown}
              hostId={game.createdBy}
              nameOf={nameOf}
              closed={!isOpen}
              paid={paidPayments}
              onTogglePaid={canManage && !isOpen ? togglePaid : undefined}
            />
          )}
        </aside>

        <div className="grid gap-6 lg:col-start-1 lg:row-start-2">
          <section>
            <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">Players</h2>
            <ul data-testid="player-list" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {shown.map((t) => (
                <PlayerRow
                  key={t.playerId}
                  total={t}
                  name={nameOf(t.playerId)}
                  imageUrl={imageOf(t.playerId)}
                  isHostRow={t.playerId === game.createdBy}
                  isYou={t.playerId === userId}
                  canEdit={canEdit}
                  onAdd={addEntry}
                />
              ))}
            </ul>
          </section>

          <EntryLog entries={entries} nameOf={nameOf} canEdit={canEdit} onRemove={removeEntry} />
        </div>
      </div>
    </div>
  )
}

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 6) * 0.18}s`,
  color: ['#c8432e', '#3d6fa3', '#d9a441'][i % 3],
}))

function Recap({
  gameId,
  winnerName,
  winnerCents,
  potCents,
  playerCount,
}: {
  gameId: string
  winnerName: string
  winnerCents: number
  potCents: number
  playerCount: number
}) {
  // Chips rain once per game on this device; the recap itself always shows.
  const seenKey = `poker-bank:recap-seen:${gameId}`
  const [celebrate] = useState(() => localStorage.getItem(seenKey) === null)
  useEffect(() => {
    localStorage.setItem(seenKey, '1')
  }, [seenKey])

  return (
    <section className="felt felt-ring relative overflow-hidden rounded-2xl px-6 py-7 text-center animate-in fade-in-0 zoom-in-95">
      {celebrate && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="animate-confetti absolute top-0 size-3 rounded-full border-2 border-dashed border-[#f2e6cf]"
              style={{ left: c.left, animationDelay: c.delay, background: c.color, '--fall': '260px' } as CSSProperties}
            />
          ))}
        </div>
      )}
      <p className="font-mono text-xs uppercase tracking-widest text-[#f2e6cf]/80">Game closed</p>
      {winnerCents > 0 ? (
        <p className="mt-2 flex items-center justify-center gap-2 font-display text-3xl font-bold text-[#f2e6cf] lg:text-4xl">
          <Crown className="size-7 text-primary" aria-hidden />
          {winnerName} +{formatCents(winnerCents)}
        </p>
      ) : (
        <p className="mt-2 font-display text-3xl font-bold text-[#f2e6cf]">Everyone broke even</p>
      )}
      <p className="mt-1 text-sm text-[#f2e6cf]/80">
        {winnerCents > 0 ? 'Biggest win of the night · ' : ''}
        {playerCount} player{playerCount === 1 ? '' : 's'} · {formatCents(potCents)} pot
      </p>
    </section>
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
    <section className="rounded-2xl border border-primary/50 bg-card p-4">
      <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
        Buy-in requests · {requests.length}
      </h2>
      <ul data-testid="buyin-requests" className="mt-2 divide-y divide-border">
        {requests.map((r) => (
          <li key={r.recordId} className="flex items-center justify-between gap-3 py-2.5 text-sm animate-in fade-in-0 slide-in-from-bottom-2">
            <span className="min-w-0 truncate">
              <span className="font-medium">{nameOf(r.data.userId)}</span>{' '}
              <span className="font-display text-base font-bold">{formatCents(r.data.amountCents)}</span>
            </span>
            <span className="flex shrink-0 gap-1">
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
  hostName,
  hostVenmo,
  note,
}: {
  requests: RecordData<BuyinRequest>[]
  declinedIds: Set<string>
  disabled: boolean
  /** Resolves true when the request was saved. */
  onRequest: (amountCents: number) => Promise<boolean>
  onRemove: (requestId: string) => void
  hostName: string
  /** The host's Venmo username, if they've set one in Settings. */
  hostVenmo: string | undefined
  note: string
}) {
  const [amount, setAmount] = useState('')
  // The amount to pay in the Venmo prompt; undefined while it's closed.
  const [payCents, setPayCents] = useState<number>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cents = parseDollars(amount)
    if (cents === null || cents === 0) return
    setAmount('')
    if ((await onRequest(cents)) && hostVenmo) setPayCents(cents)
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-display text-lg font-bold">Need chips?</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {hostVenmo
          ? `Request an amount, pay ${hostName} on Venmo, and they approve it once it arrives.`
          : `Request an amount and pay ${hostName} directly. They approve it once they have the money.`}
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          aria-label="Buy-in request amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="$"
          className="min-w-0"
        />
        <Button type="submit" disabled={disabled}>
          <Coins aria-hidden />
          Request buy-in
        </Button>
      </form>
      {requests.length > 0 && (
        <ul data-testid="my-requests" className="mt-3 divide-y divide-border border-t border-border text-sm">
          {requests.map((r) => {
            const declined = declinedIds.has(r.recordId)
            return (
              <li key={r.recordId} className="flex items-center justify-between gap-3 py-2 animate-in fade-in-0 slide-in-from-bottom-2">
                <span>
                  <span className="font-medium">{formatCents(r.data.amountCents)}</span>
                  <span className={cn('ml-2 text-xs', declined ? 'text-destructive' : 'text-muted-foreground')}>
                    {declined ? 'Declined' : 'Waiting for host'}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {hostVenmo && !declined && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setPayCents(r.data.amountCents)}>
                      Pay host
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRemove(r.recordId)}>
                    {declined ? 'Dismiss' : 'Cancel'}
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {hostVenmo && (
        <Modal open={payCents !== undefined} onClose={() => setPayCents(undefined)} size="sm">
          <Modal.Header>
            <Modal.Title>
              Pay {hostName} {formatCents(payCents ?? 0)}
            </Modal.Title>
            <Modal.Description>
              Your request is in. Send the buy-in on Venmo and {hostName} will approve it once it arrives.
            </Modal.Description>
          </Modal.Header>
          <Modal.Body>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Venmo</dt>
              <dd className="font-mono">@{hostVenmo}</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-display font-bold">{formatCents(payCents ?? 0)}</dd>
              <dt className="text-muted-foreground">Note</dt>
              <dd>{note}</dd>
            </dl>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setPayCents(undefined)}>
              Done
            </Button>
            <a
              href={venmoPayUrl(hostVenmo, payCents ?? 0, note)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants()}
              onClick={() => setPayCents(undefined)}
            >
              Open Venmo
            </a>
          </Modal.Footer>
        </Modal>
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
  total: FinalTotal
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
    <li data-testid="ledger-row" className={cn('px-4 py-3', isYou && 'bg-primary/5')}>
      <div className="flex items-center gap-3">
        <Avatar className={cn('size-9', isYou && 'ring-2 ring-primary')}>
          <AvatarImage src={imageUrl} />
          <AvatarFallback className="font-semibold text-[#22150c]" style={{ background: getUserColor(total.playerId) }}>
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {name}
            {isHostRow && <span className="ml-2 text-xs font-normal text-muted-foreground">host</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            In {formatCents(total.buyinCents)} · Out {total.cashoutCents === null ? '—' : formatCents(total.cashoutCents)}
            {total.adjustmentCents !== 0 && (
              <span className="text-primary"> · count adjustment {formatCents(total.adjustmentCents, { signed: true })}</span>
            )}
          </p>
        </div>
        <p
          className={cn(
            'font-display text-lg font-bold',
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
      <p className="mt-4 rounded-xl border border-border bg-muted px-3 py-2.5 text-sm">
        Waiting on cash-outs from {summary.waitingOn.map(nameOf).join(', ')}.
      </p>
    )
  }
  if (summary.differenceCents !== 0) {
    const direction = summary.differenceCents > 0 ? 'more' : 'less'
    return (
      <p data-testid="mismatch" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        Cash-outs don't match buy-ins: {formatCents(Math.abs(summary.differenceCents))} {direction} in chips than was bought in. The host
        will recount or choose how to settle it.
      </p>
    )
  }
  return null
}

const METHOD_COPY: Record<MiscountMethod, { label: string; body: string }> = {
  'winners-proportional': { label: 'Winners split it by winnings', body: 'Bigger winners absorb more of it.' },
  'winners-equal': { label: 'Winners split it evenly', body: 'Every winner absorbs the same amount.' },
  'host-covers': { label: 'Host covers it', body: 'The bank absorbs it. Nobody else changes.' },
}

// Above this share of the pot, a miscount is more likely a counting mistake than a lost chip.
const BIG_MISS_SHARE = 0.1

function MiscountPanel({
  totals,
  hostId,
  differenceCents,
  potCents,
  chosen,
  onChoose,
  nameOf,
}: {
  totals: PlayerTotal[]
  hostId: string
  differenceCents: number
  potCents: number
  chosen: MiscountMethod | undefined
  onChoose: (method: MiscountMethod) => void
  nameOf: (id: string) => string
}) {
  const over = differenceCents > 0
  const amount = formatCents(Math.abs(differenceCents))
  const hasWinners = totals.some((t) => t.netCents > 0)

  return (
    <section data-testid="miscount" className="rounded-2xl border border-primary/50 bg-card p-4">
      <h2 className="font-display text-lg font-bold">{over ? `The bank is ${amount} short` : `The bank has ${amount} extra`}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {over
          ? `Players cashed out ${amount} more in chips than was bought in.`
          : `Players cashed out ${amount} less in chips than was bought in.`}{' '}
        Losers already paid, so their amounts stay the same.
      </p>
      {Math.abs(differenceCents) > potCents * BIG_MISS_SHARE && (
        <p className="mt-3 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          That's more than 10% of the pot. Recount the stacks before closing?
        </p>
      )}

      <fieldset className="mt-3 grid gap-2">
        <legend className="sr-only">How to settle the miscount</legend>
        {MISCOUNT_METHODS.map((m) => {
          const preview = finalTotals(totals, hostId, m)
          const changed = preview?.filter((t) => t.adjustmentCents !== 0) ?? []
          return (
            <label
              key={m}
              className={cn(
                'flex gap-3 rounded-xl border p-3 text-sm transition-colors',
                preview ? 'cursor-pointer hover:border-primary/50' : 'cursor-not-allowed opacity-50',
                chosen === m ? 'border-primary bg-primary/10' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="miscount-method"
                value={m}
                checked={chosen === m}
                disabled={!preview}
                onChange={() => onChoose(m)}
                className="mt-1 accent-[var(--color-primary)]"
              />
              <span className="min-w-0">
                <span className="block font-medium">{METHOD_COPY[m].label}</span>
                <span className="block text-xs text-muted-foreground">
                  {preview
                    ? METHOD_COPY[m].body
                    : m === 'host-covers'
                      ? "Not possible: the host isn't seated in this game."
                      : hasWinners
                        ? 'Not possible: a winner would end up below even.'
                        : 'Not possible: nobody finished up.'}
                </span>
                {changed.length > 0 && (
                  <span className="mt-1 block text-xs">
                    {changed.map((t) => `${nameOf(t.playerId)} ${formatCents(t.adjustmentCents, { signed: true })}`).join(' · ')}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </fieldset>
    </section>
  )
}

/** Players paid the host up front, so settling up is the host paying out each player's chips. */
function Payouts({
  shown,
  hostId,
  nameOf,
  closed,
  paid,
  onTogglePaid,
}: {
  shown: FinalTotal[]
  hostId: string
  nameOf: (id: string) => string
  closed: boolean
  paid: Set<string>
  /** Only the host gets this, and only once the game is closed. */
  onTogglePaid?: (key: string) => void
}) {
  const payouts = shown.filter((t) => t.playerId !== hostId && t.payoutCents > 0)
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {closed ? 'Payouts' : 'Payouts (preview)'}
      </h2>
      {payouts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nobody else has chips to cash in.</p>
      ) : (
        <ul data-testid="settlement" className="mt-2 divide-y divide-border">
          {payouts.map((p) => {
            const key = p.playerId
            const isPaid = paid.has(key)
            return (
              <li key={key} className={cn('flex items-center justify-between gap-3 py-2.5 text-sm', isPaid && 'opacity-60')}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{nameOf(hostId)}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="sr-only">pays</span>
                  <span className="truncate font-medium">{nameOf(p.playerId)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={cn('font-display text-base font-bold', isPaid && 'line-through')}>{formatCents(p.payoutCents)}</span>
                  {onTogglePaid ? (
                    <Button
                      size="sm"
                      variant={isPaid ? 'secondary' : 'ghost'}
                      className="h-7 px-2 text-xs"
                      aria-pressed={isPaid}
                      onClick={() => onTogglePaid(key)}
                    >
                      {isPaid && <Check aria-hidden />}
                      Paid
                    </Button>
                  ) : (
                    isPaid && <span className="text-xs text-success">Paid</span>
                  )}
                </span>
              </li>
            )
          })}
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
    <section>
      <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">Activity</h2>
      <ul className="divide-y divide-border rounded-2xl border border-border text-xs text-muted-foreground">
        {[...entries].reverse().map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <span>
              <span className="mr-2 font-mono">{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
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

import type { Entry, MiscountMethod } from '@/schemas/games-schema'

export type PlayerTotal = {
  playerId: string
  buyinCents: number
  /** null until the host records this player's cash-out. */
  cashoutCents: number | null
  netCents: number
}

export type FinalTotal = PlayerTotal & {
  /** This player's share of the miscount; negative when chips came out over the money in. */
  adjustmentCents: number
  /** What the host hands this player at the end: their chips plus their share. */
  payoutCents: number
}

/** What a closed game needs to work out everyone's final result. */
export type ClosedGame = { entries: Entry[]; hostId: string; miscountMethod?: MiscountMethod }

export function playerTotals(playerIds: string[], entries: Entry[]): PlayerTotal[] {
  return playerIds.map((playerId) => {
    const mine = entries.filter((e) => e.playerId === playerId)
    const buyinCents = mine.filter((e) => e.type === 'buyin').reduce((sum, e) => sum + e.amountCents, 0)
    const cashout = mine.find((e) => e.type === 'cashout')
    const cashoutCents = cashout ? cashout.amountCents : null
    return { playerId, buyinCents, cashoutCents, netCents: (cashoutCents ?? 0) - buyinCents }
  })
}

export function ledgerSummary(totals: PlayerTotal[]) {
  const totalInCents = totals.reduce((sum, t) => sum + t.buyinCents, 0)
  const totalOutCents = totals.reduce((sum, t) => sum + (t.cashoutCents ?? 0), 0)
  // Players who never bought in don't need a cash-out.
  const waitingOn = totals.filter((t) => t.buyinCents > 0 && t.cashoutCents === null).map((t) => t.playerId)
  const differenceCents = totalOutCents - totalInCents
  const allCashedOut = totalInCents > 0 && waitingOn.length === 0
  return {
    totalInCents,
    totalOutCents,
    differenceCents,
    waitingOn,
    allCashedOut,
    /** Closable as counted. When the count is off, closing also needs a miscount method. */
    canClose: allCashedOut && differenceCents === 0,
  }
}

/**
 * Splits `amountCents` across `weights` in proportion, in whole cents that add
 * up exactly. Leftover cents go to the largest remainders, ties to the earlier
 * entry. The sign of `amountCents` carries through to every share.
 */
export function splitCents(amountCents: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0)
  const abs = Math.abs(amountCents)
  // Integer math throughout so floating-point error can't drop or add a cent.
  const shares = weights.map((w) => Math.floor((abs * w) / total))
  const order = weights
    .map((w, i) => ({ i, remainder: (abs * w) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
  let left = abs - shares.reduce((sum, s) => sum + s, 0)
  for (const { i } of order) {
    if (left === 0) break
    shares[i] += 1
    left -= 1
  }
  return shares.map((s) => (amountCents < 0 && s !== 0 ? -s : s))
}

/**
 * Applies a miscount method to a game's totals. Every method keeps the host
 * whole except host-covers: the payouts add up to exactly the money taken in.
 * Returns null when the method can't be used here (no winners to share it, a
 * winner would drop below even, or the count is off and no method was picked).
 */
export function finalTotals(totals: PlayerTotal[], hostId: string, method?: MiscountMethod): FinalTotal[] | null {
  const differenceCents = totals.reduce((sum, t) => sum + (t.cashoutCents ?? 0) - t.buyinCents, 0)
  const adjustments = miscountAdjustments(totals, hostId, differenceCents, method)
  if (!adjustments) return null
  return totals.map((t, i) => ({
    ...t,
    netCents: t.netCents + adjustments[i],
    adjustmentCents: adjustments[i],
    payoutCents: (t.cashoutCents ?? 0) + adjustments[i],
  }))
}

function miscountAdjustments(
  totals: PlayerTotal[],
  hostId: string,
  differenceCents: number,
  method: MiscountMethod | undefined,
): number[] | null {
  if (differenceCents === 0) return totals.map(() => 0)
  if (!method) return null

  if (method === 'host-covers') {
    // Without a host row nobody would carry it and payouts would exceed the money in.
    if (!totals.some((t) => t.playerId === hostId)) return null
    return totals.map((t) => (t.playerId === hostId ? -differenceCents : 0))
  }

  const winners = totals.flatMap((t, i) => (t.netCents > 0 ? [{ i, netCents: t.netCents }] : []))
  if (winners.length === 0) return null
  const weights = method === 'winners-proportional' ? winners.map((w) => w.netCents) : winners.map(() => 1)
  const shares = splitCents(-differenceCents, weights)
  // Winners only share it while every one of them still finishes at least even.
  if (winners.some((w, k) => w.netCents + shares[k] < 0)) return null

  const adjustments = totals.map(() => 0)
  winners.forEach((w, k) => {
    adjustments[w.i] = shares[k]
  })
  return adjustments
}

/**
 * Final results for a closed game. A closed game had a usable method when it
 * closed, so the fallback only runs when the host didn't play (and covered the
 * miss) or the record was edited afterwards. Either way the bank absorbs the
 * difference, which keeps payouts equal to the money taken in.
 */
export function settledTotals(totals: PlayerTotal[], hostId: string, method?: MiscountMethod): FinalTotal[] {
  const final = finalTotals(totals, hostId, method)
  if (final) return final
  const withHost = totals.some((t) => t.playerId === hostId)
    ? totals
    : [...totals, { playerId: hostId, buyinCents: 0, cashoutCents: null, netCents: 0 }]
  return finalTotals(withHost, hostId, 'host-covers')!
}

/** Everyone's final result for a closed game, from its ledger, with any miscount share applied. */
export function closedGameTotals(game: ClosedGame): FinalTotal[] {
  const playerIds = [...new Set(game.entries.map((e) => e.playerId))]
  return settledTotals(playerTotals(playerIds, game.entries), game.hostId, game.miscountMethod)
}

export type LifetimeRow = { playerId: string; netCents: number; games: number }

export function lifetimePnl(games: ClosedGame[]): LifetimeRow[] {
  const rows = new Map<string, LifetimeRow>()
  for (const game of games) {
    for (const t of closedGameTotals(game)) {
      const row = rows.get(t.playerId) ?? { playerId: t.playerId, netCents: 0, games: 0 }
      row.netCents += t.netCents
      row.games += 1
      rows.set(t.playerId, row)
    }
  }
  return [...rows.values()].sort((a, b) => b.netCents - a.netCents)
}

export function formatCents(cents: number, { signed = false } = {}) {
  const abs = Math.abs(cents)
  const text = `$${(abs / 100).toFixed(abs % 100 === 0 ? 0 : 2)}`
  if (cents < 0) return `-${text}`
  return signed && cents > 0 ? `+${text}` : text
}

/** Parses a dollar amount typed by the host into whole cents; null if invalid. */
export function parseDollars(input: string): number | null {
  const value = Number(input.trim().replace(/^\$/, ''))
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

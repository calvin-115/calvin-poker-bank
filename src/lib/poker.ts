import type { Entry } from '@/schemas/games-schema'

export type PlayerTotal = {
  playerId: string
  buyinCents: number
  /** null until the host records this player's cash-out. */
  cashoutCents: number | null
  netCents: number
}

export type Payment = { from: string; to: string; amountCents: number }

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
  return {
    totalInCents,
    totalOutCents,
    differenceCents,
    waitingOn,
    canClose: totalInCents > 0 && waitingOn.length === 0 && differenceCents === 0,
  }
}

/**
 * Greedy settlement: the biggest loser pays the biggest winner until everyone
 * is square. Not guaranteed minimal in every case (that's NP-hard), but it
 * never needs more than players - 1 payments.
 */
export function settle(totals: PlayerTotal[]): Payment[] {
  const debtors = totals.filter((t) => t.netCents < 0).map((t) => ({ id: t.playerId, cents: -t.netCents }))
  const creditors = totals.filter((t) => t.netCents > 0).map((t) => ({ id: t.playerId, cents: t.netCents }))
  debtors.sort((a, b) => b.cents - a.cents)
  creditors.sort((a, b) => b.cents - a.cents)

  const payments: Payment[] = []
  let d = 0
  let c = 0
  while (d < debtors.length && c < creditors.length) {
    const amountCents = Math.min(debtors[d].cents, creditors[c].cents)
    payments.push({ from: debtors[d].id, to: creditors[c].id, amountCents })
    debtors[d].cents -= amountCents
    creditors[c].cents -= amountCents
    if (debtors[d].cents === 0) d++
    if (creditors[c].cents === 0) c++
  }
  return payments
}

export type LifetimeRow = { playerId: string; netCents: number; games: number }

export function lifetimePnl(games: { entries: Entry[] }[]): LifetimeRow[] {
  const rows = new Map<string, LifetimeRow>()
  for (const game of games) {
    const playerIds = [...new Set(game.entries.map((e) => e.playerId))]
    for (const t of playerTotals(playerIds, game.entries)) {
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

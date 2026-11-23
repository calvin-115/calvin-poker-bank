import { describe, expect, it } from 'vitest'
import type { Entry } from '@/schemas/games-schema'
import { formatCents, ledgerSummary, lifetimePnl, parseDollars, playerTotals, settle, type PlayerTotal } from './poker'

let nextId = 0
function entry(playerId: string, type: Entry['type'], dollars: number): Entry {
  return { id: String(nextId++), playerId, type, amountCents: dollars * 100, at: '' }
}

function nets(map: Record<string, number>): PlayerTotal[] {
  return Object.entries(map).map(([playerId, net]) => ({
    playerId,
    buyinCents: 0,
    cashoutCents: 0,
    netCents: net * 100,
  }))
}

describe('playerTotals', () => {
  it('sums buy-ins and rebuys and nets against the cash-out', () => {
    const entries = [entry('a', 'buyin', 20), entry('a', 'buyin', 20), entry('a', 'cashout', 55), entry('b', 'buyin', 20)]
    expect(playerTotals(['a', 'b'], entries)).toEqual([
      { playerId: 'a', buyinCents: 4000, cashoutCents: 5500, netCents: 1500 },
      { playerId: 'b', buyinCents: 2000, cashoutCents: null, netCents: -2000 },
    ])
  })
})

describe('ledgerSummary', () => {
  it('flags a mismatch between chips out and money in', () => {
    const totals = playerTotals(['a', 'b'], [
      entry('a', 'buyin', 50), entry('b', 'buyin', 50),
      entry('a', 'cashout', 70), entry('b', 'cashout', 20),
    ])
    expect(ledgerSummary(totals)).toMatchObject({ differenceCents: -1000, canClose: false })
  })

  it('waits on players who bought in but have no cash-out', () => {
    const totals = playerTotals(['a', 'b', 'c'], [entry('a', 'buyin', 50), entry('a', 'cashout', 50)])
    expect(ledgerSummary(totals)).toMatchObject({ waitingOn: [], canClose: true })
    const withB = playerTotals(['a', 'b'], [entry('a', 'buyin', 50), entry('b', 'buyin', 50), entry('a', 'cashout', 100)])
    expect(ledgerSummary(withB)).toMatchObject({ waitingOn: ['b'], canClose: false })
  })

  it('cannot close an empty game', () => {
    expect(ledgerSummary(playerTotals(['a'], [])).canClose).toBe(false)
  })
})

describe('settle', () => {
  function balancesAfter(totals: PlayerTotal[]) {
    const balance = new Map(totals.map((t) => [t.playerId, t.netCents]))
    for (const p of settle(totals)) {
      balance.set(p.from, balance.get(p.from)! + p.amountCents)
      balance.set(p.to, balance.get(p.to)! - p.amountCents)
    }
    return [...balance.values()]
  }

  it('zeroes everyone out with at most players - 1 payments', () => {
    const totals = nets({ a: 60, b: -25, c: -10, d: -40, e: 15 })
    expect(balancesAfter(totals).every((b) => b === 0)).toBe(true)
    expect(settle(totals).length).toBeLessThanOrEqual(totals.length - 1)
  })

  it('uses one payment when one person owes one person', () => {
    expect(settle(nets({ a: 30, b: -30, c: 0 }))).toEqual([{ from: 'b', to: 'a', amountCents: 3000 }])
  })

  it('pays nothing when everyone broke even', () => {
    expect(settle(nets({ a: 0, b: 0 }))).toEqual([])
  })
})

describe('lifetimePnl', () => {
  it('adds each player net across games, best first', () => {
    const rows = lifetimePnl([
      { entries: [entry('a', 'buyin', 20), entry('a', 'cashout', 50), entry('b', 'buyin', 30), entry('b', 'cashout', 0)] },
      { entries: [entry('a', 'buyin', 20), entry('a', 'cashout', 0), entry('b', 'buyin', 20), entry('b', 'cashout', 40)] },
    ])
    expect(rows).toEqual([
      { playerId: 'a', netCents: 1000, games: 2 },
      { playerId: 'b', netCents: -1000, games: 2 },
    ])
  })
})

describe('money formatting', () => {
  it('parses and formats dollars', () => {
    expect(parseDollars('$12.50')).toBe(1250)
    expect(parseDollars('abc')).toBeNull()
    expect(parseDollars('-5')).toBeNull()
    expect(formatCents(1250)).toBe('$12.50')
    expect(formatCents(-2000)).toBe('-$20')
    expect(formatCents(500, { signed: true })).toBe('+$5')
  })
})

import { describe, expect, it } from 'vitest'
import type { Entry } from '@/schemas/games-schema'
import {
  closedGameTotals,
  finalTotals,
  formatCents,
  ledgerSummary,
  lifetimePnl,
  parseDollars,
  playerTotals,
  settledTotals,
  splitCents,
  type FinalTotal,
} from './poker'

let nextId = 0
function entry(playerId: string, type: Entry['type'], dollars: number): Entry {
  return { id: String(nextId++), playerId, type, amountCents: Math.round(dollars * 100), at: '' }
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

describe('splitCents', () => {
  it('splits in proportion and always adds up exactly', () => {
    expect(splitCents(1000, [6000, 4000])).toEqual([600, 400])
    expect(splitCents(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(splitCents(-100, [1, 1, 1])).toEqual([-34, -33, -33])
    const odd = splitCents(1001, [3333, 3333, 3334])
    expect(odd.reduce((a, b) => a + b, 0)).toBe(1001)
  })

  it('gives leftover cents to the largest remainders', () => {
    // 10 split 1:2 is 3.33 / 6.67, so the extra cent goes to the second share.
    expect(splitCents(10, [1, 2])).toEqual([3, 7])
  })

  it('returns zeros for nothing to split', () => {
    expect(splitCents(0, [5, 5])).toEqual([0, 0])
  })

  it('breaks tied remainders toward the earlier entry with unequal weights', () => {
    // 10 split 1:1:2 is 2.5 / 2.5 / 5: the spare cent goes to the first tie.
    expect(splitCents(10, [1, 1, 2])).toEqual([3, 2, 5])
  })

  it('never returns negative zero', () => {
    const shares = splitCents(-1, [1, 1])
    expect(shares).toEqual([-1, 0])
    expect(Object.is(shares[1], 0)).toBe(true)
  })

  it('stays exact at large amounts', () => {
    expect(splitCents(10_000_000, [3, 7])).toEqual([3_000_000, 7_000_000])
    expect(splitCents(9_999_999, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(9_999_999)
  })
})

describe('finalTotals', () => {
  // Host h: in 50, out 110 (+60). a: in 50, out 70 (+20). b: in 100, out 30 (-70).
  // Money in 200, chips out 210: the count is $10 over.
  const over = playerTotals(['h', 'a', 'b'], [
    entry('h', 'buyin', 50), entry('a', 'buyin', 50), entry('b', 'buyin', 100),
    entry('h', 'cashout', 110), entry('a', 'cashout', 70), entry('b', 'cashout', 30),
  ])
  const payoutSum = (totals: FinalTotal[]) => totals.reduce((sum, t) => sum + t.payoutCents, 0)
  const byId = (totals: FinalTotal[]) => Object.fromEntries(totals.map((t) => [t.playerId, t.adjustmentCents]))

  it('needs no method when the count matches', () => {
    const even = playerTotals(['a', 'b'], [entry('a', 'buyin', 20), entry('b', 'buyin', 20), entry('a', 'cashout', 30), entry('b', 'cashout', 10)])
    const result = finalTotals(even, 'a')!
    expect(result.map((t) => t.adjustmentCents)).toEqual([0, 0])
    expect(result.map((t) => t.payoutCents)).toEqual([3000, 1000])
  })

  it('refuses to close an off count without a method', () => {
    expect(finalTotals(over, 'h')).toBeNull()
  })

  it('winners-proportional: winners give back in proportion to what they won', () => {
    const result = finalTotals(over, 'h', 'winners-proportional')!
    expect(byId(result)).toEqual({ h: -750, a: -250, b: 0 })
    expect(payoutSum(result)).toBe(20000)
  })

  it('winners-equal: winners give back the same amount each', () => {
    const result = finalTotals(over, 'h', 'winners-equal')!
    expect(byId(result)).toEqual({ h: -500, a: -500, b: 0 })
    expect(payoutSum(result)).toBe(20000)
  })

  it('host-covers: only the host absorbs it', () => {
    const result = finalTotals(over, 'h', 'host-covers')!
    expect(byId(result)).toEqual({ h: -1000, a: 0, b: 0 })
    expect(result.find((t) => t.playerId === 'h')!.netCents).toBe(5000)
  })

  it('never changes what a loser gets', () => {
    for (const method of ['winners-proportional', 'winners-equal', 'host-covers'] as const) {
      expect(finalTotals(over, 'h', method)!.find((t) => t.playerId === 'b')!.payoutCents).toBe(3000)
    }
  })

  it('hands extra money to the winners when the count is short', () => {
    // Money in 200, chips out 190: $10 left over.
    const short = playerTotals(['h', 'a', 'b'], [
      entry('h', 'buyin', 50), entry('a', 'buyin', 50), entry('b', 'buyin', 100),
      entry('h', 'cashout', 110), entry('a', 'cashout', 50), entry('b', 'cashout', 30),
    ])
    const result = finalTotals(short, 'h', 'winners-proportional')!
    expect(byId(result)).toEqual({ h: 1000, a: 0, b: 0 })
    expect(payoutSum(result)).toBe(20000)
  })

  it('cannot use a winners method when nobody finished up', () => {
    // a is down $10, b broke even, and $10 is left over: there is no winner to give it to.
    const noWinners = playerTotals(['a', 'b'], [entry('a', 'buyin', 50), entry('b', 'buyin', 50), entry('a', 'cashout', 40), entry('b', 'cashout', 50)])
    expect(finalTotals(noWinners, 'a', 'winners-proportional')).toBeNull()
    expect(finalTotals(noWinners, 'a', 'winners-equal')).toBeNull()
    expect(finalTotals(noWinners, 'a', 'host-covers')).not.toBeNull()
  })

  it('cannot use a winners method that would push a winner below even', () => {
    // a is +$2, b is +$50, count is $20 over: an equal $10 each would put a at -$8.
    const thin = playerTotals(['a', 'b', 'c'], [
      entry('a', 'buyin', 50), entry('b', 'buyin', 50), entry('c', 'buyin', 100),
      entry('a', 'cashout', 52), entry('b', 'cashout', 100), entry('c', 'cashout', 68),
    ])
    expect(finalTotals(thin, 'c', 'winners-equal')).toBeNull()
    // Proportionally a gives back under $1, which still leaves them up.
    expect(finalTotals(thin, 'c', 'winners-proportional')).not.toBeNull()
  })

  it('host-covers is unavailable when the host is not in the game', () => {
    expect(finalTotals(over, 'someone-else', 'host-covers')).toBeNull()
  })

  it('handles short counts with an even split and with the host covering', () => {
    // h +$60, a +$20, b -$70; money in 200, chips out 190: $10 left over.
    const short = playerTotals(['h', 'a', 'b'], [
      entry('h', 'buyin', 50), entry('a', 'buyin', 50), entry('b', 'buyin', 100),
      entry('h', 'cashout', 110), entry('a', 'cashout', 50), entry('b', 'cashout', 30),
    ])
    // Only h is up here (a is even), so h takes the whole $10 either way.
    expect(byId(finalTotals(short, 'h', 'winners-equal')!)).toEqual({ h: 1000, a: 0, b: 0 })
    const covered = finalTotals(short, 'h', 'host-covers')!
    expect(byId(covered)).toEqual({ h: 1000, a: 0, b: 0 })
    expect(payoutSum(covered)).toBe(20000)
  })

  it('lets a single winner end exactly even', () => {
    // a is +$5 and the count is $5 over: a absorbs it all and finishes at $0.
    // The miss can never exceed the winners' total winnings (it is their sum
    // plus the losers' losses), so a proportional split never goes below even;
    // only an even split can, which the "below even" test covers.
    const exact = playerTotals(['a', 'b'], [entry('a', 'buyin', 50), entry('b', 'buyin', 50), entry('a', 'cashout', 55), entry('b', 'cashout', 50)])
    for (const method of ['winners-proportional', 'winners-equal'] as const) {
      expect(finalTotals(exact, 'b', method)!.find((t) => t.playerId === 'a')!.netCents).toBe(0)
    }
  })

  it('leaves joined players who never bought in untouched', () => {
    const withIdle = playerTotals(['h', 'a', 'b', 'idle'], [
      entry('h', 'buyin', 50), entry('a', 'buyin', 50), entry('b', 'buyin', 100),
      entry('h', 'cashout', 110), entry('a', 'cashout', 70), entry('b', 'cashout', 30),
    ])
    const idle = finalTotals(withIdle, 'h', 'winners-proportional')!.find((t) => t.playerId === 'idle')!
    expect(idle).toMatchObject({ adjustmentCents: 0, payoutCents: 0, netCents: 0 })
  })

  it('splits odd cents without losing any', () => {
    // Three equal winners share a $1 over count.
    const three = playerTotals(['a', 'b', 'c', 'd'], [
      entry('a', 'buyin', 10), entry('b', 'buyin', 10), entry('c', 'buyin', 10), entry('d', 'buyin', 30),
      entry('a', 'cashout', 20), entry('b', 'cashout', 20), entry('c', 'cashout', 20), entry('d', 'cashout', 1),
    ])
    const result = finalTotals(three, 'd', 'winners-equal')!
    expect(result.map((t) => t.adjustmentCents)).toEqual([-34, -33, -33, 0])
    expect(payoutSum(result)).toBe(6000)
  })
})

describe('settledTotals', () => {
  it('has the bank absorb a miss whose saved method no longer applies', () => {
    // Edited record: a is down $10, b is even, $10 left over, but "winners split" was saved.
    const totals = playerTotals(['a', 'b'], [entry('a', 'buyin', 50), entry('b', 'buyin', 50), entry('a', 'cashout', 40), entry('b', 'cashout', 50)])
    const result = settledTotals(totals, 'b', 'winners-equal')
    expect(result.map((t) => t.netCents)).toEqual([-1000, 1000])
    expect(result.reduce((sum, t) => sum + t.payoutCents, 0)).toBe(10000)
  })

  it('adds a host who was not seated so the miss still lands somewhere', () => {
    const totals = playerTotals(['a'], [entry('a', 'buyin', 50), entry('a', 'cashout', 55)])
    expect(settledTotals(totals, 'h', 'host-covers')).toEqual([
      expect.objectContaining({ playerId: 'a', netCents: 500, payoutCents: 5500 }),
      expect.objectContaining({ playerId: 'h', netCents: -500 }),
    ])
  })
})

describe('closedGameTotals', () => {
  it('charges a host who covered a miscount even if they never played', () => {
    const totals = closedGameTotals({
      hostId: 'h',
      miscountMethod: 'host-covers',
      entries: [entry('a', 'buyin', 50), entry('a', 'cashout', 55)],
    })
    expect(totals).toEqual([
      expect.objectContaining({ playerId: 'a', netCents: 500 }),
      expect.objectContaining({ playerId: 'h', netCents: -500 }),
    ])
  })

  it('leaves out a host who did not play when the count matched', () => {
    const totals = closedGameTotals({ hostId: 'h', miscountMethod: 'host-covers', entries: [entry('a', 'buyin', 50), entry('a', 'cashout', 50)] })
    expect(totals.map((t) => t.playerId)).toEqual(['a'])
  })
})

describe('lifetimePnl', () => {
  it('adds each player net across games, best first', () => {
    const rows = lifetimePnl([
      { hostId: 'a', entries: [entry('a', 'buyin', 20), entry('a', 'cashout', 50), entry('b', 'buyin', 30), entry('b', 'cashout', 0)] },
      { hostId: 'a', entries: [entry('a', 'buyin', 20), entry('a', 'cashout', 0), entry('b', 'buyin', 20), entry('b', 'cashout', 40)] },
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

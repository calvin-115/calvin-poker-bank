import { describe, expect, it } from 'vitest'
import type { Entry } from '@/schemas/games-schema'
import { playerNights, playerStats } from './stats'

const entry = (playerId: string, type: Entry['type'], amountCents: number): Entry => ({
  id: `${playerId}-${type}-${amountCents}`,
  playerId,
  type,
  amountCents,
  at: '2026-11-01T00:00:00.000Z',
})

describe('playerNights', () => {
  it('returns net per game the player played, skipping games they sat out', () => {
    const games = [
      { hostId: 'a', entries: [entry('a', 'buyin', 2000), entry('a', 'cashout', 3500), entry('b', 'buyin', 1500)] },
      { hostId: 'b', entries: [entry('b', 'buyin', 2000), entry('b', 'cashout', 2000)] },
      { hostId: 'a', entries: [entry('a', 'buyin', 4000), entry('a', 'cashout', 1000), entry('b', 'cashout', 3000)] },
    ]
    expect(playerNights(games, 'a')).toEqual([1500, -3000])
  })

  it('uses results after the miscount share', () => {
    // a +$20, b -$10, chips $10 over: with winners splitting, a ends +$10.
    const games = [
      {
        hostId: 'b',
        miscountMethod: 'winners-proportional' as const,
        entries: [entry('a', 'buyin', 2000), entry('b', 'buyin', 2000), entry('a', 'cashout', 4000), entry('b', 'cashout', 1000)],
      },
    ]
    expect(playerNights(games, 'a')).toEqual([1000])
  })
})

describe('playerStats', () => {
  it('handles a player with no games', () => {
    expect(playerStats([])).toEqual({ form: [], streak: null, biggestWinCents: null, longestUpStreak: 0 })
  })

  it('keeps only the last five results, oldest first', () => {
    expect(playerStats([1, -1, 1, 1, -1, 1]).form).toEqual(['down', 'up', 'up', 'down', 'up'])
  })

  it('counts the current streak back from the latest game', () => {
    expect(playerStats([500, -100, 200, 300]).streak).toEqual({ result: 'up', count: 2 })
    expect(playerStats([500, -100, -200]).streak).toEqual({ result: 'down', count: 2 })
  })

  it('has no current streak after a break-even night', () => {
    expect(playerStats([500, 0]).streak).toBeNull()
  })

  it('finds the longest winning run anywhere in the history', () => {
    expect(playerStats([1, 1, 1, -1, 1]).longestUpStreak).toBe(3)
    expect(playerStats([1, 0, 1]).longestUpStreak).toBe(1)
  })

  it('reports the biggest win only when the player has finished up', () => {
    expect(playerStats([-500, 1800, 900]).biggestWinCents).toBe(1800)
    expect(playerStats([-500, 0]).biggestWinCents).toBeNull()
  })
})

import type { Entry } from '@/schemas/games-schema'
import { playerTotals } from './poker'

export type Result = 'up' | 'down' | 'even'

export type PlayerStats = {
  /** Up to the last five results, oldest first. */
  form: Result[]
  /** The run of wins or losses that includes the latest game; null after a break-even night. */
  streak: { result: 'up' | 'down'; count: number } | null
  /** Best single-game win; null if the player has never finished up. */
  biggestWinCents: number | null
  longestUpStreak: number
}

/**
 * A player's net for each game they played, in the order given (pass games
 * oldest first). "Played" matches lifetimePnl: they have at least one entry.
 */
export function playerNights(games: { entries: Entry[] }[], playerId: string): number[] {
  return games
    .filter((g) => g.entries.some((e) => e.playerId === playerId))
    .map((g) => playerTotals([playerId], g.entries)[0].netCents)
}

export function resultOf(netCents: number): Result {
  if (netCents > 0) return 'up'
  if (netCents < 0) return 'down'
  return 'even'
}

export function playerStats(nights: number[]): PlayerStats {
  const results = nights.map(resultOf)

  let streak: PlayerStats['streak'] = null
  const last = results.at(-1)
  if (last && last !== 'even') {
    let count = 0
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++
    streak = { result: last, count }
  }

  let longestUpStreak = 0
  let run = 0
  for (const r of results) {
    run = r === 'up' ? run + 1 : 0
    longestUpStreak = Math.max(longestUpStreak, run)
  }

  const wins = nights.filter((n) => n > 0)
  return {
    form: results.slice(-5),
    streak,
    biggestWinCents: wins.length > 0 ? Math.max(...wins) : null,
    longestUpStreak,
  }
}

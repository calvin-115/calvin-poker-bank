import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { FELTS, type Felt, type Game } from '../schemas/games-schema'
import type { GameCode } from '../schemas/game-codes-schema'
import type { Player } from '../schemas/players-schema'

// These run with record permissions OFF (see src/server/action-routes.ts), so
// each one checks who is calling before it writes anything.

type Row<T> = { recordId: string; createdBy: string; data: T }

// No 0/O or 1/I, so codes read cleanly across a table.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

async function queryRows<T>(tools: ActionTools, collection: string, where: Record<string, string>, limit = 500) {
  const result = await tools.query(collection, { where, limit })
  return result.success ? (result.data.records as Row<T>[]) : null
}

/** Creates a game, its join code and the host's seat. */
const hostGame: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const name = typeof params.name === 'string' ? params.name.trim() : ''
  if (!name || name.length > 80) return { success: false, error: 'Give the game a name of up to 80 characters.' }
  const felt: Felt = FELTS.includes(params.felt as Felt) ? (params.felt as Felt) : 'green'

  const game = await tools.create('games', { name, status: 'open', entries: [], felt })
  if (!game.success) return game
  const gameId = game.data.recordId

  // Codes are random, so a clash is rare; a few tries is plenty.
  let issued: ActionResult<unknown> = { success: false, error: 'Could not issue a join code.' }
  for (let attempt = 0; attempt < 5 && !issued.success; attempt++) {
    issued = await tools.create('gameCodes', { gameId, code: generateCode(), members: [userId] })
  }
  if (!issued.success) return issued

  const seat = await tools.create('players', { gameId, userId })
  if (!seat.success) return seat
  return { success: true, data: { gameId } }
}

/** Seats the caller in the open game whose code they typed, and lets them see the code. */
const joinGame: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const code = typeof params.code === 'string' ? params.code.trim().toUpperCase() : ''
  const codeRows = code ? await queryRows<GameCode>(tools, 'gameCodes', { code }, 1) : []
  if (!codeRows) return { success: false, error: 'Could not look up that code. Try again.' }
  const codeRow = codeRows[0]
  if (!codeRow) return { success: false, error: 'No game with that code.' }

  const { gameId } = codeRow.data
  const game = await tools.get('games', gameId)
  if (!game.success) return { success: false, error: 'No game with that code.' }
  if (game.data.record.data.status === 'closed') return { success: false, error: 'That game is closed.' }

  const seats = await queryRows<Player>(tools, 'players', { gameId, userId }, 1)
  if (!seats) return { success: false, error: 'Could not join. Try again.' }
  if (seats.length === 0) {
    const seat = await tools.create('players', { gameId, userId })
    if (!seat.success) return seat
  }
  if (!codeRow.data.members.includes(userId)) {
    const shared = await tools.update('gameCodes', codeRow.recordId, { members: [...codeRow.data.members, userId] })
    if (!shared.success) return shared
  }
  return { success: true, data: { gameId } }
}

/**
 * Admin-only, run once: moves codes off old game records (which every member
 * can read) into gameCodes, shared with the host and everyone already seated.
 */
const secureJoinCodes: ActionHandler<Env> = async ({ userId, tools, env }) => {
  const me = await tools.get('users', userId)
  const isAdmin = userId === env.OWNER_USER_ID || (me.success && me.data.record.data.role === 'admin')
  if (!isAdmin) return { success: false, error: 'Only admins can do this.' }

  const games = await queryRows<Game>(tools, 'games', {})
  if (!games) return { success: false, error: 'Could not read games.' }

  let moved = 0
  for (const game of games.filter((g) => g.data.code)) {
    const existing = await queryRows<GameCode>(tools, 'gameCodes', { gameId: game.recordId }, 1)
    if (!existing) return { success: false, error: `Stopped after ${moved}: could not read codes.` }
    if (existing.length === 0) {
      const seats = await queryRows<Player>(tools, 'players', { gameId: game.recordId })
      if (!seats) return { success: false, error: `Stopped after ${moved}: could not read players.` }
      const members = [...new Set([game.createdBy, ...seats.map((s) => s.data.userId)])]
      const created = await tools.create('gameCodes', { gameId: game.recordId, code: game.data.code, members })
      if (!created.success) return { success: false, error: `Stopped after ${moved}: ${created.error}` }
    }
    const cleared = await tools.update('games', game.recordId, { code: null })
    if (!cleared.success) return { success: false, error: `Stopped after ${moved}: ${cleared.error}` }
    moved++
  }
  return { success: true, data: { moved } }
}

export const actions: Record<string, ActionHandler<Env>> = { hostGame, joinGame, secureJoinCodes }

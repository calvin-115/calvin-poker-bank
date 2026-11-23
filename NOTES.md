# Notes

## Agent log

### Step 1: schemas + create/join game (Claude Code)
- `games` collection: name, 6-char join code (unique), status, entries (JSON ledger, used in step 2), closedAt. Signed-in members can read all and create; only the host (creator, `'own'`) can update/delete; admin can do everything; signed-out visitors get nothing.
- `players` collection: gameId + userId (one row per person per game). Members can only add/remove themselves (`userBound`, `ownerField`).
- `/games` page: host a game (host auto-joins), join by code, list of all games. `/games/:id` page: name, host, join code, live player list.
- Files: `src/schemas/games-schema.ts`, `src/schemas/players-schema.ts`, `src/schemas.ts`, `src/nav.ts`, `src/pages/(app)/(protected)/games/index.tsx`, `src/pages/(app)/(protected)/games/[id].tsx`, `tests/games.spec.ts`

### Steps 2–4: host ledger, mismatch flag + close, settlement (Claude Code)
- Game page ledger: per player bought in / cashed out / net, plus totals. Host (or admin) adds buy-ins/rebuys, sets each player's cash-out (setting it again replaces it), and removes entries from the activity log.
- Mismatch banner when cash-outs ≠ buy-ins (and a "waiting on" note for missing cash-outs). Close is disabled until every player who bought in has cashed out and totals match. Host can reopen a closed game to fix mistakes.
- Settle up: greedy biggest-loser-pays-biggest-winner, at most players − 1 payments. Preview while balanced, final once closed.
- All money math in `src/lib/poker.ts` (pure functions, unit-tested in `src/lib/poker.test.ts`). Amounts stored as integer cents; chips = dollars 1:1.
- Files: `src/lib/poker.ts`, `src/lib/poker.test.ts`, `src/pages/(app)/(protected)/games/[id].tsx`, `tests/games.spec.ts`

### Step 5: lifetime P&L + leaderboard (Claude Code)
- `/leaderboard`: your lifetime P&L with per-game breakdown, and everyone's lifetime P&L ranked. Only closed games count.
- Files: `src/pages/(app)/(protected)/leaderboard.tsx`, `src/nav.ts`

### Step 6: light polish (Claude Code)
- `/home` redirects to `/games`; landing page copy; SEO description; `noindex: true` (private game); nav: Games, Leaderboard, Settings, Admin (admins only). Theme colors use the scaffold's success/destructive tokens.
- Files: `src/pages/(app)/home.tsx`, `src/pages/index.tsx`, `src/seo.ts`, `src/nav.ts`

### Step 7: admin page (Claude Code)
- `/admin` (admins only): list of users with Make admin / Remove admin, using the built-in `setRole` (server refuses non-admins). App owner is always admin.
- Files: `src/pages/(app)/(protected)/admin.tsx`, `src/nav.ts`

## What I verified / changed

## Next steps
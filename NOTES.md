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

### First deploy (Claude Code)
- Live at https://calvin-poker-bank.app.space (app id `app_01M851DYCPBNT1ZYV7FGWMKDDB`).
- Source latched permanently to **GitHub** (`calvin-115/calvin-poker-bank`) because the checkout had that `origin` remote. Deploys ship the local working tree; DeepSpace `push`/`workspace` commands won't work for this app.

### Redesign phase 1: "vault" theme (Claude Code)
- Visual redesign planned in 5 phases from Mobbin references (Kraken, Revolut, Origin, Quicken for ledger/summary; Wise for settle-up; Duolingo/Brilliant/Circle for leaderboard): 1 theme → 2 game page → 3 games list → 4 leaderboard → 5 nav/landing. Direction: dark fintech, mobile-first.
- New `vault` theme is now active: near-black surfaces, off-white primary buttons (so green/red money amounts are the main color), blue focus ring, rounder corners (`--radius: 0.75rem`), subtler borders. Success/destructive colors unchanged (scaffold keeps status colors constant).
- Tabular (fixed-width) digits app-wide so money columns line up.
- No component or logic changes.
- Files: `src/themes.css`, `src/themes.ts`, `src/styles.css`, `index.html`

### Redesign phase 2: game page (Claude Code)
- Built for quick phone visits (join, check, close the tab). The 5-column ledger table is now a stacked player list.
- Header: name, Open/Closed status badge, host, and the join code in its own box so the host can show it across the table.
- Pot card: total pot as the big number, with player count and total cashed out (replaces the table's totals row).
- Player rows: avatar (profile photo or initial), name + host tag, "In $X · Out $Y", net in green/red. Your own row is highlighted. Host's buy-in/cash-out inputs sit under each row (16px text on phones so iOS doesn't zoom).
- Settle up: "A → B · $X" rows. Activity log is smaller and muted. Close/Reopen button is full width on phones.
- No logic changes: data, permissions and money math are as before. Test IDs kept (`ledger-row`, `game-code`, `game-status`, `mismatch`, `settlement`). The list now carries `player-list`, which `tests/games.spec.ts` was already looking for (it had no match since step 2).
- Files: `src/pages/(app)/(protected)/games/[id].tsx`

### Buy-in requests with host approval (Claude Code)
- Players on an open game they've joined get a "Request buy-in" box (amount + button) and see their own requests as "Waiting for host" (Cancel) or "Declined" (Dismiss). Approved requests disappear from their list and show up in the ledger.
- Host (or admin) sees a "Buy-in requests" section at the top of the game page with Approve / Decline per request; it updates live. Approve adds the requested amount as-is. The host can still add buy-ins directly; cash-outs stay host-only.
- New `buyinRequests` collection (gameId, userId, amountCents). Members can read all, create their own (`userBound`), and delete their own; nobody but admin can update.
- The host never writes request rows. Approving adds a ledger entry with `requestId`; declining adds the id to the game's new `declinedRequestIds` column. Each is one write to the game record, which only the host can write, so a player can't approve themselves and a request can't be half-approved.
- Removing an approved buy-in from the activity log also marks its request declined (same write), so it doesn't pop back up as pending.
- No push notifications (skipped by choice). Approve as-is (host can't edit the amount).
- New/changed columns are additive; DeepSpace adds them on deploy. Old games have no `declinedRequestIds`, handled as empty.
- New e2e test: player requests $25 and $15, host approves one and declines the other. Not run yet (needs the dev server).
- Files: `src/schemas/buyin-requests-schema.ts` (new), `src/schemas.ts`, `src/schemas/games-schema.ts`, `src/pages/(app)/(protected)/games/[id].tsx`, `tests/games.spec.ts`

### Redesign phase 3: games list (Claude Code)
- "Join a game" now comes first (most visits are players joining) with a large centered code field. "Host a game" second with a quieter button. Each card has a one-line hint; field labels are screen-reader only (tests still find them by label).
- Game rows: name, host · player count, Open/Closed badge, chevron.
- The Open/Closed badge is now a shared component used here and on the game page.
- Files: `src/pages/(app)/(protected)/games/index.tsx`, `src/components/GameStatusBadge.tsx` (new), `src/pages/(app)/(protected)/games/[id].tsx`

### Redesign phase 4: leaderboard (Claude Code)
- "Your lifetime P&L" card restyled to match the game page's pot card; your per-game list now shows each game's close date and the whole row is a link.
- Everyone: ranked rows with rank chip, avatar, name ("(you)" on your row, highlighted), games played, and P&L in green/red.
- Gold/silver/bronze rank chips for the top 3, but only when that player is up money (with few players, 3rd place can be negative).
- No logic changes. Files: `src/pages/(app)/(protected)/leaderboard.tsx`

### Redesign phase 5: navigation + landing (Claude Code)
- Display name is now "Calvin's Poker Bank" (nav, page titles, landing, SEO). Only the browser-side `APP_NAME` and the `index.html` title changed; the worker's `APP_NAME` in `wrangler.toml`, package name, and app id are untouched, so deploys and data are unaffected.
- Top bar: coin logo mark + name, pill-style active link on desktop, rounder Sign in button.
- Phones: the ☰ menu is gone; a bottom tab bar (icon + label: Games, Leaderboard, Settings, Admin for admins) is always visible below the page. Desktop (md+) keeps the top links. Nav items now carry an icon in `src/nav.ts`.
- Landing: logo mark, updated copy mentioning buy-in requests, arrow on "Enter the app", three feature cards (host-approved buy-ins, settle up, leaderboard).
- Sign-in panel corners match the rest of the app.
- Test hooks kept: `app-navigation`, `nav-sign-in-button`, `nav-user-name`, `nav-user-email`, `static-landing`.
- Files: `src/constants.ts`, `index.html`, `src/nav.ts`, `src/components/Navigation.tsx`, `src/pages/(app)/_layout.tsx`, `src/pages/index.tsx`, `src/pages/(app)/(protected)/_layout.tsx`

## What I verified / changed

## Next steps
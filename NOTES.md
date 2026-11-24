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

### Second deploy (Claude Code)
- Merged `redesign-and-buyin-requests` into `main` (fast-forward, commit `fe1a504`) and deployed to https://calvin-poker-bank.app.space. Checked that the live landing page serves the new title and copy. DeepSpace adds the `buyinRequests` collection and `declinedRequestIds` column automatically when the app starts.

### Card room redesign report (Claude Code)
- Research only, no code changes. Mobbin study of gaming/tracking apps (Duolingo, Fixtured, Fetch, Splitwise, 7-Eleven, Nibble, FotMob, NBA, Strava, Runna) and a 6-step plan for a warmer "card room" redesign: walnut/felt/brass palette, a drawn SVG poker table with players seated, chip and number motion, a closing recap, table-style game cards, and a leaderboard with podium, form and personal bests.
- Report (private artifact): https://claude.ai/artifact/HWtmQ1fzkcQacTMs4yvFHp
- Waiting on decisions: drawn table vs photo, sound, felt color per game, dark-only.
- Decisions (user agreed to all recommendations): drawn SVG table, chip sound off by default with a Settings toggle, host picks felt color per game, dark-only. App is desktop and mobile, leaning desktop: wide multi-column layouts that stack on phones.

### Card room step 1: theme (Claude Code)
- New `cardroom` theme replaces `vault`: walnut background, brass primary, cream text, warm muted tones, rounder corners. Money colors overridden in this theme: win mint `#6fd39a`, loss chip-red `#ec6a50` (kept distinct from felt green).
- Fonts via Google Fonts: Fraunces (display: names, big numbers), Inter (body), IBM Plex Mono (codes, labels). Tailwind classes `font-display` / `font-mono`.
- New utilities in `styles.css`: `felt` (radial felt gradient, re-tinted by `data-felt`), `felt-ring` (wood rail + brass inlay), `bg-lamplight` (warm glow at the top of the app). Felt colors green/blue/burgundy in `themes.css`.
- Files: `src/themes.css`, `src/themes.ts`, `src/styles.css`, `index.html`, `src/pages/(app)/_layout.tsx`, `src/components/Navigation.tsx`

### Card room steps 2–4: table, motion, closing recap (Claude Code)
- `PokerTable` (SVG): wood rail, grained felt in the game's color, players seated clockwise from the bottom with you first (brass ring), name + "in $X" / net on the felt, pot in the center with chip stacks that grow with the pot.
- Motion: when a player's buy-in total grows, a chip flies from their seat to the pot and the seat glows (render-time state comparison, no effect). Pot and bank totals roll to new values (`useAnimatedNumber`, `AnimatedCents`). Request rows fade/slide in. All motion is off under reduced-motion.
- Chip sound: synthesized with Web Audio (`src/lib/sound.ts`, no audio file or dependency), plays with each chip flight only if turned on in Settings → Table sounds (per device, localStorage, off by default).
- Game page is now two columns on desktop: table + players + activity on the left; sidebar with requests/approvals, Bank card (bought in, cashed out, players, mismatch, close/reopen) and settle-up on the right. Phones stack table → requests → bank → players.
- Closed games show a felt recap above the table: crown + biggest winner, pot, player count. Chips rain once per game per device (localStorage `poker-bank:recap-seen:<gameId>`).
- Settle-up: host can tick each payment as Paid (stored on the game as `paidPayments`, keys `from:to`); everyone sees "Paid" and the row dims.
- New game columns: `felt` (select, default green) and `paidPayments` (json). Both additive; older games read as green / nothing paid.
- Files: `src/components/PokerTable.tsx`, `src/components/AnimatedCents.tsx`, `src/lib/use-animated-number.ts`, `src/lib/sound.ts`, `src/schemas/games-schema.ts`, `src/pages/(app)/(protected)/games/[id].tsx`

### Card room step 5: lobby, landing, nav, settings (Claude Code)
- Games list: desktop has a sticky left column (Join with a dashed brass "card slot" code field; Host with a felt color picker) and a grid of table cards (mini felt oval in the game's color, pot in the middle, a colored dot per seated player, name, host, status).
- Landing: two-column hero on desktop with a `PokerTable` of example players (illustration only), brass eyebrow, Fraunces headline; feature cards below.
- Nav: brand in Fraunces; active top link is a brass pill; phone tab bar shows a brass bar over the active tab.
- Settings: restyled, plus the Chip sounds toggle (plays a sample clack when turned on).
- Files: `src/pages/(app)/(protected)/games/index.tsx`, `src/pages/index.tsx`, `src/components/Navigation.tsx`, `src/pages/(app)/(protected)/settings.tsx`

### Card room step 6: leaderboard (Claude Code)
- New pure stats in `src/lib/stats.ts` (unit-tested in `stats.test.ts`): per-player nights from closed games, last-5 form, current streak (break-even ends it), longest winning streak, biggest win.
- Desktop: standings on the left with a felt podium (2–1–3, crown on 1st, medals only for players who are up) and rows showing form dots and "N up/down in a row" tags; your card on the right with lifetime P&L (rolls up), best-night / best-streak / current-streak tiles, and your games.
- Files: `src/lib/stats.ts`, `src/lib/stats.test.ts`, `src/pages/(app)/(protected)/leaderboard.tsx`

### Third deploy: card room (Claude Code)
- Merged `cardroom-redesign` into `main` (fast-forward, commit `8954b9e`) and deployed to https://calvin-poker-bank.app.space. Live landing page confirmed serving the `cardroom` theme, Fraunces font and the hero table. New `felt` / `paidPayments` game columns are added by DeepSpace on start.
- Standing rule from now on: every commit gets merged to `main` and deployed.

### Landing page (Claude Code)
- Full marketing landing at `/`, designed from Mobbin references (Discord/Duolingo heroes, Railway "how it works", incident.io feature switcher, Linear bento cards). Static and prerendered as before.
- Sections: sticky top bar (anchors + Enter the app) → hero "Pay first. Play after." with Host a game / Join with a code and a live demo table (a $20 rebuy every 2.6s triggers the real chip-flight animation; loose chips float around it) → "How a night works" 3 numbered chip steps → feature switcher (buy-in requests, live table, settle up, leaderboard) with example previews → extras grid (felt colors, chip sounds, phone or laptop, no more IOUs) → felt "Deal me in" call to action → footer.
- Previews use example names and amounts; the live-table preview is the real `PokerTable`, the others are static mock-ups of the app's screens.
- Motion here loops (marketing page); all of it stops under reduced motion. Page clips horizontal overflow so the floating chips can't cause sideways scroll on phones.
- Shared chip drawing moved to `src/components/Chip.tsx` (`ChipFace`, `ChipIcon`); `PokerTable` uses it.
- Decided for the miscount feature (next): options are winners split proportionally to winnings, winners split equally, or host covers it. Losers never pay more after their buy-in (pay-first model).
- Files: `src/pages/index.tsx`, `src/components/Chip.tsx` (new), `src/components/PokerTable.tsx`, `src/styles.css`

### Miscount settling + host-pays payouts (Claude Code)
- Pay-first model: players pay the host before playing, so settle-up is now **host payouts** ("Host → Ben $145", each player's chips plus any miscount share) instead of player-to-player payments. The old greedy `settle()` and its tests are removed. Host can still tick each payout Paid (now keyed by player id; Paid marks made on older games under the old keys won't show).
- When everyone has cashed out but the count is off, the host gets a panel: "The count is $X over/short", a warning above 10% of the pot ("Recount the stacks before closing?"), and three options with a live per-player preview:
  - Winners split it by winnings (proportional to each winner's net)
  - Winners split it evenly
  - Host covers it (only the host's result changes; a host who didn't play is still charged)
  Winner options are disabled when nobody finished up or when a winner would drop below even. Losers' payouts never change.
- Close is enabled once a valid option is picked; the choice is saved on the game (`miscountMethod`). Rows show "count adjustment ±$X". Recap, table, leaderboard, streaks and "your games" all use the adjusted results. Reopening clears the pick.
- Money math in `src/lib/poker.ts`: `splitCents` (integer largest-remainder split, exact sums), `finalTotals`, `closedGameTotals`, `lifetimePnl` now takes host + method per game. 21 poker tests (over/short for each method, payouts sum to money in, losers unchanged, odd cents, no winners, winner below even, non-playing host) + stats test for adjusted nights.
- Codex review (read-only, after re-login; first attempt failed on an expired token). Codex made no changes. Findings and what Claude Code did:
  1. Host-covers with the host not seated returned a result where nobody absorbed the miss (payouts > money in). Fixed: `finalTotals` returns null for host-covers without a host row; the option shows "the host isn't seated in this game".
  2. A closed record whose saved method no longer applies fell back to the raw count (money unaccounted). Fixed: new `settledTotals` falls back to the bank (host) absorbing it, adding a host row if needed; payouts still equal money in. The game page (closed) and the leaderboard both use it, so they can't disagree.
  3. Joined players with no buy-in show $0 on the game page but don't count as a game on the leaderboard. Kept on purpose: no buy-in means they didn't play.
  Added the tests Codex listed: host absent, edited-record fallback, short counts for even split and host-covers, single winner ending exactly even, idle joined player, splitCents tie order / negative zero / large amounts. (A proportional split can never push a winner below even, since the miss is at most the winners' total, so that case only applies to the even split.) 41 unit tests pass.
- New e2e test: $5 over, host covers it, player paid full $15, host row shows the -$5 adjustment.
- Landing copy/preview updated to host payouts.
- The "Calvin's Poker Bank" logo in the app's top bar now opens the landing page (`/`) instead of `/home` (which redirects to Games). The landing page is public; `/home` stays the post-sign-in and 404 destination.
- Files: `src/lib/poker.ts`, `src/lib/poker.test.ts`, `src/lib/stats.ts`, `src/lib/stats.test.ts`, `src/schemas/games-schema.ts`, `src/pages/(app)/(protected)/games/[id].tsx`, `src/pages/(app)/(protected)/leaderboard.tsx`, `src/pages/index.tsx`, `tests/games.spec.ts`, `src/components/Navigation.tsx`

### Miscount wording describes the bank (Claude Code)
- Panel heading is now "The bank is $X short" (chips out exceed money in) or "The bank has $X extra" (chips missing), with "Players cashed out $X more/less in chips than was bought in." Closed games say "Bank was $X short" / "Bank had $X extra". Math unchanged (user confirmed it was right).
- Files: `src/pages/(app)/(protected)/games/[id].tsx`, `tests/games.spec.ts`

### Private join codes (Claude Code)
- Every member still sees every game (open and closed), but a game's join code is now readable only by its host, players who joined, and admins, enforced by the server (not just hidden in the UI).
- Codes moved to a new `gameCodes` collection (`gameId`, `code`, `members`; `read: 'collaborator'` for members, no member writes). DeepSpace has no per-field read rules, so the code can't stay on the game record.
- Hosting and joining now go through server actions in `src/actions/index.ts`: `hostGame` (creates the game, a server-generated code shared with the host, and the host's seat) and `joinGame` (checks the code and that the game is open, seats the caller, adds them to the code's members). Client helper `src/lib/actions.ts`.
- Players can no longer create seats directly (`players` member create: false), which closes joining a game without its code.
- Old games: their code is still on the game record until an admin clicks **Secure old join codes** on /admin (`secureJoinCodes` action: copies each code into `gameCodes` shared with the host and current players, then clears it from the game). Until then their players still see the code on the game page, but **joining an old game by code won't work until the button is clicked**. `games.code` is no longer required/immutable so it can be cleared.
- Non-players see "Players only" where the code was. e2e: added a check that a player who hasn't joined sees no code.
- Files: `src/schemas/game-codes-schema.ts` (new), `src/schemas.ts`, `src/schemas/games-schema.ts`, `src/schemas/players-schema.ts`, `src/actions/index.ts`, `src/lib/actions.ts` (new), `src/pages/(app)/(protected)/games/index.tsx`, `src/pages/(app)/(protected)/games/[id].tsx`, `src/pages/(app)/(protected)/admin.tsx`, `tests/games.spec.ts`

### Profile settings: display name + picture (Claude Code)
- Settings → Profile: change your display name (up to 40 characters; save it empty to go back to your account name) and upload a profile picture (images under 5 MB; "Use account picture" removes it).
- App-only: DeepSpace refuses app writes to `name`/`imageUrl` on `users` (they come from the sign-in provider and are re-synced on every connect), so choices are stored in a new `profiles` collection (`userId`, `displayName`, `avatarUrl`; readable by members, editable only by the owner). Pictures upload with the built-in `useR2Files({ scope: 'app' })`, which is world-readable (fine for avatars, per DeepSpace docs).
- New `usePeople()` hook (`src/lib/use-people.ts`) returns name and picture with the profile first and the account as fallback; used on the game page, table, games list, leaderboard and the nav account button. The Admin user list still shows real account names and emails.
- Replaced pictures aren't deleted from storage (small, harmless leftovers).
- Files: `src/schemas/profiles-schema.ts` (new), `src/schemas.ts`, `src/lib/use-people.ts` (new), `src/pages/(app)/(protected)/settings.tsx`, `src/pages/(app)/(protected)/games/[id].tsx`, `src/pages/(app)/(protected)/games/index.tsx`, `src/pages/(app)/(protected)/leaderboard.tsx`, `src/components/Navigation.tsx`

### Fourth deploy (Claude Code)
- Merged `codes-profiles-wording` (bank wording, private join codes, profiles) into `main` and deployed. After deploy, an admin must click **Secure old join codes** on /admin once, or old games can't be joined by code.

### Venmo pay prompt on buy-in requests (Claude Code)
- Settings → Profile has a **Venmo username** field (accepts "@name" or "name"; 5–30 letters, numbers, hyphens, underscores). Stored on the player's `profiles` row (`venmoUsername`), so it applies to every game they host. Readable by signed-in members.
- When a player requests a buy-in in a game whose host has a Venmo username, a pop-up opens: "Pay {host} $X", showing @username, amount and note ("{game name} buy-in"), with **Open Venmo** (pre-filled pay link) and **Done**. Waiting requests get a **Pay host** button to reopen it. Without a host Venmo, the card just says to pay the host directly. The host still approves manually; Venmo offers apps no way to confirm a payment arrived.
- Link format from Venmo's payment-links docs (venmo.com/paymentlinks): `https://venmo.com/?txn=pay&recipients=…&amount=…&note=…`, plus `audience=private` so buy-ins stay out of public feeds. Helpers in `src/lib/venmo.ts` with unit tests (`venmo.test.ts`). The link itself hasn't been tried on a real phone yet.
- QR code skipped for now (would need the `qrcode` dependency).
- Files: `src/lib/venmo.ts` (new), `src/lib/venmo.test.ts` (new), `src/schemas/profiles-schema.ts`, `src/lib/use-people.ts`, `src/pages/(app)/(protected)/settings.tsx`, `src/pages/(app)/(protected)/games/[id].tsx`

## What I verified / changed

## Next steps
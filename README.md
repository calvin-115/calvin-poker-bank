# Calvin's Poker Bank

A bank for a home poker game, built on [DeepSpace](https://docs.deep.space).

**Live:** https://calvin-poker-bank.app.space

Players pay the host before they get chips. The app tracks every buy-in, checks the count at the end of the night, settles any miscount without charging losers more, and keeps a lifetime leaderboard.

## How a night works

1. **Host opens a table.** They name the game and pick a felt color. The server creates the game, a private six-character join code and the host's seat.
2. **Players join with the code.** The code is checked on the server; only the host, seated players and admins can ever read it.
3. **Players request buy-ins.** A request shows up live on the host's screen. If the host has a Venmo username in Settings, the player gets a pre-filled Venmo pay link. The host approves once the money arrives, and a chip flies into the pot on everyone's table.
4. **Cash out.** The host enters each player's chip count. If the count doesn't match the money in (lost or miscounted chips), the host picks how to absorb it:
   - winners split it in proportion to their winnings,
   - winners split it evenly, or
   - the host covers it.

   Losers already paid, so their amounts never change. A miss over 10% of the pot gets a "recount first?" warning.
5. **Close and pay out.** A recap crowns the night's winner and lists what the host pays each player; the host ticks each payout as paid. Every closed game feeds the leaderboard (podium, recent form, streaks, personal bests).

## How it uses DeepSpace

| Platform piece | Used for |
| --- | --- |
| Auth + roles (`useAuth`, `AuthGate`, `useUsers().setRole`) | Sign-in, protected pages, an Admin page that promotes admins. |
| Record collections with server-enforced RBAC (`useQuery`, `useMutations`) | All app data, synced live to every open screen. Permissions use `own`, `collaborator`, `userBound` and `ownerField` rather than hand-written checks. |
| Server actions (`src/actions/index.ts`) | The two rules RBAC can't express: hosting and joining a game with a private code, plus a one-time admin action that moves old games' codes. Each action checks the caller itself because actions run with RBAC off. |
| File storage (`useR2Files({ scope: 'app' })`) | Profile pictures. |
| Static prerendered page | The public landing page at `/`, which renders with no auth or data connection. |
| Agent tools (scaffold default, `src/ai/`) | Kept: AI agents can use the app as a signed-in member, with that member's permissions. |

### Integrations, and why there aren't more

None of the optional add-ons (`npx deepspace add …`) are installed, on purpose:

- **Payments (Stripe):** this is money between friends at one table. Card fees and payout accounts would add cost and setup with nothing gained over the host collecting directly.
- **Venmo** is a pre-filled pay link (format from venmo.com/paymentlinks), not an API integration. Venmo gives apps no way to confirm a payment arrived, so the host still approves by hand.
- **Messaging:** the table talk happens in person.
- **AI chat:** nothing in running a bank benefits from it.

## Main tradeoff

**The host approves buy-ins by hand instead of the app verifying payment.** It keeps the app simple and honest: there's no payment API to trust, and it matches how home games already work (pay the host, then get chips). The cost is that the host has to check their Venmo before approving.

Other deliberate choices:

- **Join codes live in their own `gameCodes` collection.** Games are readable by every member and DeepSpace has no per-field read rules, so hiding the code in the UI alone wouldn't protect it.
- **Profiles are app-only.** DeepSpace owns the sign-in account's name and photo (the `users` collection refuses app writes to them), so display names, pictures and Venmo usernames live in a `profiles` collection, with the account as fallback.
- **Money is integer cents in pure functions** (`src/lib/poker.ts`), unit-tested apart from the UI. A miscount is split with a largest-remainder method so shares always add up to the exact cent.

## Data model

| Collection | What it holds | Who can write |
| --- | --- | --- |
| `games` | Name, status, felt, ledger entries (buy-ins / cash-outs), miscount method, paid payouts | Any member can create one (the app does it through `hostGame`); only the host (`own`) or an admin can change it |
| `players` | One seat per person per game | Only server actions create seats; a player can remove their own |
| `buyinRequests` | A player's requested amount | The requesting player (create / cancel) |
| `gameCodes` | Join code + members allowed to read it | Server actions and admins only |
| `profiles` | Display name, picture URL, Venmo username | The owner |

Approving a request is a single write to the game (a ledger entry tagged with the request id), so a request can never be half-approved and players can't approve their own.

## Key files

- `src/lib/poker.ts`: ledger totals, miscount settlement and lifetime P&L (tests in `poker.test.ts`)
- `src/lib/stats.ts`: form, streaks and personal bests (tests in `stats.test.ts`)
- `src/lib/venmo.ts`: Venmo username parsing and pay links (tests in `venmo.test.ts`)
- `src/actions/index.ts`: `hostGame`, `joinGame`, `secureJoinCodes`
- `src/schemas/`: collections and their permissions
- `src/pages/(app)/(protected)/games/[id].tsx`: the game page (table, requests, cash-out, miscount panel, payouts)
- `src/components/PokerTable.tsx`: the SVG table and chip animation

## Run it

```sh
npm install
npx deepspace auth login
npm run dev            # local dev server
npm run type-check
npm run lint
npm run test:unit      # money math, stats, Venmo links, prerender
npm run test:e2e       # browser tests; needs the dev server and two test accounts
npx deepspace deploy   # ship to calvin-poker-bank.app.space
```



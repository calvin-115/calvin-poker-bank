/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 *
 * Top-level pages are also prerendered to static HTML at build
 * (prerender.ts, via vite.config.ts) so crawlers read real content.
 * Keep them renderable without a browser: no window/document during render,
 * prose in HTML text, reveal animations in CSS keyframes rather than JS-driven
 * initial states. `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Coins, HandCoins, Trophy } from 'lucide-react'
import { PokerTable, type TableSeat } from '../components/PokerTable'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const FEATURES = [
  { icon: Coins, title: 'Host-approved buy-ins', body: 'Players request chips; the host approves before it hits the ledger.' },
  { icon: HandCoins, title: 'Settle in few payments', body: 'Totals must balance to close, then everyone sees who pays whom.' },
  { icon: Trophy, title: 'Lifetime leaderboard', body: 'Every closed game adds to everyone’s running P&L.' },
]

// Illustration only: example players for the hero table, not real data.
const DEMO_SEATS: TableSeat[] = [
  { playerId: 'a', name: 'Ava', color: '#d7b8e8', caption: 'in $40', tone: 'neutral', isYou: false, buyinCents: 4000 },
  { playerId: 'b', name: 'Ben', color: '#f2c9a1', caption: '+$85', tone: 'up', isYou: false, buyinCents: 6000 },
  { playerId: 'c', name: 'Cleo', color: '#e8b4a0', caption: 'in $60', tone: 'neutral', isYou: false, buyinCents: 6000 },
  { playerId: 'd', name: 'Dev', color: '#a9c7e8', caption: '-$40', tone: 'down', isYou: false, buyinCents: 8000 },
  { playerId: 'e', name: 'Eli', color: '#f0d38a', caption: 'in $40', tone: 'neutral', isYou: false, buyinCents: 4000 },
  { playerId: 'f', name: 'Faye', color: '#b8e0c2', caption: 'in $60', tone: 'neutral', isYou: false, buyinCents: 4000 },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div
        data-testid="static-landing"
        className="bg-lamplight flex min-h-screen flex-col justify-center px-6 py-16"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="text-center lg:text-left">
            <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground lg:mx-0">
              <Coins className="size-6" aria-hidden />
            </span>
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-primary">{APP_NAME}</p>
            <h1 className="mb-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              The bank for our home game
            </h1>
            <p className="mx-auto mb-8 max-w-md text-muted-foreground lg:mx-0">
              Request buy-ins from your phone, cash out with chip counts, and see exactly
              who pays whom when the night is over.
            </p>
            <Link
              to="/games"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Enter the app
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div aria-hidden className="mx-auto w-full max-w-2xl">
            <PokerTable seats={DEMO_SEATS} potCents={36000} />
          </div>
        </div>

        <ul className="mx-auto mt-14 grid w-full max-w-6xl gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="size-5 text-primary" aria-hidden />
              <p className="mt-3 font-display text-lg font-bold text-foreground">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

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
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const FEATURES = [
  { icon: Coins, title: 'Host-approved buy-ins', body: 'Players request chips; the host approves before it hits the ledger.' },
  { icon: HandCoins, title: 'Settle in few payments', body: 'Totals must balance to close, then everyone sees who pays whom.' },
  { icon: Trophy, title: 'Lifetime leaderboard', body: 'Every closed game adds to everyone’s running P&L.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div
        data-testid="static-landing"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      >
        <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Coins className="size-6" aria-hidden />
        </span>
        <p className="mb-3 text-sm font-medium text-muted-foreground">{APP_NAME}</p>
        <h1 className="mb-4 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          The bank for our home game
        </h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          Request buy-ins from your phone, cash out with chip counts, and see exactly
          who pays whom when the night is over.
        </p>
        <Link
          to="/games"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Enter the app
          <ArrowRight className="size-4" aria-hidden />
        </Link>

        <ul className="mt-14 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-border bg-card p-4">
              <f.icon className="size-5 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium text-foreground">{f.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

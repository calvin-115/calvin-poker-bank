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

import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Coins, Crown, HandCoins, Monitor, Smartphone, Trophy, Users, Volume2 } from 'lucide-react'
import { CHIP_COLORS, ChipIcon } from '../components/Chip'
import { PokerTable, type TableSeat } from '../components/PokerTable'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { cn } from '../lib/utils'
import { seo } from '../seo'

// Illustration only: example players for the landing page, not real data.
const DEMO_SEATS: TableSeat[] = [
  { playerId: 'ava', name: 'Ava', color: '#d7b8e8', caption: 'in $40', tone: 'neutral', isYou: false, buyinCents: 4000 },
  { playerId: 'ben', name: 'Ben', color: '#f2c9a1', caption: '+$85', tone: 'up', isYou: false, buyinCents: 6000 },
  { playerId: 'cleo', name: 'Cleo', color: '#e8b4a0', caption: 'in $60', tone: 'neutral', isYou: false, buyinCents: 6000 },
  { playerId: 'dev', name: 'Dev', color: '#a9c7e8', caption: '-$40', tone: 'down', isYou: false, buyinCents: 8000 },
  { playerId: 'eli', name: 'Eli', color: '#f0d38a', caption: 'in $40', tone: 'neutral', isYou: false, buyinCents: 4000 },
  { playerId: 'faye', name: 'Faye', color: '#b8e0c2', caption: 'in $60', tone: 'neutral', isYou: false, buyinCents: 6000 },
]
const DEMO_POT = DEMO_SEATS.reduce((sum, s) => sum + s.buyinCents, 0)
// Seats still in play (no result yet) take the demo's rebuys in turn.
const REBUY_SEATS = DEMO_SEATS.flatMap((s, i) => (s.tone === 'neutral' ? [i] : []))
const REBUY_CENTS = 2000
const DEMO_ROUNDS = 8

const LOOSE_CHIPS = [
  { color: CHIP_COLORS.red, size: 'size-10', top: '4%', left: '6%', tilt: '-12deg', delay: '0s' },
  { color: CHIP_COLORS.brass, size: 'size-8', top: '10%', left: '88%', tilt: '18deg', delay: '1.2s' },
  { color: CHIP_COLORS.blue, size: 'size-12', top: '82%', left: '2%', tilt: '8deg', delay: '2.1s' },
  { color: CHIP_COLORS.brass, size: 'size-9', top: '88%', left: '84%', tilt: '-20deg', delay: '0.6s' },
  { color: CHIP_COLORS.red, size: 'size-7', top: '46%', left: '96%', tilt: '30deg', delay: '3s' },
]

const STEPS = [
  {
    title: 'Open a table',
    body: 'The host names the game and picks a felt. Everyone joins from their phone with a six-character code.',
  },
  {
    title: 'Pay to play',
    body: 'Players request a buy-in and hand the host the money. Chips hit the table only after the host approves.',
  },
  {
    title: 'Cash out and settle',
    body: 'Count the stacks, enter cash-outs and close the game. Everyone sees the results and the leaderboard updates.',
  },
]

const FEATURES = [
  {
    id: 'requests',
    icon: Coins,
    title: 'Buy-in requests',
    body: 'Players ask from their phone. The host approves or declines in one tap, and nothing reaches the ledger until they do.',
  },
  {
    id: 'table',
    icon: Users,
    title: 'A live table',
    body: 'Everyone sits around the felt with their stack. Chips fly into the pot the moment a buy-in lands.',
  },
  {
    id: 'settle',
    icon: HandCoins,
    title: 'Settle up',
    body: "Totals have to balance before the host can close. Then a recap crowns the night's winner and lists who's owed what.",
  },
  {
    id: 'leaderboard',
    icon: Trophy,
    title: 'Lifetime leaderboard',
    body: 'Every closed game counts toward a podium, win streaks and your best nights.',
  },
] as const
type FeatureId = (typeof FEATURES)[number]['id']

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      {/* clip, not hidden: hidden would turn this into a scroll container and break the sticky top bar. */}
      <div data-testid="static-landing" className="bg-lamplight min-h-screen overflow-x-clip text-foreground">
        <TopBar />
        <Hero />
        <HowItWorks />
        <Features />
        <Extras />
        <ClosingCta />
        <Footer />
      </div>
    </>
  )
}

function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Coins className="size-4" aria-hidden />
          </span>
          {APP_NAME}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#features" className="hover:text-foreground">Features</a>
        </nav>
        <div className="flex-1" />
        <Link
          to="/games"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
        >
          Enter the app
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:pt-20">
      <div className="text-center lg:text-left">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">The bank for your home game</p>
        <h1 className="mt-4 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Pay first.
          <br />
          Play after.
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground lg:mx-0">
          Players request a buy-in and pay the host before they get chips. The host approves, the table keeps
          score, and closing the game shows exactly who gets paid.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Host a game
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full border border-primary/50 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            Join with a code
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Works on your phone at the table and on a laptop at the host's seat.</p>
      </div>

      <div className="relative" aria-hidden>
        {LOOSE_CHIPS.map((chip, i) => (
          <ChipIcon
            key={i}
            color={chip.color}
            className={cn('animate-chip-float absolute drop-shadow-lg', chip.size)}
            style={{ top: chip.top, left: chip.left, animationDelay: chip.delay, '--tilt': chip.tilt } as CSSProperties}
          />
        ))}
        <LiveDemoTable />
      </div>
    </section>
  )
}

/** The hero table takes a $20 rebuy every few seconds so the real chip animation plays. */
function LiveDemoTable() {
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setRound((r) => (r + 1) % DEMO_ROUNDS), 2600)
    return () => clearInterval(timer)
  }, [])

  const seats = DEMO_SEATS.map((seat, i) => {
    const rebuys = Array.from({ length: round }, (_, k) => REBUY_SEATS[k % REBUY_SEATS.length]).filter((s) => s === i).length
    if (rebuys === 0) return seat
    const buyinCents = seat.buyinCents + rebuys * REBUY_CENTS
    return { ...seat, buyinCents, caption: `in $${buyinCents / 100}` }
  })

  return <PokerTable seats={seats} potCents={DEMO_POT + round * REBUY_CENTS} />
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-muted-foreground">{body}</p>}
    </div>
  )
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 border-y border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="How a night works" title="From the first buy-in to the last payout" />
        <ol className="relative mt-12 grid gap-10 md:grid-cols-3">
          <span
            aria-hidden
            className="absolute left-6 right-6 top-6 hidden border-t-2 border-dashed border-primary/30 md:block"
          />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative grid gap-3">
              <span className="relative flex size-12 items-center justify-center">
                <ChipIcon color={CHIP_COLORS.brass} className="absolute inset-0 size-12" />
                <span className="relative flex size-6 items-center justify-center rounded-full bg-[#22150c] font-display text-sm font-bold text-primary">
                  {i + 1}
                </span>
              </span>
              <h3 className="font-display text-xl font-bold">{step.title}</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Features() {
  const [active, setActive] = useState<FeatureId>('requests')

  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-20">
      <SectionHeading
        eyebrow="Features"
        title="Everything the bank needs, nothing it doesn't"
        body="Built around one rule: chips only go on the table after the money goes to the host."
      />
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <div role="tablist" aria-label="Features" aria-orientation="vertical" className="grid gap-2">
          {FEATURES.map((f) => {
            const selected = f.id === active
            return (
              <button
                key={f.id}
                id={`feature-tab-${f.id}`}
                role="tab"
                aria-selected={selected}
                aria-controls="feature-panel"
                onClick={() => setActive(f.id)}
                className={cn(
                  'flex gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-primary/50 bg-card' : 'border-transparent hover:bg-card/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <f.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-lg font-bold">{f.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{f.body}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div
          id="feature-panel"
          role="tabpanel"
          aria-labelledby={`feature-tab-${active}`}
          className="flex min-h-[380px] items-center rounded-3xl border border-border bg-card p-5 lg:p-8"
        >
          <div key={active} className="w-full animate-in fade-in-0 slide-in-from-bottom-2">
            {active === 'requests' && <RequestsPreview />}
            {active === 'table' && <PokerTable seats={DEMO_SEATS} potCents={DEMO_POT} />}
            {active === 'settle' && <SettlePreview />}
            {active === 'leaderboard' && <LeaderboardPreview />}
          </div>
        </div>
      </div>
    </section>
  )
}

function DemoAvatar({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#22150c]" style={{ background: color }}>
      {name.charAt(0)}
    </span>
  )
}

function RequestsPreview() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-background/50 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Player's phone</p>
        <p className="mt-2 font-display text-lg font-bold">Need chips?</p>
        <div className="mt-3 flex gap-2">
          <span className="flex h-10 flex-1 items-center rounded-md border border-input px-3 text-sm">$40</span>
          <span className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
            <Coins className="size-4" aria-hidden />
            Request
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">$40 · Waiting for host</p>
      </div>
      <div className="rounded-2xl border border-primary/50 bg-background/50 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Host · Buy-in requests · 2</p>
        <ul className="mt-2 divide-y divide-border text-sm">
          {[
            { name: 'Ava', color: '#d7b8e8', amount: '$40' },
            { name: 'Dev', color: '#a9c7e8', amount: '$20' },
          ].map((r) => (
            <li key={r.name} className="flex items-center gap-2 py-2.5">
              <DemoAvatar name={r.name} color={r.color} />
              <span className="flex-1">
                {r.name} <span className="font-display font-bold">{r.amount}</span>
              </span>
              <span className="text-xs text-muted-foreground">Decline</span>
              <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Approve</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SettlePreview() {
  return (
    <div className="grid gap-4">
      <div className="felt felt-ring rounded-2xl px-6 py-6 text-center text-[#f2e6cf]">
        <p className="font-mono text-xs uppercase tracking-widest opacity-80">Game closed</p>
        <p className="mt-2 flex items-center justify-center gap-2 font-display text-3xl font-bold">
          <Crown className="size-6 text-primary" aria-hidden />
          Ben +$85
        </p>
        <p className="mt-1 text-sm opacity-80">Biggest win of the night · 6 players · $360 pot</p>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-background/50 px-4 text-sm">
        {[
          { from: 'Dev', to: 'Ben', amount: '$40', paid: true },
          { from: 'Ava', to: 'Ben', amount: '$45', paid: false },
        ].map((p) => (
          <li key={p.from} className={cn('flex items-center justify-between gap-3 py-3', p.paid && 'opacity-60')}>
            <span className="flex items-center gap-2 font-medium">
              {p.from}
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              {p.to}
            </span>
            <span className="flex items-center gap-3">
              <span className={cn('font-display font-bold', p.paid && 'line-through')}>{p.amount}</span>
              {p.paid ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check className="size-3.5" aria-hidden />
                  Paid
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Unpaid</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LeaderboardPreview() {
  const podium = [
    { name: 'Cleo', color: '#e8b4a0', net: '+$210', place: 2, height: 'h-16' },
    { name: 'Ben', color: '#f2c9a1', net: '+$340', place: 1, height: 'h-24' },
    { name: 'Faye', color: '#b8e0c2', net: '+$95', place: 3, height: 'h-12' },
  ]
  const form = (results: ('up' | 'down')[]) =>
    results.map((r, i) => <span key={i} className={cn('size-2 rounded-full', r === 'up' ? 'bg-success' : 'bg-destructive')} />)
  return (
    <div className="grid gap-4">
      <div className="felt felt-ring rounded-2xl px-6 pt-5">
        <div className="mx-auto grid max-w-sm grid-cols-3 items-end gap-3 text-center text-[#f2e6cf]">
          {podium.map((p) => (
            <div key={p.name} className="flex flex-col items-center gap-1.5">
              {p.place === 1 && <Crown className="size-5 text-primary" aria-hidden />}
              <DemoAvatar name={p.name} color={p.color} />
              <span className="text-sm font-semibold">{p.name}</span>
              <span className={cn('flex w-full items-start justify-center rounded-t-xl bg-rail/90 pt-2 font-display font-bold text-success', p.height)}>
                {p.net}
              </span>
            </div>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-background/50 px-4 text-sm">
        <li className="flex items-center gap-3 py-3">
          <span className="w-4 text-xs text-muted-foreground">4</span>
          <DemoAvatar name="Ava" color="#d7b8e8" />
          <span className="flex-1">
            Ava
            <span className="ml-2 inline-flex gap-1 align-middle">{form(['up', 'up', 'down', 'up', 'up'])}</span>
            <span className="ml-2 rounded-full bg-success/15 px-1.5 py-px text-xs text-success">2 up in a row</span>
          </span>
          <span className="font-display font-bold text-success">+$40</span>
        </li>
        <li className="flex items-center gap-3 py-3">
          <span className="w-4 text-xs text-muted-foreground">5</span>
          <DemoAvatar name="Dev" color="#a9c7e8" />
          <span className="flex-1">
            Dev
            <span className="ml-2 inline-flex gap-1 align-middle">{form(['down', 'up', 'down', 'down', 'down'])}</span>
          </span>
          <span className="font-display font-bold text-destructive">-$160</span>
        </li>
      </ul>
    </div>
  )
}

function Extras() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 md:col-span-2">
          <h3 className="font-display text-xl font-bold">Pick your felt</h3>
          <p className="mt-1 text-sm text-muted-foreground">Green, blue or burgundy. Each game gets its own table color.</p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {(['green', 'blue', 'burgundy'] as const).map((felt) => (
              <div key={felt} data-felt={felt} className="felt felt-ring aspect-[2/1] rounded-[50%]" />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <Volume2 className="size-6 text-primary" aria-hidden />
          <h3 className="mt-4 font-display text-xl font-bold">Chip sounds</h3>
          <p className="mt-1 text-sm text-muted-foreground">A soft clack when a buy-in lands. Off until you turn it on.</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <span className="flex gap-2 text-primary">
            <Smartphone className="size-6" aria-hidden />
            <Monitor className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-display text-xl font-bold">Phone or laptop</h3>
          <p className="mt-1 text-sm text-muted-foreground">Join from your phone at the table. Run the bank from a laptop.</p>
        </div>
        <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border bg-card p-6 md:col-span-2 md:flex-row md:items-center">
          <div>
            <h3 className="font-display text-xl font-bold">No more IOUs</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Every buy-in goes through the host first, so nobody plays on credit and nobody chases money on Monday.
            </p>
          </div>
          <div className="flex shrink-0 -space-x-3" aria-hidden>
            {[CHIP_COLORS.red, CHIP_COLORS.blue, CHIP_COLORS.brass, CHIP_COLORS.red].map((color, i) => (
              <ChipIcon key={i} color={color} className="size-12 drop-shadow-lg" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="felt felt-ring rounded-3xl px-6 py-16 text-center text-[#f2e6cf]">
        <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Deal me in</h2>
        <p className="mx-auto mt-3 max-w-md opacity-85">Open a table for tonight's game in under a minute.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Host a game
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to="/games"
            className="inline-flex items-center rounded-full border border-[#f2e6cf]/50 px-6 py-3 text-sm font-semibold transition hover:bg-[#f2e6cf]/10"
          >
            Join with a code
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <span className="font-display font-bold text-foreground">{APP_NAME}</span>
        <nav className="flex gap-6">
          <Link to="/games" className="hover:text-foreground">Games</Link>
          <Link to="/leaderboard" className="hover:text-foreground">Leaderboard</Link>
          <Link to="/settings" className="hover:text-foreground">Settings</Link>
        </nav>
      </div>
    </footer>
  )
}

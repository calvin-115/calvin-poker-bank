import { useId, useState, type CSSProperties } from 'react'
import { CHIP_COLORS as CHIP, ChipFace } from '@/components/Chip'
import { formatCents } from '@/lib/poker'
import { playChipClack } from '@/lib/sound'
import { useAnimatedNumber } from '@/lib/use-animated-number'

export type TableSeat = {
  playerId: string
  name: string
  color: string
  imageUrl?: string
  /** Short line on the felt under the name, e.g. "in $40" or "+$85". */
  caption: string
  tone: 'up' | 'down' | 'neutral'
  isYou: boolean
  buyinCents: number
}

// Drawing space; the SVG scales to its container.
const CX = 400
const CY = 240
const SEAT = { rx: 350, ry: 196 }
const PLATE = { rx: 248, ry: 110 }
const POT_Y = CY + 62

const CHIP_COLORS = [CHIP.red, CHIP.blue, CHIP.brass]
const TONE_FILL = { up: 'var(--color-success)', down: 'var(--color-destructive)', neutral: 'rgb(242 230 207 / 0.75)' }

/**
 * Top-down poker table. Seats run clockwise from the bottom, starting with the
 * viewer. When a seat's buy-in total grows, a chip flies from that seat into
 * the pot.
 */
export function PokerTable({ seats, potCents }: { seats: TableSeat[]; potCents: number }) {
  const uid = useId()
  const pot = useAnimatedNumber(potCents)

  const youIndex = seats.findIndex((s) => s.isYou)
  const ordered = youIndex > 0 ? [...seats.slice(youIndex), ...seats.slice(0, youIndex)] : seats
  const placed = ordered.map((seat, i) => {
    const angle = Math.PI / 2 + (i * 2 * Math.PI) / ordered.length
    return {
      seat,
      x: CX + SEAT.rx * Math.cos(angle),
      y: CY + SEAT.ry * Math.sin(angle),
      plateX: CX + PLATE.rx * Math.cos(angle),
      plateY: CY + PLATE.ry * Math.sin(angle),
    }
  })

  // Compare buy-ins with the last render to find who just bought in. This is
  // React's "adjust state when props change" pattern, so no effect is needed.
  const [seenBuyins, setSeenBuyins] = useState(() => buyinMap(seats))
  const [flights, setFlights] = useState<{ key: string; playerId: string }[]>([])
  if (seats.length !== seenBuyins.size || seats.some((s) => seenBuyins.get(s.playerId) !== s.buyinCents)) {
    const grown = seats.filter((s) => s.buyinCents > (seenBuyins.get(s.playerId) ?? 0))
    setSeenBuyins(buyinMap(seats))
    if (grown.length > 0) {
      const added = grown.map((s) => ({ key: `${s.playerId}-${s.buyinCents}`, playerId: s.playerId }))
      // StrictMode re-runs this render in development; don't queue the same flight twice.
      setFlights((f) => [...f, ...added.filter((a) => !f.some((x) => x.key === a.key))])
    }
  }

  const chipCount = potCents > 0 ? Math.min(18, Math.ceil(potCents / 2000)) : 0
  const stacks = CHIP_COLORS.map((color, s) => ({
    color,
    x: CX + (s - 1) * 34,
    count: Math.ceil((chipCount - s) / 3),
  }))

  return (
    <svg
      viewBox="0 0 800 480"
      className="block h-auto w-full"
      role="img"
      aria-label={`Poker table with ${seats.length} player${seats.length === 1 ? '' : 's'}, pot ${formatCents(potCents)}`}
    >
      <defs>
        <radialGradient id={`${uid}-felt`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" style={{ stopColor: 'var(--felt-hi)' }} />
          <stop offset="60%" style={{ stopColor: 'var(--felt)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--felt-lo)' }} />
        </radialGradient>
        <linearGradient id={`${uid}-rail`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4026" />
          <stop offset="50%" stopColor="#4a2c1b" />
          <stop offset="100%" stopColor="#2e1a10" />
        </linearGradient>
        <filter id={`${uid}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.1 0" result="grain" />
          <feComposite in="grain" in2="SourceGraphic" operator="in" result="clipped" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="clipped" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx={CX} cy={CY} rx="330" ry="172" fill={`url(#${uid}-rail)`} stroke="#7a4b2c" strokeWidth="2" />
      <ellipse cx={CX} cy={CY} rx="296" ry="140" fill={`url(#${uid}-felt)`} filter={`url(#${uid}-grain)`} />
      <ellipse cx={CX} cy={CY} rx="296" ry="140" fill="none" stroke="#d9a441" strokeOpacity="0.75" strokeWidth="2" />
      <ellipse cx={CX} cy={CY} rx="226" ry="94" fill="none" stroke="#f2e6cf" strokeOpacity="0.14" strokeWidth="1.5" strokeDasharray="6 6" />

      <text x={CX} y={CY - 44} textAnchor="middle" fill="#f2e6cf" fillOpacity="0.7" className="font-mono" fontSize="14" letterSpacing="4">
        POT
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle" fill="#f2e6cf" className="font-display" fontSize="58" fontWeight="700">
        {formatCents(pot)}
      </text>
      {stacks.map((stack) =>
        Array.from({ length: stack.count }, (_, level) => (
          <Chip key={`${stack.color}-${level}`} x={stack.x} y={POT_Y - level * 5} color={stack.color} />
        )),
      )}

      {seats.length === 0 && (
        <text x={CX} y={CY + 60} textAnchor="middle" fill="#f2e6cf" fillOpacity="0.6" fontSize="16">
          Waiting for players
        </text>
      )}

      {placed.map(({ seat, x, y, plateX, plateY }, i) => (
        <g key={seat.playerId}>
          <circle cx={x} cy={y} r="30" fill={seat.color} stroke={seat.isYou ? '#d9a441' : '#1b120d'} strokeWidth="4" />
          {seat.imageUrl ? (
            <>
              <clipPath id={`${uid}-seat-${i}`}>
                <circle cx={x} cy={y} r="28" />
              </clipPath>
              <image
                href={seat.imageUrl}
                x={x - 28}
                y={y - 28}
                width="56"
                height="56"
                clipPath={`url(#${uid}-seat-${i})`}
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          ) : (
            <text x={x} y={y + 7} textAnchor="middle" fill="#22150c" fontSize="20" fontWeight="600">
              {seat.name.charAt(0).toUpperCase()}
            </text>
          )}
          <text x={plateX} y={plateY - 2} textAnchor="middle" fill="#f2e6cf" fontSize="15" fontWeight="600">
            {seat.isYou ? 'You' : firstName(seat.name)}
          </text>
          <text x={plateX} y={plateY + 17} textAnchor="middle" style={{ fill: TONE_FILL[seat.tone] }} className="font-mono" fontSize="13">
            {seat.caption}
          </text>
        </g>
      ))}

      {flights.map((flight) => {
        const from = placed.find((p) => p.seat.playerId === flight.playerId)
        if (!from) return null
        const motion = {
          '--dx': `${CX - from.x}px`,
          '--dy': `${POT_Y - from.y}px`,
          transformBox: 'fill-box',
          transformOrigin: 'center',
        } as CSSProperties
        return (
          <g key={flight.key}>
            <circle
              cx={from.x}
              cy={from.y}
              r="34"
              fill="none"
              stroke="#d9a441"
              strokeWidth="3"
              className="animate-seat-glow"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
            <g
              className="animate-chip-fly"
              style={motion}
              onAnimationStart={playChipClack}
              onAnimationEnd={() => setFlights((f) => f.filter((x) => x.key !== flight.key))}
            >
              <Chip x={from.x} y={from.y} color={CHIP.brass} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}

function Chip({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ChipFace color={color} />
    </g>
  )
}

function buyinMap(seats: TableSeat[]) {
  return new Map(seats.map((s) => [s.playerId, s.buyinCents]))
}

function firstName(name: string) {
  const first = name.split(' ')[0]
  return first.length > 10 ? `${first.slice(0, 9)}…` : first
}

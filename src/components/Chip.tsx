import type { ComponentProps } from 'react'

export const CHIP_COLORS = { red: '#c8432e', blue: '#3d6fa3', brass: '#d9a441' } as const

/** A poker chip centred on (0, 0), for use inside an SVG. */
export function ChipFace({ color }: { color: string }) {
  return (
    <>
      <circle r="13" fill={color} stroke="#1b120d" strokeWidth="1" />
      <circle r="10" fill="none" stroke="#f2e6cf" strokeWidth="3.5" strokeDasharray="5 3.5" />
      <circle r="6.5" fill={color} stroke="#f2e6cf" strokeWidth="1" />
    </>
  )
}

/** A standalone chip, sized by CSS like an icon. */
export function ChipIcon({ color, ...props }: { color: string } & ComponentProps<'svg'>) {
  return (
    <svg viewBox="-14 -14 28 28" aria-hidden {...props}>
      <ChipFace color={color} />
    </svg>
  )
}

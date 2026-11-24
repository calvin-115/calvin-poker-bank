import { formatCents } from '@/lib/poker'
import { useAnimatedNumber } from '@/lib/use-animated-number'

/** A money amount that rolls to its new value when it changes. */
export function AnimatedCents({ cents, signed = false }: { cents: number; signed?: boolean }) {
  return <>{formatCents(useAnimatedNumber(cents), { signed })}</>
}

import { useEffect, useRef, useState } from 'react'

/** Rolls a displayed number from its previous value to `target` (ease-out). */
export function useAnimatedNumber(target: number, durationMs = 600) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = target
    if (from === target) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      setValue(Math.round(from + (target - from) * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

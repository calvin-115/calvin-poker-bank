import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import type { Game } from '@/schemas/games-schema'

export function GameStatusBadge({ status, className, ...props }: { status: Game['status'] } & ComponentProps<'span'>) {
  const isOpen = status === 'open'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        isOpen ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span className={cn('size-1.5 rounded-full', isOpen ? 'bg-success' : 'bg-muted-foreground')} />
      {status}
    </span>
  )
}

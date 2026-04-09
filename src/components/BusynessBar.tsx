'use client'
import clsx from 'clsx'

interface Props {
  busyness: number   // 0–100
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function BusynessBar({ busyness, showLabel = true, size = 'md' }: Props) {
  const color =
    busyness < 40 ? 'bg-emerald-400' :
    busyness < 70 ? 'bg-yellow-400' :
    'bg-red-500'

  const label =
    busyness < 25 ? 'Very quiet' :
    busyness < 50 ? 'Fairly quiet' :
    busyness < 70 ? 'Getting busy' :
    busyness < 85 ? 'Very busy' :
    'Packed'

  return (
    <div className="w-full">
      <div className={clsx(
        'w-full bg-zinc-700 rounded-full overflow-hidden',
        size === 'sm' ? 'h-1.5' : 'h-2.5'
      )}>
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${busyness}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-zinc-400">{label}</span>
          <span className="text-xs font-semibold text-zinc-300">{busyness}%</span>
        </div>
      )}
    </div>
  )
}
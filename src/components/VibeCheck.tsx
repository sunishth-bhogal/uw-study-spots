'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { VibeOption } from '@/lib/types'

const VIBES: {
  value: VibeOption
  shortLabel: string
  longLabel: string
}[] = [
  {
    value: 'less_packed',
    shortLabel: 'Quiet',
    longLabel: 'Less packed than expected',
  },
  {
    value: 'accurate',
    shortLabel: 'Moderate',
    longLabel: 'Looks about right',
  },
  {
    value: 'more_packed',
    shortLabel: 'Busy',
    longLabel: 'More packed than expected',
  },
]

interface VibeCounts {
  less_packed: number
  accurate: number
  more_packed: number
  total: number
}

interface Props {
  locationId: string
}

function getVoteKey(locationId: string) {
  return `vibe-${locationId}`
}

export function VibeCheck({ locationId }: Props) {
  const [selected, setSelected] = useState<VibeOption | null>(null)
  const [counts, setCounts] = useState<VibeCounts | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/reports/vibe?locationId=${locationId}`)
      .then((r) => r.json())
      .then(setCounts)
      .catch(() => {})

    const stored = sessionStorage.getItem(getVoteKey(locationId))
    if (stored) setSelected(stored as VibeOption)
  }, [locationId])

  const submit = async (vibe: VibeOption) => {
    if (submitting || selected) return

    setSubmitting(true)

    try {
      const res = await fetch('/api/reports/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, vibe }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit vibe check')
      }

      setSelected(vibe)
      sessionStorage.setItem(getVoteKey(locationId), vibe)

      const refreshed = await fetch(`/api/reports/vibe?locationId=${locationId}`)
      setCounts(await refreshed.json())
    } catch {
      // no-op
    } finally {
      setSubmitting(false)
    }
  }

  const hasRecentActivity = Boolean(counts && counts.total > 0)

  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'h-2.5 w-2.5 rounded-full',
              hasRecentActivity ? 'bg-emerald-400' : 'bg-zinc-600'
            )}
          />
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Quick update
          </p>
        </div>

        <p className="text-[11px] text-zinc-500">
          {counts
            ? `${counts.total} report${counts.total === 1 ? '' : 's'} in last 24h`
            : 'Loading…'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {VIBES.map(({ value, shortLabel, longLabel }) => (
          <button
            key={value}
            onClick={() => submit(value)}
            disabled={!!selected || submitting}
            title={longLabel}
            className={clsx(
              'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-all',
              selected === value
                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                : selected
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/60 text-zinc-600'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
            )}
          >
            <span className="text-xs font-medium">{shortLabel}</span>
            {counts && (
              <span className="text-[10px] text-zinc-500">{counts[value]}</span>
            )}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-zinc-500">
        Tap once to help improve this spot’s status for the next 24 hours.
      </p>

      {selected && (
        <p className="mt-1 text-[11px] text-zinc-500">
          Thanks — you already submitted feedback for this location on this device.
        </p>
      )}
    </div>
  )
}
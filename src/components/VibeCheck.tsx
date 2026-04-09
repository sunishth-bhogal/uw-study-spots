'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { VibeOption } from '@/lib/types'

const VIBES: { value: VibeOption; emoji: string; label: string }[] = [
  { value: 'less_packed', emoji: '😌', label: 'Less packed' },
  { value: 'accurate', emoji: '✓', label: 'Accurate' },
  { value: 'more_packed', emoji: '🔥', label: 'More packed' },
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
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">
        Vibe check · last hour {counts ? `(${counts.total} reports)` : ''}
      </p>

      <div className="flex gap-2">
        {VIBES.map(({ value, emoji, label }) => (
          <button
            key={value}
            onClick={() => submit(value)}
            disabled={!!selected || submitting}
            className={clsx(
              'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg border text-xs transition-all',
              selected === value
                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                : selected
                  ? 'border-zinc-700 bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
            )}
          >
            <span className="text-base">{emoji}</span>
            <span>{label}</span>
            {counts && (
              <span className="text-zinc-500 text-[10px]">
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <p className="mt-2 text-xs text-zinc-500">
          You already voted for this location on this device.
        </p>
      )}
    </div>
  )
}
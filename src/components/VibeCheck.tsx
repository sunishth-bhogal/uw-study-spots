'use client'
import { useState, useEffect } from 'react'
import { VibeOption } from '@/lib/types'
import { useStreak } from '@/hooks/useStreak'
import clsx from 'clsx'

const VIBES: { value: VibeOption; label: string }[] = [
  { value: 'less_packed', label: 'Less packed' },
  { value: 'accurate',  label: 'Accurate' },
  { value: 'more_packed', label: 'More packed' },
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

export function VibeCheck({ locationId }: Props) {
  const [selected, setSelected] = useState<VibeOption | null>(null)
  const [counts, setCounts] = useState<VibeCounts | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [justReported, setJustReported] = useState(false)
  const { streak, recordReport } = useStreak()

  // Load existing vibe counts
  useEffect(() => {
    fetch(`/api/reports/vibe?locationId=${locationId}`)
      .then((r) => r.json())
      .then(setCounts)
      .catch(() => {})

    // Restore previous selection from sessionStorage
    const stored = sessionStorage.getItem(`vibe-${locationId}`)
    if (stored) setSelected(stored as VibeOption)
  }, [locationId])

  const submit = async (vibe: VibeOption) => {
    if (submitting || selected) return
    setSubmitting(true)
    try {
      await fetch('/api/reports/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, vibe }),
      })
      setSelected(vibe)
      sessionStorage.setItem(`vibe-${locationId}`, vibe)
      recordReport()
      setJustReported(true)
      setTimeout(() => setJustReported(false), 3000)
      // Refresh counts
      const res = await fetch(`/api/reports/vibe?locationId=${locationId}`)
      setCounts(await res.json())
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
        {VIBES.map(({ value, label }) => (
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
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 cursor-pointer'
            )}
          >
            <span>{label}</span>
            {counts && (
              <span className="text-zinc-500 text-[10px]">
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Streak toast — shown briefly after submitting */}
      {justReported && streak.current > 0 && (
        <p className="mt-2 text-center text-xs text-gold-400 animate-pulse">
          {streak.current === 1
            ? '✓ Report submitted!'
            : `🔥 ${streak.current}-day streak — thanks for helping!`}
        </p>
      )}
    </div>
  )
}
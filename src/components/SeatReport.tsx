'use client'
import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

const SEAT_OPTIONS = [
  { label: 'None', value: 0 },
  { label: '1–10', value: 5 },
  { label: '10–25', value: 17 },
  { label: '25–50', value: 37 },
  { label: '50+', value: 60 },
]

interface Props {
  locationId: string
}

export function SeatReport({ locationId }: Props) {
  const [lastReport, setLastReport] = useState<{ seats_available: number; submitted_at: string } | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/reports/seats?locationId=${locationId}`)
      .then((r) => r.json())
      .then((d) => setLastReport(d.report))
      .catch(() => {})
  }, [locationId])

  const submit = async () => {
    if (selected === null || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/reports/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, seatsAvailable: selected }),
      })
      setSubmitted(true)
      setLastReport({ seats_available: selected, submitted_at: new Date().toISOString() })
    } finally {
      setSubmitting(false)
    }
  }

  const labelForValue = (v: number) =>
    SEAT_OPTIONS.find((o) => o.value === v)?.label ?? `~${v}`

  return (
    <div className="mt-4 p-4 bg-zinc-800/60 rounded-xl border border-zinc-700">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-zinc-300">Report open seats</p>
        {lastReport && (
          <span className="text-xs text-zinc-500">
            Last: <span className="text-zinc-300">{labelForValue(lastReport.seats_available)}</span>
            {' '}· {formatDistanceToNow(new Date(lastReport.submitted_at), { addSuffix: true })}
          </span>
        )}
      </div>

      {submitted ? (
        <p className="text-sm text-emerald-400">Thanks for reporting! 🙌</p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap mb-3">
            {SEAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  selected === opt.value
                    ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={selected === null || submitting}
            className="w-full py-2 rounded-lg bg-gold-500 text-zinc-900 font-semibold text-sm
                       hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
        </>
      )}
    </div>
  )
}
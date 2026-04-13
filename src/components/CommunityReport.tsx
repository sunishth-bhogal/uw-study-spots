'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'

interface Props {
  locationId: string
}

interface CommunitySummary {
  avg_crowdedness: number | null
  avg_seats_available: number | null
  avg_quietness: number | null
  any_open_report: boolean
  report_count: number
  last_reported_at: string | null
}

interface CommunityReportRow {
  id: string
  location_id: string
  crowdedness: number | null
  seats_available: number | null
  quietness: number | null
  has_outlets: boolean | null
  has_food_nearby: boolean | null
  is_open: boolean | null
  floor_label: string | null
  note: string | null
  submitted_at: string
}

const crowdednessOptions = [
  { label: 'Empty',    value: 20 },
  { label: 'Moderate', value: 45 },
  { label: 'Busy',     value: 70 },
  { label: 'Packed',   value: 90 },
]

const quietnessOptions = [1, 2, 3, 4, 5]

const REPORT_COOLDOWN_MINUTES = 60

function getCooldownKey(locationId: string) {
  return `community-report-lock:${locationId}`
}

function minutesRemaining(untilIso: string | null) {
  if (!untilIso) return 0
  const diffMs = new Date(untilIso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 60000))
}

export function CommunityReport({ locationId }: Props) {
  const [summary, setSummary]   = useState<CommunitySummary | null>(null)
  const [reports, setReports]   = useState<CommunityReportRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null)

  // Form fields — seats + isOpen removed
  const [crowdedness,  setCrowdedness]  = useState<number | null>(null)
  const [quietness,    setQuietness]    = useState<number | null>(null)
  const [note,         setNote]         = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reports/community?locationId=${locationId}`)
      if (!res.ok) throw new Error('Failed to load community reports')
      const data = await res.json()
      setSummary(data.summary ?? null)
      setReports(data.reports ?? [])
      setError(null)
    } catch {
      setError('Could not load community reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [locationId])

  useEffect(() => {
    const key = getCooldownKey(locationId)
    const stored = window.localStorage.getItem(key)

    if (!stored) { setCooldownUntil(null); return }

    const remaining = minutesRemaining(stored)
    if (remaining <= 0) {
      window.localStorage.removeItem(key)
      setCooldownUntil(null)
      return
    }

    setCooldownUntil(stored)

    const interval = window.setInterval(() => {
      const next = window.localStorage.getItem(key)
      if (!next || minutesRemaining(next) <= 0) {
        window.localStorage.removeItem(key)
        setCooldownUntil(null)
        window.clearInterval(interval)
      } else {
        setCooldownUntil(next)
      }
    }, 15000)

    return () => window.clearInterval(interval)
  }, [locationId, submitted])

  const cooldownMinutesLeft = useMemo(() => minutesRemaining(cooldownUntil), [cooldownUntil])
  const isLocked = cooldownMinutesLeft > 0

  const resetForm = () => {
    setCrowdedness(null)
    setQuietness(null)
    setNote('')
  }

  const submit = async () => {
    if (submitting || isLocked) return
    try {
      setSubmitting(true)
      setSubmitted(false)
      setError(null)

      const res = await fetch('/api/reports/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          crowdedness,
          seatsAvailable: null,
          quietness,
          isOpen: null,
          hasOutlets: null,
          hasFoodNearby: null,
          floorLabel: null,
          note,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit report')

      const until = new Date(Date.now() + REPORT_COOLDOWN_MINUTES * 60 * 1000).toISOString()
      window.localStorage.setItem(getCooldownKey(locationId), until)
      setCooldownUntil(until)

      setSubmitted(true)
      resetForm()
      await loadData()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Student reports</h2>
          <p className="text-sm text-zinc-500">
            Community-submitted info for this location. This is not official building-hours data.
          </p>
        </div>
        {summary && (
          <div className="text-right text-xs text-zinc-500 shrink-0">
            <div>{summary.report_count} recent reports</div>
            {summary.last_reported_at && (
              <div>
                Last report:{' '}
                {new Date(summary.last_reported_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary stats — just crowdedness + quietness */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
            <div className="text-lg font-bold text-zinc-100">
              {summary.avg_crowdedness != null ? `${summary.avg_crowdedness}%` : '—'}
            </div>
            <div className="text-xs text-zinc-500">Avg crowdedness</div>
          </div>
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
            <div className="text-lg font-bold text-zinc-100">
              {summary.avg_quietness != null ? `${summary.avg_quietness} / 5` : '—'}
            </div>
            <div className="text-xs text-zinc-500">Avg quietness</div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-5">
        {/* Crowdedness */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">How crowded was it?</p>
          <div className="flex flex-wrap gap-2">
            {crowdednessOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setCrowdedness(opt.value)}
                disabled={isLocked}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm border transition-colors',
                  crowdedness === opt.value
                    ? 'bg-gold-500 text-zinc-900 border-gold-500 font-semibold'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700',
                  isLocked && 'opacity-60 cursor-not-allowed'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quietness */}
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">How quiet was it?</p>
          <div className="flex gap-2">
            {quietnessOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuietness(value)}
                disabled={isLocked}
                className={clsx(
                  'w-10 h-10 rounded-lg text-sm border transition-colors',
                  quietness === value
                    ? 'bg-gold-500 text-zinc-900 border-gold-500 font-semibold'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700',
                  isLocked && 'opacity-60 cursor-not-allowed'
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">1 = noisy · 5 = very quiet</p>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Note <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isLocked}
            placeholder="e.g. noisy near the entrance, 3rd floor is quiet"
            maxLength={300}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-gold-500 disabled:opacity-60"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {submitted && !error && (
          <p className="text-sm text-emerald-400">Thanks — your report was submitted!</p>
        )}

        {isLocked && (
          <p className="text-sm text-zinc-500">
            Already submitted recently. You can report again in ~{cooldownMinutesLeft} min.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || isLocked}
            className="px-5 py-2.5 rounded-xl bg-gold-500 text-zinc-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : isLocked ? 'Recently submitted' : 'Submit report'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={isLocked}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Recent reports log */}
      <details className="mt-8">
        <summary className="text-sm font-semibold text-zinc-200 cursor-pointer select-none">
          Recent reports ({reports.length})
        </summary>
        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent reports yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => (
                <div key={report.id} className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 mb-2">
                    <span>
                      {new Date(report.submitted_at).toLocaleString([], {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                    {report.floor_label && <span>{report.floor_label}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs mb-2">
                    {report.crowdedness !== null && (
                      <span className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
                        {report.crowdedness}% crowded
                      </span>
                    )}
                    {report.quietness !== null && (
                      <span className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
                        quietness {report.quietness}/5
                      </span>
                    )}
                  </div>
                  {report.note && <p className="text-sm text-zinc-300">{report.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
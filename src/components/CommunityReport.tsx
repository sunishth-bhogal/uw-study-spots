'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'

interface Props {
  locationId: string
  locationName?: string
  compact?: boolean
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
  { label: 'Empty', value: 20 },
  { label: 'Moderate', value: 45 },
  { label: 'Busy', value: 70 },
  { label: 'Packed', value: 90 },
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

export function CommunityReport({ locationId, locationName, compact = false }: Props) {
  const [summary, setSummary] = useState<CommunitySummary | null>(null)
  const [reports, setReports] = useState<CommunityReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)

  const [crowdedness, setCrowdedness] = useState<number | null>(null)
  const [quietness, setQuietness] = useState<number | null>(null)
  const [note, setNote] = useState('')

  const displayName = locationName ?? 'this study spot'

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

  useEffect(() => {
    loadData()
  }, [locationId])

  useEffect(() => {
    const key = getCooldownKey(locationId)
    const stored = window.localStorage.getItem(key)

    if (!stored) {
      setCooldownUntil(null)
      return
    }

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
  const hasSummaryStats =
    summary &&
    (summary.avg_crowdedness != null || summary.avg_quietness != null || summary.report_count > 0)

  const resetForm = () => {
    setCrowdedness(null)
    setQuietness(null)
    setNote('')
    setShowNote(false)
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
    <div
      className={clsx(
        'bg-zinc-900 border border-zinc-800 rounded-2xl',
        compact ? 'p-4 sm:p-5' : 'p-6'
      )}
    >
      <div className={clsx('flex flex-col', compact ? 'gap-3 mb-4' : 'gap-4 mb-6')}>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-400">
            Anonymous
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
            Quick report
          </span>
          {!compact && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
              Helps other students
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className={clsx('max-w-2xl', compact && 'max-w-none')}>
            <h2
              className={clsx(
                'font-semibold text-zinc-100 mb-2',
                compact ? 'text-lg' : 'text-xl'
              )}
            >
              {compact ? 'Leave a quick anonymous report' : 'Help the next student out'}
            </h2>

            <p className={clsx('text-zinc-400 leading-6', compact ? 'text-sm' : 'text-sm')}>
              Tell people what{' '}
              <span className="text-zinc-200 font-medium">{displayName}</span> feels like right now
              before they start walking there.
              {compact && ' Takes a few seconds.'}
            </p>

            {!compact && (
              <p className="text-sm text-zinc-500 leading-6 mt-2">
                UW Study Spots only gets better if students keep helping students, so every report
                makes this page more useful for everyone else.
              </p>
            )}
          </div>

          {summary && summary.report_count > 0 && (
            <div className="text-left sm:text-right text-xs text-zinc-500 shrink-0">
              <div>{summary.report_count} recent report{summary.report_count === 1 ? '' : 's'}</div>
              {summary.last_reported_at && (
                <div>
                  Last report{' '}
                  {new Date(summary.last_reported_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {hasSummaryStats && (
        <div
          className={clsx(
            'grid gap-3',
            compact ? 'grid-cols-1 sm:grid-cols-3 mb-4' : 'grid-cols-1 sm:grid-cols-3 mb-6'
          )}
        >
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
            <div className="text-base font-bold text-zinc-100">
              {summary?.report_count ?? 0}
            </div>
            <div className="text-xs text-zinc-500">Recent reports</div>
          </div>

          {summary?.avg_crowdedness != null && (
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
              <div className="text-base font-bold text-zinc-100">
                {summary.avg_crowdedness}%
              </div>
              <div className="text-xs text-zinc-500">Avg crowdedness</div>
            </div>
          )}

          {summary?.avg_quietness != null && (
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">
              <div className="text-base font-bold text-zinc-100">
                {summary.avg_quietness} / 5
              </div>
              <div className="text-xs text-zinc-500">Avg quietness</div>
            </div>
          )}
        </div>
      )}

      <div className={clsx('space-y-4', !compact && 'space-y-5')}>
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">
            {compact ? 'How crowded?' : 'How crowded was it?'}
          </p>
          <div className="flex flex-wrap gap-2">
            {crowdednessOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setCrowdedness(opt.value)}
                disabled={isLocked}
                className={clsx(
                  'rounded-lg text-sm border transition-colors',
                  compact ? 'px-3 py-2' : 'px-3 py-2',
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

        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">
            {compact ? 'How quiet?' : 'How quiet was it?'}
          </p>
          <div className="flex gap-2 flex-wrap">
            {quietnessOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuietness(value)}
                disabled={isLocked}
                className={clsx(
                  'rounded-lg text-sm border transition-colors',
                  compact ? 'w-9 h-9' : 'w-10 h-10',
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

        {compact ? (
          <div>
            {!showNote ? (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                disabled={isLocked}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                + Add optional note
              </button>
            ) : (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Note <span className="text-zinc-500 font-normal">(optional)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isLocked}
                  placeholder="e.g. upstairs is quieter"
                  maxLength={300}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-gold-500 disabled:opacity-60"
                />
                <p className="text-xs text-zinc-500 mt-2">Keep it short. No personal info.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Note <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isLocked}
              placeholder="e.g. packed near the entrance, upstairs is quieter"
              maxLength={300}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-gold-500 disabled:opacity-60"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Keep it short and helpful. No personal info needed.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {submitted && !error && (
          <p className="text-sm text-emerald-400">
            Thanks — your anonymous report was submitted.
          </p>
        )}

        {isLocked && (
          <p className="text-sm text-zinc-500">
            Already submitted recently from this device. You can report again in about{' '}
            {cooldownMinutesLeft} min.
          </p>
        )}

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || isLocked}
            className="px-5 py-2.5 rounded-xl bg-gold-500 text-zinc-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting
              ? 'Submitting…'
              : isLocked
                ? 'Recently submitted'
                : compact
                  ? 'Submit report'
                  : 'Submit anonymous report'}
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

      <details className={clsx(compact ? 'mt-5' : 'mt-8')}>
        <summary className="text-sm font-semibold text-zinc-200 cursor-pointer select-none">
          Recent anonymous reports ({reports.length})
        </summary>

        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No recent reports yet. Be the first one to help out.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, compact ? 3 : 5).map((report) => (
                <div
                  key={report.id}
                  className={clsx(
                    'bg-zinc-950/60 border border-zinc-800 rounded-xl',
                    compact ? 'p-3' : 'p-4'
                  )}
                >
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 mb-2">
                    <span>
                      {new Date(report.submitted_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
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
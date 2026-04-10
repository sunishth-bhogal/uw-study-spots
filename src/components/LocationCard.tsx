'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { Location } from '@/lib/types'
import { BusynessBar } from './BusynessBar'
import { VibeCheck } from './VibeCheck'

interface Props {
  location: Location
  isFavourite: boolean
  onToggleFavourite: (id: string) => void
  compact?: boolean
}

interface LastReading {
  busyness: number
  count: number
  capacity: number
  recorded_at: string
}

function getNumberValue(location: Location, keys: string[]) {
  for (const key of keys) {
    const value = Number((location as any)[key])
    if (Number.isFinite(value)) return value
  }
  return null
}

function getStringValue(location: Location, keys: string[]) {
  for (const key of keys) {
    const value = (location as any)[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

function getSource(location: Location) {
  return getStringValue(location, ['dataSource', 'source']) ?? 'building'
}

function getReportCount(location: Location) {
  return getNumberValue(location, ['reportCount', 'report_count']) ?? 0
}

function getLastReportedAt(location: Location) {
  return getStringValue(location, ['lastReportedAt', 'last_reported_at'])
}

function getCurrentOccupancy(location: Location) {
  return getNumberValue(location, ['currentOccupancy', 'current_occupancy', 'count']) ?? 0
}

function getCapacity(location: Location) {
  return getNumberValue(location, ['capacity']) ?? 0
}

function hasLiveOccupancyData(location: Location) {
  const current = getCurrentOccupancy(location)
  const capacity = getCapacity(location)
  return capacity > 0 && current >= 0
}

function getCategoryLabel(location: Location) {
  const category = getStringValue(location, ['category'])
  switch (category) {
    case 'library': return 'Library'
    case 'study_space': return 'Study space'
    case 'quiet_study': return 'Quiet study'
    case 'casual_space': return 'Casual study'
    case 'classroom_space': return 'Classroom study'
    default: return 'Campus building'
  }
}

function getDisplayBusyness(location: Location, lastReading: LastReading | null) {
  if (hasLiveOccupancyData(location)) return location.busyness
  if (getReportCount(location) > 0) return location.busyness
  if (lastReading) return lastReading.busyness
  return null
}

export function LocationCard({ location, isFavourite, onToggleFavourite, compact }: Props) {
  const [lastReading, setLastReading] = useState<LastReading | null>(null)

  const source = getSource(location)
  const reportCount = getReportCount(location)
  const lastReportedAt = getLastReportedAt(location)
  const currentOccupancy = getCurrentOccupancy(location)
  const capacity = getCapacity(location)
  const liveData = hasLiveOccupancyData(location)
  const hasStudentReports = reportCount > 0 || Boolean(lastReportedAt)
  const subLocations = Array.isArray(location.subLocations) ? location.subLocations : []

  // Only show quick feedback if there's actual data to confirm or correct
  const showQuickFeedback = !compact && (liveData || hasStudentReports)

  useEffect(() => {
    if (source === 'waitz' && !liveData) {
      fetch(`/api/history/${location.id}?mode=last`)
        .then((r) => r.json())
        .then((d) => setLastReading(d.last ?? null))
        .catch(() => {})
    } else {
      setLastReading(null)
    }
  }, [location.id, source, liveData])

  const displayBusyness = getDisplayBusyness(location, lastReading)

  const dotColor =
    displayBusyness === null
      ? 'bg-zinc-600'
      : displayBusyness < 40
        ? 'bg-emerald-400'
        : displayBusyness < 70
          ? 'bg-yellow-400'
          : 'bg-red-500'

  const primaryBadge = liveData
    ? source === 'waitz'
      ? 'Waitz live data'
      : 'Live data'
    : hasStudentReports
      ? 'Reported in last 24h'
      : source === 'waitz'
        ? 'No live reading'
        : 'No reports in last 24h'

  const primaryBadgeClass = liveData
    ? 'bg-emerald-400/10 text-emerald-400'
    : hasStudentReports
      ? 'bg-blue-400/10 text-blue-300'
      : 'bg-zinc-800 text-zinc-400'

  let summaryText = 'Hours unverified'

  if (liveData) {
    summaryText = `~${currentOccupancy} / ${capacity} people`
  } else if (reportCount > 0 && lastReportedAt) {
    summaryText = `${reportCount} report${reportCount === 1 ? '' : 's'} in last 24h · last ${formatDistanceToNow(
      new Date(lastReportedAt),
      { addSuffix: true }
    )}`
  } else if (reportCount > 0) {
    summaryText = `${reportCount} report${reportCount === 1 ? '' : 's'} in last 24h`
  } else if (lastReading) {
    summaryText = `Last live reading ${formatDistanceToNow(new Date(lastReading.recorded_at), {
      addSuffix: true,
    })}`
  }

  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-600 hover:shadow-lg hover:shadow-black/20',
        isFavourite && 'border-gold-500/40'
      )}
    >
      {/* Full-card link underneath everything */}
      <Link
        href={`/location/${location.id}`}
        aria-label={`View details for ${location.name}`}
        className="absolute inset-0 z-0"
      />

      {/* Favourite button — interactive, above the link */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavourite(location.id)
        }}
        aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        className="relative z-20 ml-auto block text-lg leading-none transition-transform hover:scale-110"
      >
        {isFavourite ? '⭐' : '☆'}
      </button>

      {/* Card content — pointer-events-none so clicks fall through to the link */}
      <div className="relative z-10 -mt-6 pointer-events-none">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-start gap-2 min-w-0">
              <span className={clsx('mt-1 h-2 w-2 flex-shrink-0 rounded-full', dotColor)} />
              <h3 className="leading-tight font-semibold text-zinc-100 transition-colors group-hover:text-gold-400">
                {location.name}
              </h3>
            </div>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', primaryBadgeClass)}>
            {primaryBadge}
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
            {getCategoryLabel(location)}
          </span>
        </div>

        <div className="mb-3 text-xs text-zinc-500">
          {summaryText}
        </div>

        {liveData || reportCount > 0 ? (
          <BusynessBar busyness={location.busyness} />
        ) : lastReading ? (
          <div className="mb-2 mt-1">
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>
                Last seen · {formatDistanceToNow(new Date(lastReading.recorded_at), { addSuffix: true })}
              </span>
              <span>{lastReading.busyness}%</span>
            </div>
            <BusynessBar busyness={lastReading.busyness} size="sm" />
          </div>
        ) : (
          <div className="mb-2 text-sm text-zinc-500">
            No live occupancy or reports in the last 24 hours.
          </div>
        )}

        {/* Sub-locations for Waitz spots */}
        {!compact && liveData && subLocations.length > 0 && (
          <div className="mt-3 space-y-2">
            {subLocations.map((sub) => {
              const hasSubCapacity =
                Number.isFinite(sub.capacity) &&
                Number.isFinite(sub.count) &&
                sub.capacity > 0
              return (
                <div key={sub.name}>
                  <div className="mb-1 flex justify-between text-xs text-zinc-500">
                    <span>{sub.name}</span>
                    <span>
                      {hasSubCapacity ? `${sub.count}/${sub.capacity}` : `${sub.busyness}% busy`}
                    </span>
                  </div>
                  <BusynessBar busyness={sub.busyness} showLabel={false} size="sm" />
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors group-hover:border-gold-500/50 group-hover:text-gold-300">
            View spot details
            <span className="ml-2 transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>
      </div>

      {/* Quick feedback — pointer-events-auto so it's interactive, above link */}
      {showQuickFeedback && (
        <div
          className="relative z-20 mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 pointer-events-auto"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <div className="mb-2">
            <p className="text-sm font-medium text-zinc-100">Quick feedback</p>
            <p className="text-xs text-zinc-500">
              {liveData ? 'Does this live reading feel right?' : 'How busy is it right now?'}
            </p>
          </div>
          <VibeCheck locationId={location.id} />
        </div>
      )}
    </div>
  )
}
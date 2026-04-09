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
  return (
    getNumberValue(location, ['reportCount', 'report_count']) ?? 0
  )
}

function getLastReportedAt(location: Location) {
  return getStringValue(location, ['lastReportedAt', 'last_reported_at'])
}

function getCurrentOccupancy(location: Location) {
  return (
    getNumberValue(location, ['currentOccupancy', 'current_occupancy', 'count']) ?? 0
  )
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
    case 'library':
      return 'Library'
    case 'study_space':
      return 'Study space'
    case 'quiet_study':
      return 'Quiet study'
    case 'casual_space':
      return 'Casual study'
    case 'classroom_space':
      return 'Classroom study'
    default:
      return 'Campus building'
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
      ? 'Student reported'
      : source === 'waitz'
        ? 'No live reading'
        : 'No reports yet'

  const primaryBadgeClass = liveData
    ? 'bg-emerald-400/10 text-emerald-400'
    : hasStudentReports
      ? 'bg-blue-400/10 text-blue-300'
      : 'bg-zinc-800 text-zinc-400'

  let summaryText = 'Hours unverified'

  if (liveData) {
    summaryText = `~${currentOccupancy} / ${capacity} people`
  } else if (reportCount > 0 && lastReportedAt) {
    summaryText = `${reportCount} recent report${reportCount === 1 ? '' : 's'} · last ${formatDistanceToNow(
      new Date(lastReportedAt),
      { addSuffix: true }
    )}`
  } else if (reportCount > 0) {
    summaryText = `${reportCount} recent report${reportCount === 1 ? '' : 's'}`
  } else if (lastReading) {
    summaryText = `Last live reading ${formatDistanceToNow(new Date(lastReading.recorded_at), {
      addSuffix: true,
    })}`
  }

  return (
    <div
      className={clsx(
        'bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-600 transition-all',
        isFavourite && 'border-gold-500/40'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('w-2 h-2 rounded-full flex-shrink-0 mt-1', dotColor)} />
          <Link
            href={`/location/${location.id}`}
            className="font-semibold text-zinc-100 hover:text-gold-400 transition-colors leading-tight"
          >
            {location.name}
          </Link>
        </div>

        <button
          onClick={() => onToggleFavourite(location.id)}
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          className="text-lg leading-none ml-2 flex-shrink-0 transition-transform hover:scale-110"
        >
          {isFavourite ? '⭐' : '☆'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={clsx(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            primaryBadgeClass
          )}
        >
          {primaryBadge}
        </span>

        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
          {getCategoryLabel(location)}
        </span>
      </div>

      <div className="text-xs text-zinc-500 mb-3">
        {summaryText}
      </div>

      {liveData || reportCount > 0 ? (
        <BusynessBar busyness={location.busyness} />
      ) : lastReading ? (
        <div className="mt-1 mb-2">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>
              Last seen · {formatDistanceToNow(new Date(lastReading.recorded_at), { addSuffix: true })}
            </span>
            <span>{lastReading.busyness}%</span>
          </div>
          <BusynessBar busyness={lastReading.busyness} size="sm" />
        </div>
      ) : (
        <div className="text-sm text-zinc-500 mb-2">
          No live occupancy or recent student reports yet.
        </div>
      )}

      {!compact && liveData && subLocations.length > 0 && (
        <div className="mt-3 space-y-2">
          {subLocations.map((sub) => {
            const hasSubCapacity =
              Number.isFinite(sub.capacity) &&
              Number.isFinite(sub.count) &&
              sub.capacity > 0

            return (
              <div key={sub.name}>
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
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


      <Link
        href={`/location/${location.id}`}
        className="block mt-3 text-center text-xs text-zinc-600 hover:text-gold-400 transition-colors"
      >
        View history & seat reports →
      </Link>
    </div>
  )
}
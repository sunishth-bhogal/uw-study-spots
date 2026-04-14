'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Location } from '@/lib/types'

interface Props {
  location: Location
  isFavourite?: boolean
  onToggleFavourite?: (locationId: string) => void
}

type SubLocation = {
  name: string
  busyness: number
  count?: number
  capacity?: number
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

function getCurrentOccupancy(location: Location) {
  return getNumberValue(location, ['currentOccupancy', 'current_occupancy', 'count']) ?? 0
}

function getCapacity(location: Location) {
  return getNumberValue(location, ['capacity']) ?? 0
}

function getReportCount(location: Location) {
  return (
    getNumberValue(location, [
      'reportCount',
      'report_count',
      'recentReportCount',
      'recent_report_count',
    ]) ?? 0
  )
}

function getLastReportedAt(location: Location) {
  return getStringValue(location, ['lastReportedAt', 'last_reported_at'])
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

function hasLiveOccupancyData(location: Location) {
  const current = getCurrentOccupancy(location)
  const capacity = getCapacity(location)
  return capacity > 0 && current >= 0
}

function getSource(location: Location) {
  return getStringValue(location, ['dataSource', 'source']) ?? 'building'
}

function getBusyness(location: Location) {
  const value = getNumberValue(location, ['busyness', 'occupancy_percent', 'occupancyPercent'])
  return value ?? null
}

function getBusynessColor(busyness: number | null) {
  if (busyness === null) return 'bg-zinc-500'
  if (busyness < 40) return 'bg-emerald-400'
  if (busyness < 70) return 'bg-yellow-400'
  return 'bg-red-400'
}

function getStatusDotColor(busyness: number | null) {
  if (busyness === null) return 'bg-zinc-500'
  if (busyness < 40) return 'bg-emerald-400'
  if (busyness < 70) return 'bg-yellow-400'
  return 'bg-red-400'
}

function getBusynessLabel(busyness: number | null) {
  if (busyness === null) return 'No recent data'
  if (busyness < 30) return 'Very quiet'
  if (busyness < 55) return 'Fairly quiet'
  if (busyness < 75) return 'Getting busy'
  return 'Packed'
}

function formatReportSummary(reportCount: number, lastReportedAt: string | null) {
  const reportText = `${reportCount} report${reportCount === 1 ? '' : 's'} in last 24h`

  if (!lastReportedAt) return reportText

  return `${reportText} · last ${formatDistanceToNow(new Date(lastReportedAt), {
    addSuffix: true,
  })}`
}

function getSubLocations(location: Location): SubLocation[] {
  const raw = (location as any).subLocations
  if (!Array.isArray(raw)) return []

  return raw.filter(
    (sub) =>
      sub &&
      typeof sub.name === 'string' &&
      Number.isFinite(Number(sub.busyness))
  )
}

function formatSubLocationPeople(sub: SubLocation) {
  const count = Number(sub.count)
  const capacity = Number(sub.capacity)

  if (Number.isFinite(count) && Number.isFinite(capacity) && capacity > 0) {
    return `${count}/${capacity}`
  }

  return null
}

export function LocationCard({ location, isFavourite = false, onToggleFavourite }: Props) {
  const source = getSource(location)
  const liveData = hasLiveOccupancyData(location)
  const reportCount = getReportCount(location)
  const lastReportedAt = getLastReportedAt(location)
  const busyness = getBusyness(location)
  const categoryLabel = getCategoryLabel(location)
  const subLocations = getSubLocations(location)

  const lastReportedMs = lastReportedAt ? new Date(lastReportedAt).getTime() : null
  const now = Date.now()
  const within24h =
    lastReportedMs !== null ? now - lastReportedMs <= 24 * 60 * 60 * 1000 : false
  const olderThan3h =
    lastReportedMs !== null ? now - lastReportedMs > 3 * 60 * 60 * 1000 : false

  const showRecentReportBadge = reportCount > 0 && within24h
  const liveBacked = liveData || source === 'waitz'

  const showMainTracker =
    busyness !== null &&
    (liveBacked || (showRecentReportBadge && !olderThan3h))

  const showSubLocationBreakdown = liveBacked && subLocations.length > 0

  const summaryText = liveData
    ? `~${getCurrentOccupancy(location)} / ${getCapacity(location)} people`
    : showRecentReportBadge
      ? formatReportSummary(reportCount, lastReportedAt)
      : reportCount > 0
        ? `${reportCount} report${reportCount === 1 ? '' : 's'}`
        : lastReportedAt
          ? `Last updated ${formatDistanceToNow(new Date(lastReportedAt), { addSuffix: true })}`
          : 'No recent reports yet'

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotColor(busyness)}`} />
            <h3 className="truncate text-xl font-semibold text-zinc-100">{location.name}</h3>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {liveBacked && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                Waitz live data
              </span>
            )}

            {!liveBacked && showRecentReportBadge && (
              <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300">
                Reported in last 24h
              </span>
            )}

            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
              {categoryLabel}
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-500">{summaryText}</p>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavourite?.(location.id)}
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          className="shrink-0 text-zinc-300 transition-colors hover:text-zinc-100"
        >
          {isFavourite ? '★' : '☆'}
        </button>
      </div>

      {showMainTracker && (
        <div className={showSubLocationBreakdown ? 'mb-3' : 'mb-4'}>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-700">
            <div
              className={`h-full rounded-full ${getBusynessColor(busyness)}`}
              style={{ width: `${Math.max(0, Math.min(100, busyness ?? 0))}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-300">{getBusynessLabel(busyness)}</span>
            <span className="font-semibold text-zinc-200">
              {busyness === null ? '—' : `${Math.round(busyness)}%`}
            </span>
          </div>
        </div>
      )}

      {showSubLocationBreakdown && (
        <div className="mb-4 space-y-2.5">
          {subLocations.map((sub, index) => {
            const peopleText = formatSubLocationPeople(sub)
            return (
              <div key={`${sub.name}-${index}`}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-500">{sub.name}</span>
                  <span className="shrink-0 text-zinc-500">
                    {peopleText ?? `${Math.round(sub.busyness)}%`}
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-700">
                  <div
                    className={`h-full rounded-full ${getBusynessColor(sub.busyness)}`}
                    style={{ width: `${Math.max(0, Math.min(100, sub.busyness))}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href={`/location/${location.id}`}
        className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
      >
        View spot details <span className="ml-2">→</span>
      </Link>
    </div>
  )
}

export default LocationCard
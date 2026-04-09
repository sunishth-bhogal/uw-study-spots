'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Location } from '@/lib/types'
import { LocationCard } from '@/components/LocationCard'
import { useFavorites } from '@/hooks/useFavorites'

const CampusMap = dynamic(() => import('@/components/CampusMap'), {
  ssr: false,
})

type SortOption = 'waitz' | 'student-reported' | 'favourites'

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

function getBooleanValue(location: Location, keys: string[]) {
  for (const key of keys) {
    const value = (location as any)[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function getBusyness(location: Location) {
  const raw = getNumberValue(location, ['busyness', 'occupancy_percent', 'occupancyPercent'])
  return raw ?? 0
}

function getCapacity(location: Location) {
  return getNumberValue(location, ['capacity'])
}

function getCurrentOccupancy(location: Location) {
  return getNumberValue(location, [
    'currentOccupancy',
    'current_occupancy',
    'occupancy',
    'current',
  ])
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

function hasLiveOccupancyData(location: Location) {
  const capacity = getCapacity(location)
  const currentOccupancy = getCurrentOccupancy(location)
  return capacity !== null && capacity > 0 && currentOccupancy !== null && currentOccupancy >= 0
}

function isWaitzBacked(location: Location) {
  const source = getStringValue(location, ['source'])
  const waitzName = getStringValue(location, ['waitz_name', 'waitzName'])
  if (source === 'waitz') return true
  if (waitzName) return true
  if (hasLiveOccupancyData(location)) return true
  return false
}

function hasStudentReportedData(location: Location) {
  const reportCount = getReportCount(location)
  const lastReportedAt = getLastReportedAt(location)
  const avgCrowdedness = getNumberValue(location, ['avgCrowdedness', 'avg_crowdedness'])
  const avgQuietness = getNumberValue(location, ['avgQuietness', 'avg_quietness'])
  const avgSeatsAvailable = getNumberValue(location, ['avgSeatsAvailable', 'avg_seats_available'])
  const anyOpenReport = getBooleanValue(location, ['anyOpenReport', 'any_open_report'])

  return (
    reportCount > 0 ||
    Boolean(lastReportedAt) ||
    avgCrowdedness !== null ||
    avgQuietness !== null ||
    avgSeatsAvailable !== null ||
    anyOpenReport !== null
  )
}

function hasAnyData(location: Location) {
  return isWaitzBacked(location) || hasStudentReportedData(location)
}

function compareByName(a: Location, b: Location) {
  return a.name.localeCompare(b.name)
}

function compareByBusynessDesc(a: Location, b: Location) {
  return getBusyness(b) - getBusyness(a)
}

function compareByReportsDesc(a: Location, b: Location) {
  return getReportCount(b) - getReportCount(a)
}

function compareByLastReported(a: Location, b: Location) {
  const aTime = getLastReportedAt(a) ? new Date(getLastReportedAt(a) as string).getTime() : 0
  const bTime = getLastReportedAt(b) ? new Date(getLastReportedAt(b) as string).getTime() : 0
  return bTime - aTime
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

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('waitz')
  const [showEmptySpots, setShowEmptySpots] = useState(false)

  const { isFavourite, toggle } = useFavorites()

  const fetchOccupancy = async () => {
    try {
      const res = await fetch('/api/occupancy')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLocations(data.locations ?? [])
      setFetchedAt(data.fetchedAt ?? null)
      setError(null)
    } catch {
      setError('Could not load study spots. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOccupancy()
    const interval = setInterval(fetchOccupancy, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const allVisibleLocations = useMemo(() => {
    return locations.filter((location) => {
      const isActive = (location as any).is_active
      return isActive !== false
    })
  }, [locations])

  const filtered = useMemo(() => {
    let list = allVisibleLocations

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter((location) => location.name.toLowerCase().includes(q))
    }

    return [...list].sort((a, b) => {
      if (sort === 'favourites') {
        const aFav = isFavourite(a.id) ? 0 : 1
        const bFav = isFavourite(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav
        const aWaitz = isWaitzBacked(a) ? 0 : 1
        const bWaitz = isWaitzBacked(b) ? 0 : 1
        if (aWaitz !== bWaitz) return aWaitz - bWaitz
        const busynessDiff = compareByBusynessDesc(a, b)
        if (busynessDiff !== 0) return busynessDiff
        const reportsDiff = compareByReportsDesc(a, b)
        if (reportsDiff !== 0) return reportsDiff
        return compareByName(a, b)
      }

      if (sort === 'waitz') {
        const aWaitz = isWaitzBacked(a) ? 0 : 1
        const bWaitz = isWaitzBacked(b) ? 0 : 1
        if (aWaitz !== bWaitz) return aWaitz - bWaitz
        const aLive = hasLiveOccupancyData(a) ? 0 : 1
        const bLive = hasLiveOccupancyData(b) ? 0 : 1
        if (aLive !== bLive) return aLive - bLive
        const busynessDiff = compareByBusynessDesc(a, b)
        if (busynessDiff !== 0) return busynessDiff
        const reportsDiff = compareByReportsDesc(a, b)
        if (reportsDiff !== 0) return reportsDiff
        return compareByName(a, b)
      }

      if (sort === 'student-reported') {
        const aStudent = hasStudentReportedData(a) ? 0 : 1
        const bStudent = hasStudentReportedData(b) ? 0 : 1
        if (aStudent !== bStudent) return aStudent - bStudent
        const reportsDiff = compareByReportsDesc(a, b)
        if (reportsDiff !== 0) return reportsDiff
        const recentDiff = compareByLastReported(a, b)
        if (recentDiff !== 0) return recentDiff
        const busynessDiff = compareByBusynessDesc(a, b)
        if (busynessDiff !== 0) return busynessDiff
        return compareByName(a, b)
      }

      return compareByName(a, b)
    })
  }, [allVisibleLocations, search, sort, isFavourite])

  const activeLocations = useMemo(() => filtered.filter(hasAnyData), [filtered])
  const emptyLocations = useMemo(() => filtered.filter((l) => !hasAnyData(l)), [filtered])

  const busynessLocations = useMemo(() => {
    return allVisibleLocations.filter(
      (location) => hasLiveOccupancyData(location) || hasStudentReportedData(location)
    )
  }, [allVisibleLocations])
  
  const avgLiveBusyness = useMemo(() => {
    if (busynessLocations.length === 0) return null
  
    const total = busynessLocations.reduce((sum, location) => sum + getBusyness(location), 0)
    return Math.round(total / busynessLocations.length)
  }, [busynessLocations])

  const reportedLocationsCount = useMemo(() => {
    return allVisibleLocations.filter((location) => hasStudentReportedData(location)).length
  }, [allVisibleLocations])

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold text-zinc-100">
          Find the best <span className="text-gold-500">study spot</span> at UW right now
        </h1>
        <p className="text-sm text-zinc-500">
          Live busyness where available, plus student reports on quietness, seating, and crowd
          levels across campus.
        </p>
      </div>

      {!loading && allVisibleLocations.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
            <div className="text-2xl font-bold text-zinc-100">{allVisibleLocations.length}</div>
            <div className="text-xs text-zinc-500">Spots listed</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
            <div
              className={`text-2xl font-bold ${
                avgLiveBusyness === null
                  ? 'text-zinc-300'
                  : avgLiveBusyness < 40
                    ? 'text-emerald-400'
                    : avgLiveBusyness < 70
                      ? 'text-yellow-400'
                      : 'text-red-400'
              }`}
            >
              {avgLiveBusyness === null ? '—' : `${avgLiveBusyness}%`}
            </div>
            <div className="text-xs text-zinc-500">Live busyness</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
            <div className="text-2xl font-bold text-zinc-100">{reportedLocationsCount}</div>
            <div className="text-xs text-zinc-500">Student-rated spots</div>
          </div>
        </div>
      )}

      {!loading && allVisibleLocations.length > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">How it works</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              UW Study Spots combines live occupancy data where available with recent
              student-submitted reports across campus. Live readings update automatically, while
              student reports help cover more locations by showing quietness, seating, and crowd
              levels.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-1 text-sm font-semibold text-zinc-100">Live occupancy</div>
              <p className="text-sm text-zinc-500">
                Spots labeled <span className="text-emerald-400">Waitz live data</span> are using
                current live occupancy data where available.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-1 text-sm font-semibold text-zinc-100">Student reports</div>
              <p className="text-sm text-zinc-500">
                Spots labeled <span className="text-blue-300">Student reported</span> use recent
                community submissions to show quietness, seating, and crowd conditions.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-1 text-sm font-semibold text-zinc-100">Freshness matters</div>
              <p className="text-sm text-zinc-500">
                Newer readings and reports are more reliable than older ones, so always check the
                latest update time when comparing spots.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="mb-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-zinc-100">See it on the map</h2>
            <p className="text-sm text-zinc-500">Explore every listed study spot across campus.</p>
          </div>
          <CampusMap locations={filtered} />
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search a building or study spot…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-gold-500 focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 transition-colors focus:border-gold-500 focus:outline-none"
        >
          <option value="waitz">Live data first</option>
          <option value="student-reported">Student insight first</option>
          <option value="favourites">Favourites first</option>
        </select>
      </div>

      {fetchedAt && (
        <p className="mb-4 text-xs text-zinc-600">
          Updated {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
          {' · '}
          <button
            onClick={fetchOccupancy}
            className="underline transition-colors hover:text-zinc-400"
          >
            Refresh now
          </button>
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="mb-3 text-sm text-red-400">{error}</p>
          <button
            onClick={fetchOccupancy}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-zinc-600">No study spots match your search.</p>
      ) : (
        <>
          {activeLocations.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeLocations.map((loc) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  isFavourite={isFavourite(loc.id)}
                  onToggleFavourite={toggle}
                />
              ))}
            </div>
          )}

          {emptyLocations.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowEmptySpots((v) => !v)}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showEmptySpots
                  ? `Hide ${emptyLocations.length} spots with no data yet ▲`
                  : `+ ${emptyLocations.length} more spots with no data yet ▼`}
              </button>

              {showEmptySpots && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 text-left">
                  {emptyLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-600" />
                        <span className="text-sm text-zinc-300 truncate">{loc.name}</span>
                        <span className="hidden sm:inline text-xs text-zinc-600 flex-shrink-0">
                          {getCategoryLabel(loc)}
                        </span>
                      </div>
                      <a
                        href={`/location/${loc.id}`}
                        className="flex-shrink-0 ml-4 text-xs text-gold-500 hover:text-gold-400 transition-colors whitespace-nowrap"
                      >
                        Be the first to report →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
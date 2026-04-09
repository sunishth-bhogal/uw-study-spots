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
    'current'
  ])
}

function getReportCount(location: Location) {
  return (
    getNumberValue(location, [
      'reportCount',
      'report_count',
      'recentReportCount',
      'recent_report_count'
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
  const source = getStringValue(location, ['source'])

  return (
    reportCount > 0 ||
    Boolean(lastReportedAt) ||
    avgCrowdedness !== null ||
    avgQuietness !== null ||
    avgSeatsAvailable !== null ||
    anyOpenReport !== null ||
    source === 'community'
  )
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

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('waitz')

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
      setError('Could not load locations. Try refreshing.')
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

  const liveDataLocations = useMemo(() => {
    return allVisibleLocations.filter((location) => isWaitzBacked(location) || hasLiveOccupancyData(location))
  }, [allVisibleLocations])

  const avgLiveBusyness = useMemo(() => {
    if (liveDataLocations.length === 0) return null

    const total = liveDataLocations.reduce((sum, location) => sum + getBusyness(location), 0)
    return Math.round(total / liveDataLocations.length)
  }, [liveDataLocations])

  const reportedLocationsCount = useMemo(() => {
    return allVisibleLocations.filter((location) => hasStudentReportedData(location)).length
  }, [allVisibleLocations])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-1">
          Study spots across campus <span className="text-gold-500">in one place</span>
        </h1>
        <p className="text-zinc-500 text-sm">
          Live occupancy where available, plus community-reported study spots across UW campus.
        </p>
      </div>

      {!loading && allVisibleLocations.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-zinc-100">
              {allVisibleLocations.length}
            </div>
            <div className="text-xs text-zinc-500">Locations listed</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
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
            <div className="text-xs text-zinc-500">Avg. live busyness</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-zinc-100">
              {reportedLocationsCount}
            </div>
            <div className="text-xs text-zinc-500">Locations with reports</div>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="mb-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-zinc-100">Campus map</h2>
            <p className="text-sm text-zinc-500">
              Browse every listed campus location visually.
            </p>
          </div>
          <CampusMap locations={filtered} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search locations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-gold-500 transition-colors"
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-gold-500 transition-colors"
        >
          <option value="waitz">Waitz / live data first</option>
          <option value="student-reported">Student reported first</option>
          <option value="favourites">Favourites first</option>
        </select>
      </div>

      {fetchedAt && (
        <p className="text-xs text-zinc-600 mb-4">
          Last updated {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
          {' · '}
          <button
            onClick={fetchOccupancy}
            className="underline hover:text-zinc-400 transition-colors"
          >
            Refresh
          </button>
        </p>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-pulse h-48"
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={fetchOccupancy}
            className="px-4 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-zinc-600 py-16">No locations match your search.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              isFavourite={isFavourite(loc.id)}
              onToggleFavourite={toggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
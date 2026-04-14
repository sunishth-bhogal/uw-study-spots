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

type SortOption = 'popular' | 'waitz' | 'favourites'

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

const PINNED_POPULAR = ['math coffee', 'student life centre', 'engineering 5']

function isPinned(location: Location) {
  const name = location.name.toLowerCase()
  return PINNED_POPULAR.some((pin) => name.includes(pin))
}

function isPopular(location: Location) {
  return isPinned(location) || isWaitzBacked(location) || hasStudentReportedData(location)
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

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [totalReportsToDate, setTotalReportsToDate] = useState(0)
  const [visitorCount, setVisitorCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('popular')
  const [showHiddenSpots, setShowHiddenSpots] = useState(false)

  const { isFavourite, toggle } = useFavorites()

  const getVisitorId = () => {
    if (typeof window === 'undefined') return null

    let visitorId = localStorage.getItem('uwss_visitor_id')

    if (!visitorId) {
      visitorId = crypto.randomUUID()
      localStorage.setItem('uwss_visitor_id', visitorId)
    }

    return visitorId
  }

  const registerVisitor = async () => {
    try {
      const visitorId = getVisitorId()
      if (!visitorId) return

      await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      })

      const res = await fetch('/api/visitors', { cache: 'no-store' })
      if (!res.ok) return

      const data = await res.json()
      setVisitorCount(data.visitorCount ?? 0)
    } catch {
      // fail silently
    }
  }

  const fetchOccupancy = async () => {
    try {
      const res = await fetch('/api/occupancy')
      if (!res.ok) throw new Error('Failed to fetch')

      const data = await res.json()
      setLocations(data.locations ?? [])
      setFetchedAt(data.fetchedAt ?? null)
      setTotalReportsToDate(data.totalReportsToDate ?? 0)
      setError(null)
    } catch {
      setError('Could not load study spots. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOccupancy()
    registerVisitor()

    const interval = setInterval(fetchOccupancy, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const allVisibleLocations = useMemo(() => {
    return locations.filter((location) => {
      const isActive = (location as any).is_active
      return isActive !== false
    })
  }, [locations])

  const searchedLocations = useMemo(() => {
    let list = allVisibleLocations

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter((location) => {
        const buildingCode = getStringValue(location, ['building_code', 'buildingCode']) ?? ''
        return (
          location.name.toLowerCase().includes(q) ||
          buildingCode.toLowerCase().includes(q)
        )
      })
    }

    return list
  }, [allVisibleLocations, search])

  const filtered = useMemo(() => {
    const list = searchedLocations

    if (sort === 'popular') {
      const base = search.trim() ? list : list.filter(isPopular)
      return [...base].sort((a, b) => {
        const aHasData = isWaitzBacked(a) || hasStudentReportedData(a) ? 0 : 1
        const bHasData = isWaitzBacked(b) || hasStudentReportedData(b) ? 0 : 1
        if (aHasData !== bHasData) return aHasData - bHasData

        const aLive = isWaitzBacked(a) ? 0 : 1
        const bLive = isWaitzBacked(b) ? 0 : 1
        if (aLive !== bLive) return aLive - bLive

        const recentDiff = compareByLastReported(a, b)
        if (recentDiff !== 0) return recentDiff

        const reportsDiff = compareByReportsDesc(a, b)
        if (reportsDiff !== 0) return reportsDiff

        const busynessDiff = compareByBusynessDesc(a, b)
        if (busynessDiff !== 0) return busynessDiff

        return compareByName(a, b)
      })
    }

    if (sort === 'waitz') {
      const waitz = list.filter(isWaitzBacked)
      return [...waitz].sort((a, b) => {
        const aLive = hasLiveOccupancyData(a) ? 0 : 1
        const bLive = hasLiveOccupancyData(b) ? 0 : 1
        if (aLive !== bLive) return aLive - bLive

        const busynessDiff = compareByBusynessDesc(a, b)
        if (busynessDiff !== 0) return busynessDiff

        return compareByName(a, b)
      })
    }

    if (sort === 'favourites') {
      const favs = list.filter((l) => isFavourite(l.id))
      return [...favs].sort((a, b) => {
        const aLive = isWaitzBacked(a) ? 0 : 1
        const bLive = isWaitzBacked(b) ? 0 : 1
        if (aLive !== bLive) return aLive - bLive

        const recentDiff = compareByLastReported(a, b)
        if (recentDiff !== 0) return recentDiff

        return compareByName(a, b)
      })
    }

    return [...list].sort(compareByName)
  }, [searchedLocations, sort, isFavourite, search])

  const hiddenLocations = useMemo(() => {
    if (sort !== 'popular') return []

    const filteredIds = new Set(filtered.map((l) => l.id))
    return searchedLocations
      .filter((l) => !filteredIds.has(l.id))
      .sort(compareByName)
  }, [sort, filtered, searchedLocations])

  const busynessLocations = useMemo(() => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000
    const now = Date.now()

    return allVisibleLocations.filter((location) => {
      if (hasLiveOccupancyData(location)) return true

      const lastReported = getLastReportedAt(location)
      if (!lastReported) return false

      return now - new Date(lastReported).getTime() <= TWO_HOURS_MS
    })
  }, [allVisibleLocations])

  const avgLiveBusyness = useMemo(() => {
    if (busynessLocations.length === 0) return null

    const total = busynessLocations.reduce((sum, location) => sum + getBusyness(location), 0)
    return Math.round(total / busynessLocations.length)
  }, [busynessLocations])

  return (
    <div>
      <section className="mb-8 rounded-[28px] border border-zinc-800 bg-zinc-900/60 p-4 sm:p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-8">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-400">
                Live where available
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-300">
                Student-reported
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-300">
                Built for UW
              </span>
            </div>

            <h1 className="max-w-4xl text-[2.6rem] font-bold leading-[0.95] tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl lg:leading-[1.02]">
              Find a good study
              <br className="hidden sm:block" />
              {' '}spot
              <span className="text-gold-500"> before </span>
              you
              <br className="hidden sm:block" />
              {' '}waste the walk.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              See live busyness where available, plus student reports on quietness, seating,
              and crowd levels across campus.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#study-spots"
                className="inline-flex w-full items-center justify-center rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-zinc-900 hover:opacity-90 transition-opacity sm:w-auto"
              >
                Find a spot now
              </a>

              <a
                href="#map"
                className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors sm:w-auto"
              >
                Open campus map
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-2xl font-bold text-zinc-100">
                  {loading ? '—' : allVisibleLocations.length}
                </div>
                <div className="mt-1 text-xs text-zinc-500">Active spots</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
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
                <div className="mt-1 text-xs text-zinc-500">Avg busyness</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-2xl font-bold text-zinc-100">
                  {loading ? '—' : `${totalReportsToDate}+`}
                </div>
                <div className="mt-1 text-xs text-zinc-500">Reports to date</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="text-2xl font-bold text-gold-400">
                  {visitorCount === null ? '—' : `${visitorCount}+`}
                </div>
                <div className="mt-1 text-xs text-zinc-500">Students helped</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
              <div>
                <p className="text-xl font-semibold text-zinc-100">How it works</p>
                <p className="text-sm text-zinc-500">Fast enough to check between classes.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-400">
                📍
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-sm font-semibold text-zinc-100">1. Check the latest vibe</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Use live occupancy where available or recent student reports when it is not.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-sm font-semibold text-zinc-100">2. Compare before walking</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Look at crowd levels, quietness, seating, and freshness of the update.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-sm font-semibold text-zinc-100">3. Leave a quick report</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Takes a few seconds and saves the next person from a pointless side quest.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:mt-5">
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Freshness matters</p>
              <p className="text-sm leading-6 text-zinc-300">
                Newer readings and reports are more reliable, so always check the latest update
                time before committing to the walk.
              </p>
            </div>

            {fetchedAt && (
              <p className="mt-4 text-xs text-zinc-500">
                Updated {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
      </section>

      {!loading && !error && allVisibleLocations.length > 0 && (
        <div id="map" className="mb-6 scroll-mt-24">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-zinc-100">See it on the map</h2>
            <p className="text-sm text-zinc-500">Explore every listed study spot across campus.</p>
          </div>

          <div className="relative z-0 overflow-hidden rounded-2xl">
            <CampusMap locations={allVisibleLocations} />
          </div>
        </div>
      )}

      <div id="study-spots" className="scroll-mt-24">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search any building or study spot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-gold-500 focus:outline-none"
          />

          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortOption)
              setShowHiddenSpots(false)
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 transition-colors focus:border-gold-500 focus:outline-none"
          >
            <option value="popular">Popular Spots</option>
            <option value="waitz">Waitz Live</option>
            <option value="favourites">Favourites</option>
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
                className="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
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
          <p className="py-16 text-center text-zinc-600">
            {sort === 'favourites'
              ? 'No favourites yet — heart a spot to save it here.'
              : sort === 'popular'
                ? 'No active spots right now. Be the first to report one below!'
                : 'No study spots match your search.'}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((loc) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  isFavourite={isFavourite(loc.id)}
                  onToggleFavourite={toggle}
                />
              ))}
            </div>

            {hiddenLocations.length > 0 && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowHiddenSpots((v) => !v)}
                  className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {showHiddenSpots
                    ? `Hide ${hiddenLocations.length} other listed spots ▲`
                    : `+ ${hiddenLocations.length} other listed spots ▼`}
                </button>

                {showHiddenSpots && (
                  <div className="mt-4 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900 text-left">
                    {hiddenLocations.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-800/50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-600" />
                          <span className="truncate text-sm text-zinc-300">{loc.name}</span>
                          <span className="hidden flex-shrink-0 text-xs text-zinc-600 sm:inline">
                            {getCategoryLabel(loc)}
                          </span>
                        </div>

                        <a
                          href={`/location/${loc.id}`}
                          className="ml-4 flex-shrink-0 whitespace-nowrap text-xs text-gold-500 transition-colors hover:text-gold-400"
                        >
                          Help your peers→
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
    </div>
  )
}
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { Location } from '@/lib/types'
import { BusynessBar } from '@/components/BusynessBar'
import { OccupancyChart } from '@/components/OccupancyChart'
import { VibeCheck } from '@/components/VibeCheck'
import { CommunityReport } from '@/components/CommunityReport'

interface PageProps {
  params: {
    id: string
  }
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

export default function LocationDetailPage({ params }: PageProps) {
  const searchParams = useSearchParams()
  const isQrView = searchParams.get('src') === 'qr'

  const [location, setLocation] = useState<Location | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadLocation = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/occupancy', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load location data')

        const data = await res.json()
        const found = (data.locations as Location[]).find((loc) => loc.id === params.id)

        if (!found) {
          setError('Location not found.')
          setLocation(null)
        } else {
          setLocation(found)
          setFetchedAt(data.fetchedAt ?? null)
          setError(null)
        }
      } catch {
        setError('Could not load this location right now.')
        setLocation(null)
      } finally {
        setLoading(false)
      }
    }

    loadLocation()
  }, [params.id])

  const detailState = useMemo(() => {
    if (!location) {
      return {
        source: 'building',
        reportCount: 0,
        lastReportedAt: null as string | null,
        currentOccupancy: 0,
        capacity: 0,
        liveData: false,
        hasStudentReports: false,
        displayBusyness: null as number | null,
        badgeText: 'No reports yet',
        badgeClass: 'bg-zinc-800 text-zinc-400',
        summaryText: 'Hours unverified',
        categoryLabel: 'Campus building',
        statusDot: 'bg-zinc-600',
      }
    }

    const source = getSource(location)
    const reportCount = getReportCount(location)
    const lastReportedAt = getLastReportedAt(location)
    const currentOccupancy = getCurrentOccupancy(location)
    const capacity = getCapacity(location)
    const liveData = hasLiveOccupancyData(location)
    const hasStudentReports = reportCount > 0 || Boolean(lastReportedAt)

    const displayBusyness = liveData || hasStudentReports ? location.busyness : null

    const badgeText = liveData
      ? source === 'waitz'
        ? 'Waitz live data'
        : 'Live data'
      : hasStudentReports
        ? 'Student reported'
        : source === 'waitz'
          ? 'No live reading'
          : 'No reports yet'

    const badgeClass = liveData
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
    }

    const statusDot =
      displayBusyness === null
        ? 'bg-zinc-600'
        : displayBusyness < 40
          ? 'bg-emerald-400'
          : displayBusyness < 70
            ? 'bg-yellow-400'
            : 'bg-red-500'

    return {
      source,
      reportCount,
      lastReportedAt,
      currentOccupancy,
      capacity,
      liveData,
      hasStudentReports,
      displayBusyness,
      badgeText,
      badgeClass,
      summaryText,
      categoryLabel: getCategoryLabel(location),
      statusDot,
    }
  }, [location])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 bg-zinc-800 rounded" />
          <div className="h-10 w-72 bg-zinc-800 rounded" />
          <div className="h-40 w-full bg-zinc-900 rounded-2xl border border-zinc-800" />
          <div className="h-72 w-full bg-zinc-900 rounded-2xl border border-zinc-800" />
        </div>
      </div>
    )
  }

  if (error || !location) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-red-400 text-sm mb-4">{error ?? 'Location not found.'}</p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  const subLocations = Array.isArray(location.subLocations) ? location.subLocations : []
  const instagramUrl = 'https://instagram.com/uwstudyspots'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Back to all study spots
        </Link>
      </div>

      {isQrView ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_0.95fr] lg:items-start">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-400">
                  New here?
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                  Student-built
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                  Anonymous reports
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-3">
                Yeah the poster bait worked.
              </h2>

              <p className="text-base text-zinc-200 mb-2">
                Well this is <span className="font-semibold text-zinc-100">UW Study Spots</span> for{' '}
                <span className="font-semibold text-zinc-100">{location.name}</span>.
              </p>

              <p className="text-sm text-zinc-400 leading-6 max-w-2xl">
                So why are you here? You can report the crowdedness of where you are in a quick
                anonymous report so the next student has a better shot than pure guesswork only to
                try the next spot. As a community we can help each other. Takes two seconds to help
                the next person and makes your accidental scan kind of heroic.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="#student-report"
                  className="inline-flex items-center justify-center rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:opacity-90 transition-opacity"
                >
                  Leave anonymous report
                </a>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Follow @uwstudyspots
                </a>
              </div>

              <div className="mt-5 max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
                <Image
                  src="/side-eye-monkey.png"
                  alt="Side-eye monkey meme"
                  width={500}
                  height={500}
                  className="h-48 w-full object-cover"
                  priority
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500/15 text-2xl">
                  🦉
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Better than guessing</p>
                  <p className="text-xs text-zinc-500">Lowkey saves wasted walks across campus.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-lg mb-1">📍</p>
                  <p className="text-xs font-medium text-zinc-200">This spot</p>
                  <p className="text-xs text-zinc-500 mt-1">{location.name}</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-lg mb-1">🙈</p>
                  <p className="text-xs font-medium text-zinc-200">Anonymous</p>
                  <p className="text-xs text-zinc-500 mt-1">No name needed</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-lg mb-1">🚶</p>
                  <p className="text-xs font-medium text-zinc-200">Check first</p>
                  <p className="text-xs text-zinc-500 mt-1">Before walking there</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-lg mb-1">🤝</p>
                  <p className="text-xs font-medium text-zinc-200">Student-powered</p>
                  <p className="text-xs text-zinc-500 mt-1">Built on community</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                  Student-built
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                  Anonymous reports
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-2">
                Student-reported info for {location.name}
              </h2>

              <p className="text-sm text-zinc-400 leading-6">
                Check the latest busyness here and leave an anonymous report to help other students
                avoid wasted walks across campus.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#student-report"
                className="inline-flex items-center justify-center rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:opacity-90 transition-opacity"
              >
                Leave anonymous report
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Follow @uwstudyspots
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={clsx('w-2.5 h-2.5 rounded-full', detailState.statusDot)} />
              <span
                className={clsx(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  detailState.badgeClass
                )}
              >
                {detailState.badgeText}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {detailState.categoryLabel}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-zinc-100 mb-2">{location.name}</h1>

            <p className="text-sm text-zinc-500">
              {detailState.summaryText}
              {fetchedAt
                ? ` · Updated ${formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}`
                : ''}
            </p>
          </div>

          <div className="sm:text-right">
            <div
              className={clsx(
                'text-3xl font-bold',
                detailState.displayBusyness === null
                  ? 'text-zinc-300'
                  : detailState.displayBusyness < 40
                    ? 'text-emerald-400'
                    : detailState.displayBusyness < 70
                      ? 'text-yellow-400'
                      : 'text-red-400'
              )}
            >
              {detailState.displayBusyness === null ? '—' : `${detailState.displayBusyness}%`}
            </div>
            <div className="text-xs text-zinc-500">
              {detailState.liveData
                ? 'Current busyness'
                : detailState.hasStudentReports
                  ? 'Reported busyness'
                  : 'No live reading yet'}
            </div>
          </div>
        </div>

        <div className="mt-5">
          {detailState.displayBusyness !== null ? (
            <BusynessBar busyness={detailState.displayBusyness} />
          ) : (
            <div className="text-sm text-zinc-500">
              No live occupancy or recent student reports yet.
            </div>
          )}
        </div>

        {detailState.liveData && (
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-zinc-100">{detailState.currentOccupancy}</div>
              <div className="text-xs text-zinc-500">Estimated people here</div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-zinc-100">{detailState.capacity}</div>
              <div className="text-xs text-zinc-500">Estimated capacity</div>
            </div>
          </div>
        )}

        {!detailState.liveData && detailState.reportCount > 0 && (
          <div className="mt-5 bg-zinc-950/60 border border-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-100">{detailState.reportCount}</div>
            <div className="text-xs text-zinc-500">Recent student reports</div>
          </div>
        )}
      </div>

      <div id="student-report" className="mb-6 scroll-mt-24">
        <CommunityReport locationId={location.id} locationName={location.name} />
      </div>

      {detailState.liveData && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Quick feedback</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Fast reaction to whether this live reading feels right.
          </p>
          <VibeCheck locationId={location.id} />
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">Occupancy & report history</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Useful if you want the bigger picture after checking the current vibe.
        </p>
        <OccupancyChart locationId={location.id} />
      </div>

      {subLocations.length > 0 && detailState.liveData && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Floor breakdown</h2>
          <div className="space-y-4">
            {subLocations.map((sub) => {
              const hasSubCapacity =
                Number.isFinite(sub.capacity) &&
                Number.isFinite(sub.count) &&
                sub.capacity > 0

              return (
                <div
                  key={sub.name}
                  className="border-b border-zinc-800 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200 leading-tight">{sub.name}</p>
                      <p className="text-xs text-zinc-500">
                        {hasSubCapacity
                          ? `${sub.count} / ${sub.capacity} people`
                          : `${sub.busyness}% busy`}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        'text-sm font-semibold',
                        sub.busyness < 40
                          ? 'text-emerald-400'
                          : sub.busyness < 70
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      )}
                    >
                      {sub.busyness}%
                    </div>
                  </div>
                  <BusynessBar busyness={sub.busyness} showLabel={false} size="sm" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">Help us build this out further</h2>
            <p className="text-sm text-zinc-400 leading-6">
              This only gets better if students keep helping students. Every anonymous report makes
              UW Study Spots more useful, and we are trying to expand coverage across more buildings
              and study spaces on campus.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:opacity-90 transition-opacity"
            >
              Follow @uwstudyspots
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Explore all study spots
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
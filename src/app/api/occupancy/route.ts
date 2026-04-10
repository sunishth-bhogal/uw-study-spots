import { NextResponse } from 'next/server'
import { subDays } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchWaitzData, slugify } from '@/lib/waitz'
import { Location } from '@/lib/types'
import {
  getLocationCoordinates,
  BUILDING_COORDINATES,
  BUILDING_NAMES,
} from '@/lib/locationCoordinates'

type DbLocation = {
  id: string
  name: string
  building_code: string | null
  category: string | null
  source: 'waitz' | 'community'
  waitz_name: string | null
  description: string | null
  campus: string
  is_active: boolean
}

type CommunitySummaryRow = {
  location_id: string
  avg_crowdedness: number | null
  avg_seats_available: number | null
  avg_quietness: number | null
  any_open_report: boolean | null
  report_count: number | null
  last_reported_at: string | null
}

type SeatReportRow = {
  location_id: string
  seats_available: number
  submitted_at: string
}

type CommunityConfidence = 'none' | 'low' | 'medium' | 'high'

type ApiLocation = Location & {
  source: 'waitz' | 'community' | 'building'
  dataSource: 'waitz' | 'community' | 'building'
  waitzName?: string | null
  waitz_name?: string | null
  reportCount: number
  report_count: number
  lastReportedAt: string | null
  last_reported_at: string | null
  confidence: CommunityConfidence
  buildingCode: string | null
  building_code: string | null
  latitude: number | null
  longitude: number | null
  currentOccupancy: number
  current_occupancy: number
  category?: string | null
  description?: string | null
}

const EXCLUDED_BUILDING_CODES = new Set([
  'CLV',
  'CLN',
  'CMH',
  'MHR',
  'MKV',
  'REV',
  'TH',
  'UWP',
  'V1',
])

function shouldExcludeLocation(dbLoc: Pick<DbLocation, 'building_code'>) {
  const code = dbLoc.building_code?.trim().toUpperCase()
  if (!code) return false
  return EXCLUDED_BUILDING_CODES.has(code)
}

function parseDateLike(value: string | null | undefined): Date | null {
  if (!value) return null

  const raw = value.trim()
  if (!raw) return null

  if (/^\d+$/.test(raw)) {
    const numericDate = new Date(Number(raw))
    if (!Number.isNaN(numericDate.getTime())) return numericDate
  }

  const normalized =
    raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed

  return null
}

function toIsoString(value: string | null | undefined, fallbackIso: string) {
  const parsed = parseDateLike(value)
  return parsed ? parsed.toISOString() : fallbackIso
}

function toNullableIsoString(value: string | null | undefined) {
  const parsed = parseDateLike(value)
  return parsed ? parsed.toISOString() : null
}

function normalizeWaitzMap(waitzLocations: Location[]) {
  const byId = new Map<string, Location>()
  const byName = new Map<string, Location>()

  for (const loc of waitzLocations) {
    byId.set(loc.id, loc)
    byName.set(loc.name.trim().toLowerCase(), loc)
  }

  return { byId, byName }
}

function minutesSince(iso: string, nowIso: string) {
  const start = parseDateLike(iso)
  const end = parseDateLike(nowIso)

  if (!start || !end) return Number.POSITIVE_INFINITY

  const diffMs = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diffMs / 60000))
}

function getCommunityConfidence(
  reportCount: number,
  lastReportedAt: string | null,
  nowIso: string
): CommunityConfidence {
  if (!reportCount || !lastReportedAt) return 'none'

  const ageMinutes = minutesSince(lastReportedAt, nowIso)

  if (reportCount >= 4 && ageMinutes <= 6 * 60) return 'high'
  if (reportCount >= 2 && ageMinutes <= 24 * 60) return 'medium'
  if (reportCount >= 1 && ageMinutes <= 24 * 60) return 'low'
  return 'none'
}

function normalizeApiLocation(input: {
  id: string
  name: string
  busyness?: number | null
  count?: number | null
  capacity?: number | null
  isOpen?: boolean | null
  lastUpdated?: string | null
  subLocations?: Location['subLocations']
  source: 'waitz' | 'community' | 'building'
  waitzName?: string | null
  reportCount?: number | null
  lastReportedAt?: string | null
  confidence?: CommunityConfidence
  buildingCode?: string | null
  latitude?: number | null
  longitude?: number | null
  category?: string | null
  description?: string | null
}): ApiLocation {
  const fallbackIso = new Date().toISOString()
  const count = Math.max(0, Number(input.count ?? 0) || 0)
  const capacity = Math.max(0, Number(input.capacity ?? 0) || 0)
  const reportCount = Math.max(0, Number(input.reportCount ?? 0) || 0)
  const lastReportedAt = toNullableIsoString(input.lastReportedAt)
  const buildingCode = input.buildingCode ?? null
  const latitude = input.latitude ?? null
  const longitude = input.longitude ?? null
  const busyness = Math.max(0, Math.min(100, Math.round(Number(input.busyness ?? 0) || 0)))

  return {
    id: input.id,
    name: input.name,
    busyness,
    count,
    currentOccupancy: count,
    current_occupancy: count,
    capacity,
    isOpen: Boolean(input.isOpen ?? false),
    lastUpdated: toIsoString(input.lastUpdated, fallbackIso),
    subLocations: input.subLocations ?? [],
    source: input.source,
    dataSource: input.source,
    waitzName: input.waitzName ?? null,
    waitz_name: input.waitzName ?? null,
    reportCount,
    report_count: reportCount,
    lastReportedAt,
    last_reported_at: lastReportedAt,
    confidence: input.confidence ?? 'none',
    buildingCode,
    building_code: buildingCode,
    latitude,
    longitude,
    category: input.category ?? null,
    description: input.description ?? null,
  }
}

function buildCommunityLocation(
  dbLoc: DbLocation,
  summary: CommunitySummaryRow | undefined,
  latestSeat: SeatReportRow | undefined,
  nowIso: string
): ApiLocation {
  const reportCount = summary?.report_count ?? 0
  const rawLastReportedAt = summary?.last_reported_at ?? latestSeat?.submitted_at ?? null
  const lastReportedAt = toNullableIsoString(rawLastReportedAt)
  const confidence = getCommunityConfidence(reportCount, lastReportedAt, nowIso)

  const busyness =
    summary?.avg_crowdedness != null
      ? Math.max(0, Math.min(100, Math.round(summary.avg_crowdedness)))
      : 0

  return normalizeApiLocation({
    id: dbLoc.id,
    name: dbLoc.name,
    busyness,
    count: 0,
    capacity: 0,
    isOpen: false,
    lastUpdated: lastReportedAt ?? nowIso,
    subLocations: [],
    source: 'community',
    waitzName: dbLoc.waitz_name,
    reportCount,
    lastReportedAt,
    confidence,
    buildingCode: dbLoc.building_code,
    ...getLocationCoordinates(dbLoc.name, dbLoc.building_code),
    category: dbLoc.category,
    description: dbLoc.description,
  })
}

export async function GET() {
  try {
    const fetchedAt = new Date().toISOString()
    const recentCutoff = subDays(new Date(), 1).toISOString()

    const [dbLocationsRes, waitzLocations, communitySummaryRes, latestSeatsRes] =
      await Promise.all([
        supabaseAdmin
          .from('locations')
          .select(
            'id, name, building_code, category, source, waitz_name, description, campus, is_active'
          )
          .eq('is_active', true)
          .order('name', { ascending: true }),

        fetchWaitzData().catch((err) => {
          console.error('Waitz fetch failed:', err)
          return [] as Location[]
        }),

        supabaseAdmin
          .from('recent_user_report_summary')
          .select('*'),

        supabaseAdmin
          .from('seat_reports')
          .select('location_id, seats_available, submitted_at')
          .gte('submitted_at', recentCutoff)
          .order('submitted_at', { ascending: false }),
      ])

    if (dbLocationsRes.error) {
      throw new Error(`Failed to load locations: ${dbLocationsRes.error.message}`)
    }

    if (communitySummaryRes.error) {
      throw new Error(`Failed to load community summary: ${communitySummaryRes.error.message}`)
    }

    if (latestSeatsRes.error) {
      throw new Error(`Failed to load seat reports: ${latestSeatsRes.error.message}`)
    }

    const dbLocations = (dbLocationsRes.data ?? []) as DbLocation[]
    const visibleDbLocations = dbLocations.filter((dbLoc) => !shouldExcludeLocation(dbLoc))

    const communitySummaries = (communitySummaryRes.data ?? []) as CommunitySummaryRow[]
    const seatReports = (latestSeatsRes.data ?? []) as SeatReportRow[]

    const { byId: waitzById, byName: waitzByName } = normalizeWaitzMap(waitzLocations)

    const summaryByLocationId = new Map(
      communitySummaries.map((row) => [row.location_id, row])
    )

    const latestSeatByLocationId = new Map<string, SeatReportRow>()
    for (const row of seatReports) {
      if (!latestSeatByLocationId.has(row.location_id)) {
        latestSeatByLocationId.set(row.location_id, row)
      }
    }

    const merged: ApiLocation[] = visibleDbLocations.map((dbLoc) => {
      const summary = summaryByLocationId.get(dbLoc.id)
      const latestSeat = latestSeatByLocationId.get(dbLoc.id)
      const reportCount = summary?.report_count ?? 0
      const rawLastReportedAt = summary?.last_reported_at ?? latestSeat?.submitted_at ?? null
      const lastReportedAt = toNullableIsoString(rawLastReportedAt)
      const confidence = getCommunityConfidence(reportCount, lastReportedAt, fetchedAt)

      if (dbLoc.source === 'waitz') {
        const matchedWaitz =
          waitzById.get(dbLoc.id) ||
          (dbLoc.waitz_name
            ? waitzByName.get(dbLoc.waitz_name.trim().toLowerCase())
            : undefined) ||
          waitzByName.get(dbLoc.name.trim().toLowerCase()) ||
          waitzById.get(slugify(dbLoc.name))

        const coords = getLocationCoordinates(dbLoc.name, dbLoc.building_code)

        if (matchedWaitz) {
          return normalizeApiLocation({
            id: dbLoc.id,
            name: dbLoc.name,
            busyness: matchedWaitz.busyness,
            count: matchedWaitz.count,
            capacity: matchedWaitz.capacity,
            isOpen: matchedWaitz.isOpen,
            lastUpdated: matchedWaitz.lastUpdated,
            subLocations: matchedWaitz.subLocations,
            source: 'waitz',
            waitzName: dbLoc.waitz_name ?? dbLoc.name,
            reportCount,
            lastReportedAt,
            confidence,
            buildingCode: dbLoc.building_code,
            latitude: coords.latitude,
            longitude: coords.longitude,
            category: dbLoc.category,
            description: dbLoc.description,
          })
        }

        return normalizeApiLocation({
          id: dbLoc.id,
          name: dbLoc.name,
          busyness: 0,
          count: 0,
          capacity: 0,
          isOpen: false,
          lastUpdated: fetchedAt,
          subLocations: [],
          source: 'waitz',
          waitzName: dbLoc.waitz_name ?? dbLoc.name,
          reportCount,
          lastReportedAt,
          confidence,
          buildingCode: dbLoc.building_code,
          latitude: coords.latitude,
          longitude: coords.longitude,
          category: dbLoc.category,
          description: dbLoc.description,
        })
      }

      return buildCommunityLocation(dbLoc, summary, latestSeat, fetchedAt)
    })

    const existingCodes = new Set(
      merged
        .map((loc) => loc.buildingCode?.trim().toUpperCase())
        .filter((code): code is string => Boolean(code && BUILDING_COORDINATES[code]))
    )

    const fallbackBuildings: ApiLocation[] = Object.entries(BUILDING_COORDINATES)
      .filter(([code]) => !existingCodes.has(code))
      .map(([code, coords]) =>
        normalizeApiLocation({
          id: `building-${code.toLowerCase()}`,
          name: BUILDING_NAMES[code] ?? code,
          busyness: 0,
          count: 0,
          capacity: 0,
          isOpen: false,
          lastUpdated: fetchedAt,
          subLocations: [],
          source: 'building',
          waitzName: null,
          reportCount: 0,
          lastReportedAt: null,
          confidence: 'none',
          buildingCode: code,
          latitude: coords.latitude,
          longitude: coords.longitude,
          category: 'study_space',
          description: null,
        })
      )

    const locations: ApiLocation[] = [...merged, ...fallbackBuildings].map((loc) => {
      const code = loc.buildingCode?.trim().toUpperCase()

      if (code && BUILDING_COORDINATES[code]) {
        return {
          ...loc,
          latitude: BUILDING_COORDINATES[code].latitude,
          longitude: BUILDING_COORDINATES[code].longitude,
        }
      }

      return loc
    })

    return NextResponse.json(
      {
        locations,
        fetchedAt,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
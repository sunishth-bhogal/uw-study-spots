import { NextRequest, NextResponse } from 'next/server'
import { subDays } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase'

type ReadingRow = {
  busyness: number
  count: number
  capacity: number
  recorded_at: string
}

type ReportRow = {
  crowdedness: number | null
  submitted_at: string
}

type CombinedPoint = {
  busyness: number
  time: string
  count: number
  capacity: number
  source: 'reading' | 'report'
}

function formatHourLabel(date: Date) {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  })
}

function getLocationIdFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? null
}

export async function GET(req: NextRequest) {
  try {
    const locationId = getLocationIdFromPath(req.nextUrl.pathname)
    const mode = req.nextUrl.searchParams.get('mode') ?? 'recent'

    if (!locationId) {
      return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })
    }

    const recentSince = subDays(new Date(), 7).toISOString()
    const typicalSince = subDays(new Date(), 30).toISOString()
    const querySince = mode === 'typical' ? typicalSince : recentSince

    const [readingsRes, reportsRes] = await Promise.all([
      supabaseAdmin
        .from('occupancy_readings')
        .select('busyness, count, capacity, recorded_at')
        .eq('location_id', locationId)
        .gte('recorded_at', querySince)
        .order('recorded_at', { ascending: true }),

      supabaseAdmin
        .from('user_reports')
        .select('crowdedness, submitted_at')
        .eq('location_id', locationId)
        .not('crowdedness', 'is', null)
        .gte('submitted_at', querySince)
        .order('submitted_at', { ascending: true }),
    ])

    if (readingsRes.error) {
      return NextResponse.json({ error: readingsRes.error.message }, { status: 500 })
    }

    if (reportsRes.error) {
      return NextResponse.json({ error: reportsRes.error.message }, { status: 500 })
    }

    const readingPoints: CombinedPoint[] = ((readingsRes.data ?? []) as ReadingRow[]).map(
      (row) => ({
        busyness: row.busyness,
        time: row.recorded_at,
        count: row.count,
        capacity: row.capacity,
        source: 'reading',
      })
    )

    const reportPoints: CombinedPoint[] = ((reportsRes.data ?? []) as ReportRow[])
      .filter((row) => row.crowdedness !== null)
      .map((row) => ({
        busyness: Math.max(0, Math.min(100, Number(row.crowdedness))),
        time: row.submitted_at,
        count: 0,
        capacity: 0,
        source: 'report',
      }))

    const combined = [...readingPoints, ...reportPoints].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    )

    if (mode === 'last') {
      const last = combined.length > 0 ? combined[combined.length - 1] : null

      return NextResponse.json({
        last: last
          ? {
              busyness: last.busyness,
              count: last.count,
              capacity: last.capacity,
              recorded_at: last.time,
            }
          : null,
      })
    }

    if (mode === 'typical') {
      const buckets = new Map<number, number[]>()

      for (const point of combined) {
        const date = new Date(point.time)
        const hour = date.getHours()
        const existing = buckets.get(hour) ?? []
        existing.push(point.busyness)
        buckets.set(hour, existing)
      }

      const typical = Array.from({ length: 24 }, (_, hour) => {
        const values = buckets.get(hour) ?? []
        const avg =
          values.length > 0
            ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
            : null

        return {
          hour,
          busyness: avg,
        }
      })

      return NextResponse.json({ typical })
    }

    const history = combined.map((point) => ({
      time: point.time,
      hour: formatHourLabel(new Date(point.time)),
      busyness: point.busyness,
    }))

    return NextResponse.json({ history })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
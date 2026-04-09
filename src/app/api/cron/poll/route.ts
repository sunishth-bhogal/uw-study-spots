import { NextRequest, NextResponse } from 'next/server'
import { fetchWaitzData, slugify } from '@/lib/waitz'
import { supabaseAdmin } from '@/lib/supabase'

type DbLocation = {
  id: string
  name: string
  waitz_name: string | null
  source: 'waitz' | 'community'
  is_active: boolean
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    const [waitzLocations, dbLocationsRes] = await Promise.all([
      fetchWaitzData(),
      supabaseAdmin
        .from('locations')
        .select('id, name, waitz_name, source, is_active')
        .eq('is_active', true)
        .eq('source', 'waitz'),
    ])

    if (dbLocationsRes.error) {
      console.error('Failed to load canonical locations:', dbLocationsRes.error)
      return NextResponse.json(
        {
          error: dbLocationsRes.error.message,
          details: dbLocationsRes.error.details ?? null,
          hint: dbLocationsRes.error.hint ?? null,
          code: dbLocationsRes.error.code ?? null,
        },
        { status: 500 }
      )
    }

    const dbLocations = (dbLocationsRes.data ?? []) as DbLocation[]

    const byId = new Map<string, DbLocation>()
    const byWaitzName = new Map<string, DbLocation>()
    const byName = new Map<string, DbLocation>()
    const bySlug = new Map<string, DbLocation>()

    for (const dbLoc of dbLocations) {
      byId.set(dbLoc.id, dbLoc)

      const normalizedWaitzName = normalizeName(dbLoc.waitz_name)
      if (normalizedWaitzName) {
        byWaitzName.set(normalizedWaitzName, dbLoc)
      }

      const normalizedName = normalizeName(dbLoc.name)
      if (normalizedName) {
        byName.set(normalizedName, dbLoc)
      }

      const slug = slugify(dbLoc.name)
      if (slug) {
        bySlug.set(slug, dbLoc)
      }
    }

    const rows: Array<{
      location_id: string
      location_name: string
      busyness: number
      count: number
      capacity: number
      is_open: boolean
      is_sub: boolean
      parent_id: string | null
      source: string
      recorded_at: string
    }> = []

    const unmatched: Array<{
      waitzId: string
      waitzName: string
    }> = []

    for (const loc of waitzLocations) {
      const normalizedWaitzName = normalizeName(loc.name)

      const matchedDbLocation =
        byId.get(loc.id) ||
        byWaitzName.get(normalizedWaitzName) ||
        byName.get(normalizedWaitzName) ||
        bySlug.get(slugify(loc.name))

      if (!matchedDbLocation) {
        unmatched.push({
          waitzId: loc.id,
          waitzName: loc.name,
        })
        continue
      }

      rows.push({
        location_id: matchedDbLocation.id,
        location_name: matchedDbLocation.name,
        busyness: loc.busyness,
        count: loc.count,
        capacity: loc.capacity,
        is_open: loc.isOpen,
        is_sub: false,
        parent_id: null,
        source: 'waitz',
        recorded_at: now,
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Waitz locations could be matched to canonical DB locations.',
        locationsPolled: waitzLocations.length,
        rowsInserted: 0,
        unmatchedCount: unmatched.length,
        unmatched,
        timestamp: now,
      })
    }

    const { error } = await supabaseAdmin
      .from('occupancy_readings')
      .insert(rows)

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        {
          error: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
          code: error.code ?? null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      locationsPolled: waitzLocations.length,
      canonicalMatches: rows.length,
      rowsInserted: rows.length,
      unmatchedCount: unmatched.length,
      unmatched,
      timestamp: now,
    })
  } catch (err: any) {
    console.error('Cron poll route error:', err)

    return NextResponse.json(
      {
        error: err?.message ?? 'Unknown error',
        details: err?.details ?? null,
        hint: err?.hint ?? null,
        code: err?.code ?? null,
        raw: typeof err === 'object' ? err : String(err),
      },
      { status: 500 }
    )
  }
}
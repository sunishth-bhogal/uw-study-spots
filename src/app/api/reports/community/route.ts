import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { subHours } from 'date-fns'

const REPORT_WINDOW_SECONDS = 60 * 60

function getReportCookieName(locationId: string) {
  return `community_report_${encodeURIComponent(locationId)}`
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')

  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })
  }

  try {
    const since = subHours(new Date(), 2).toISOString()

    const [summaryRes, reportsRes] = await Promise.all([
      supabaseAdmin
        .from('recent_user_report_summary')
        .select('*')
        .eq('location_id', locationId)
        .maybeSingle(),

      supabaseAdmin
        .from('user_reports')
        .select(`
          id,
          location_id,
          crowdedness,
          seats_available,
          quietness,
          has_outlets,
          has_food_nearby,
          is_open,
          floor_label,
          note,
          submitted_at
        `)
        .eq('location_id', locationId)
        .gte('submitted_at', since)
        .order('submitted_at', { ascending: false })
        .limit(10),
    ])

    if (summaryRes.error) {
      return NextResponse.json({ error: summaryRes.error.message }, { status: 500 })
    }

    if (reportsRes.error) {
      return NextResponse.json({ error: reportsRes.error.message }, { status: 500 })
    }

    return NextResponse.json({
      summary: summaryRes.data ?? {
        avg_crowdedness: null,
        avg_seats_available: null,
        avg_quietness: null,
        any_open_report: false,
        report_count: 0,
        last_reported_at: null,
      },
      reports: reportsRes.data ?? [],
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      locationId,
      crowdedness,
      seatsAvailable,
      quietness,
      hasOutlets,
      hasFoodNearby,
      isOpen,
      floorLabel,
      note,
    } = body

    if (!locationId) {
      return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })
    }

    const cookieName = getReportCookieName(locationId)
    const existingReport = req.cookies.get(cookieName)?.value

    if (existingReport) {
      return NextResponse.json(
        { error: 'You already submitted a report for this location recently.' },
        { status: 429 }
      )
    }

    const cleanCrowdedness =
      crowdedness === null || crowdedness === undefined ? null : Number(crowdedness)

    const cleanSeatsAvailable =
      seatsAvailable === null || seatsAvailable === undefined ? null : Number(seatsAvailable)

    const cleanQuietness =
      quietness === null || quietness === undefined ? null : Number(quietness)

    const cleanFloorLabel =
      typeof floorLabel === 'string' && floorLabel.trim() ? floorLabel.trim().slice(0, 80) : null

    const cleanNote =
      typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null

    const cleanHasOutlets =
      typeof hasOutlets === 'boolean' ? hasOutlets : null

    const cleanHasFoodNearby =
      typeof hasFoodNearby === 'boolean' ? hasFoodNearby : null

    const cleanIsOpen =
      typeof isOpen === 'boolean' ? isOpen : null

    if (
      cleanCrowdedness !== null &&
      (Number.isNaN(cleanCrowdedness) || cleanCrowdedness < 0 || cleanCrowdedness > 100)
    ) {
      return NextResponse.json({ error: 'crowdedness must be 0–100' }, { status: 400 })
    }

    if (
      cleanSeatsAvailable !== null &&
      (Number.isNaN(cleanSeatsAvailable) || cleanSeatsAvailable < 0)
    ) {
      return NextResponse.json({ error: 'seatsAvailable must be 0 or more' }, { status: 400 })
    }

    if (
      cleanQuietness !== null &&
      (Number.isNaN(cleanQuietness) || cleanQuietness < 1 || cleanQuietness > 5)
    ) {
      return NextResponse.json({ error: 'quietness must be 1–5' }, { status: 400 })
    }

    const hasAnyInput =
      cleanCrowdedness !== null ||
      cleanSeatsAvailable !== null ||
      cleanQuietness !== null ||
      cleanHasOutlets !== null ||
      cleanHasFoodNearby !== null ||
      cleanIsOpen !== null ||
      cleanFloorLabel !== null ||
      cleanNote !== null

    if (!hasAnyInput) {
      return NextResponse.json(
        { error: 'Add at least one report detail before submitting.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('user_reports')
      .insert({
        location_id: locationId,
        crowdedness: cleanCrowdedness,
        seats_available: cleanSeatsAvailable,
        quietness: cleanQuietness,
        has_outlets: cleanHasOutlets,
        has_food_nearby: cleanHasFoodNearby,
        is_open: cleanIsOpen,
        floor_label: cleanFloorLabel,
        note: cleanNote,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set({
      name: cookieName,
      value: `submitted:${Date.now()}`,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REPORT_WINDOW_SECONDS,
    })

    return response
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
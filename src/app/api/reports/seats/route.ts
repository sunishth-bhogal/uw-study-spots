import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { subMinutes } from 'date-fns'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ report: null })

  const since = subMinutes(new Date(), 30).toISOString()

  const { data } = await supabase
    .from('seat_reports')
    .select('seats_available, submitted_at')
    .eq('location_id', locationId)
    .gte('submitted_at', since)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ report: data ?? null })
}

export async function POST(req: NextRequest) {
  const { locationId, seatsAvailable } = await req.json()

  if (!locationId || seatsAvailable === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('seat_reports')
    .insert({ location_id: locationId, seats_available: seatsAvailable })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
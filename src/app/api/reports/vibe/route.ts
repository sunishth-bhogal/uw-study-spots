import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { subHours } from 'date-fns'

type VibeValue = 'less_packed' | 'accurate' | 'more_packed'

type VibeRow = {
  vibe: VibeValue
}

const ALLOWED_VIBES: VibeValue[] = ['less_packed', 'accurate', 'more_packed']
const VOTE_WINDOW_SECONDS = 60 * 60

function getVoteCookieName(locationId: string) {
  return `vibe_vote_${encodeURIComponent(locationId)}`
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')

  if (!locationId) {
    return NextResponse.json({
      less_packed: 0,
      accurate: 0,
      more_packed: 0,
      total: 0,
    })
  }

  const since = subHours(new Date(), 1).toISOString()

  const { data, error } = await supabaseAdmin
    .from('vibe_checks')
    .select('vibe')
    .eq('location_id', locationId)
    .gte('submitted_at', since)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts = {
    less_packed: 0,
    accurate: 0,
    more_packed: 0,
    total: 0,
  }

  for (const row of (data ?? []) as VibeRow[]) {
    if (row.vibe === 'less_packed') counts.less_packed++
    if (row.vibe === 'accurate') counts.accurate++
    if (row.vibe === 'more_packed') counts.more_packed++
  }

  counts.total =
    counts.less_packed + counts.accurate + counts.more_packed

  return NextResponse.json(counts)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const locationId = body?.locationId
    const vibe = body?.vibe as VibeValue | undefined

    if (!locationId || !vibe) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    if (!ALLOWED_VIBES.includes(vibe)) {
      return NextResponse.json({ error: 'Invalid vibe value' }, { status: 400 })
    }

    const cookieName = getVoteCookieName(locationId)
    const existingVote = req.cookies.get(cookieName)?.value

    if (existingVote) {
      return NextResponse.json(
        { error: 'You already submitted a vibe check for this location recently.' },
        { status: 429 }
      )
    }

    const { error } = await supabaseAdmin
      .from('vibe_checks')
      .insert({
        location_id: locationId,
        vibe,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set({
      name: cookieName,
      value: `${vibe}:${Date.now()}`,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: VOTE_WINDOW_SECONDS,
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
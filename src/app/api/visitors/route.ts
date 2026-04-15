import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BASELINE_VISITORS = 866

export async function GET() {
  const { count, error } = await supabaseAdmin
    .from('site_visitors')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    visitorCount: BASELINE_VISITORS + (count ?? 0),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const visitorId = body?.visitorId

    if (!visitorId || typeof visitorId !== 'string') {
      return NextResponse.json({ error: 'Missing visitorId' }, { status: 400 })
    }

    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('site_visitors')
      .upsert(
        {
          visitor_id: visitorId,
          last_seen: now,
        },
        { onConflict: 'visitor_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
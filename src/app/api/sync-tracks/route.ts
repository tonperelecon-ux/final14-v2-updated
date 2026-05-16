import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { sessionId, movedTrackId, newList, newPosition, allPoolPositions, allFinalPositions } = await req.json()
  if (!sessionId || !movedTrackId) return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 })

  const { data: session } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
  if (session?.status === 'finished') return NextResponse.json({ error: 'Session terminée.' }, { status: 403 })

  if (newList === 'final') {
    const { count } = await supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('list', 'final')
    const { data: currentTrack } = await supabase.from('tracks').select('list').eq('id', movedTrackId).single()
    if (currentTrack?.list !== 'final' && (count ?? 0) >= 14) return NextResponse.json({ error: 'Limite de 14 atteinte.' }, { status: 400 })
  }

  await supabase.from('tracks').update({ list: newList, position: newPosition }).eq('id', movedTrackId)
  for (const row of allPoolPositions ?? []) await supabase.from('tracks').update({ position: row.position }).eq('id', row.id)
  for (const row of allFinalPositions ?? []) await supabase.from('tracks').update({ position: row.position }).eq('id', row.id)

  return NextResponse.json({ ok: true })
}

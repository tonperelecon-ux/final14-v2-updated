import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  const { sessionName, hostName, duration, titles } = await req.json()
  if (!sessionName || !hostName || !titles?.length) return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 })

  const code = generateCode()
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .insert({ code, name: sessionName, host_name: hostName, duration_seconds: duration, status: 'waiting' })
    .select()
    .single()
  if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 })

  const trackRows = (titles as string[]).slice(0, 50).map((title, i) => ({ session_id: session.id, title, position: i, list: 'pool', added_by: hostName }))
  const { error: trackErr } = await supabase.from('tracks').insert(trackRows)
  if (trackErr) return NextResponse.json({ error: trackErr.message }, { status: 500 })

  await supabase.from('players').insert({ session_id: session.id, pseudo: hostName })
  return NextResponse.json({ code, sessionId: session.id })
}

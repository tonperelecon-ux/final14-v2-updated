import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { code, pseudo } = await req.json()
  if (!code || !pseudo) return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 })

  const { data: session, error } = await supabase.from('sessions').select().eq('code', code).single()
  if (error || !session) return NextResponse.json({ error: 'Code invalide.' }, { status: 404 })
  if (session.status === 'finished') return NextResponse.json({ error: 'Session terminée.' }, { status: 400 })

  await supabase.from('players').insert({ session_id: session.id, pseudo })
  return NextResponse.json({ code: session.code, sessionId: session.id })
}

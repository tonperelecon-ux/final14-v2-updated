'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player, Session, Track } from '@/lib/types'

declare global { interface Window { Sortable?: any } }
const MAX_FINAL = 14

export default function RoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const code = String(params.code).toUpperCase()
  const pseudo = searchParams.get('pseudo') || 'Joueur'
  const isHost = searchParams.get('host') === '1'

  const [session, setSession] = useState<Session | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const sessionIdRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const poolRef = useRef<HTMLDivElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const sortablePool = useRef<any>(null)
  const sortableFinal = useRef<any>(null)

  const loadSession = useCallback(async () => {
    const { data } = await supabase.from('sessions').select().eq('code', code).single()
    if (!data) return
    setSession(data)
    sessionIdRef.current = data.id
    if (data.timer_started_at) {
      const elapsed = Math.floor((Date.now() - new Date(data.timer_started_at).getTime()) / 1000)
      setTimeLeft(Math.max(0, data.duration_seconds - elapsed))
    } else {
      setTimeLeft(data.duration_seconds)
    }
  }, [code])

  const loadTracks = useCallback(async () => {
    if (!sessionIdRef.current) return
    const { data } = await supabase.from('tracks').select().eq('session_id', sessionIdRef.current).order('position')
    if (data) setTracks(data)
  }, [])

  const loadPlayers = useCallback(async () => {
    if (!sessionIdRef.current) return
    const { data } = await supabase.from('players').select().eq('session_id', sessionIdRef.current).order('joined_at')
    if (data) setPlayers(data)
  }, [])

  useEffect(() => { loadSession().then(() => { loadTracks(); loadPlayers() }) }, [loadSession, loadTracks, loadPlayers])

  useEffect(() => {
    if (!sessionIdRef.current) return
    const ch = supabase.channel(`room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks', filter: `session_id=eq.${sessionIdRef.current}` }, () => loadTracks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionIdRef.current}` }, () => loadPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionIdRef.current}` }, () => loadSession())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [code, loadPlayers, loadSession, loadTracks])

  useEffect(() => {
    if (session?.status === 'active' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [session?.status, timeLeft])

  useEffect(() => {
    const init = async () => {
      if (!window.Sortable) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Sortable non chargé'))
          document.head.appendChild(script)
        })
      }
      if (sortablePool.current) sortablePool.current.destroy()
      if (sortableFinal.current) sortableFinal.current.destroy()
      const config = {
        group: 'tracks', animation: 180, ghostClass: 'ghost', chosenClass: 'chosen', disabled: session?.status === 'finished',
        onMove: (evt: any) => {
          if (evt.to === finalRef.current) {
            const count = finalRef.current?.querySelectorAll('[data-track-id]').length ?? 0
            if (evt.from !== finalRef.current && count >= MAX_FINAL) return false
          }
          return true
        },
        onEnd: async (evt: any) => {
          if (!sessionIdRef.current || session?.status === 'finished') return
          const movedTrackId = evt.item.dataset.trackId
          const newList = evt.to === finalRef.current ? 'final' : 'pool'
          const poolItems = Array.from(poolRef.current?.querySelectorAll('[data-track-id]') ?? []) as HTMLElement[]
          const finalItems = Array.from(finalRef.current?.querySelectorAll('[data-track-id]') ?? []) as HTMLElement[]
          const allPoolPositions = poolItems.map((el, i) => ({ id: el.dataset.trackId, position: i }))
          const allFinalPositions = finalItems.map((el, i) => ({ id: el.dataset.trackId, position: i }))
          const newPosition = (newList === 'final' ? allFinalPositions : allPoolPositions).findIndex(x => x.id === movedTrackId)
          const res = await fetch('/api/sync-tracks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: sessionIdRef.current, movedTrackId, newList, newPosition, allPoolPositions, allFinalPositions }) })
          if (!res.ok) { const data = await res.json(); setStatusMsg(data.error || 'Erreur'); setTimeout(() => setStatusMsg(''), 2000); loadTracks() }
        }
      }
      if (poolRef.current) sortablePool.current = new window.Sortable(poolRef.current, config)
      if (finalRef.current) sortableFinal.current = new window.Sortable(finalRef.current, config)
    }
    init()
  }, [tracks, session?.status, loadTracks])

  const startSession = async () => {
    await fetch('/api/start-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: sessionIdRef.current }) })
    loadSession()
  }
  const finishSession = async () => {
    await fetch('/api/finish-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: sessionIdRef.current }) })
    loadSession()
  }
  const exportFinal = () => {
    const final = tracks.filter(t => t.list === 'final').sort((a,b) => a.position - b.position)
    const txt = `${session?.name || 'Session'}\n\n${final.map((t,i)=>`${String(i+1).padStart(2,'0')}. ${t.title}`).join('\n')}`
    const blob = new Blob([txt], { type:'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'final-14.txt'; a.click(); URL.revokeObjectURL(url)
  }

  const pool = tracks.filter(t => t.list === 'pool').sort((a,b) => a.position - b.position)
  const final = tracks.filter(t => t.list === 'final').sort((a,b) => a.position - b.position)
  const progress = session ? (timeLeft / session.duration_seconds) * 100 : 0
  const fmt = (s:number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  return (
    <main className="shell">
      <section className="panel" style={{padding:'1.25rem', marginBottom:'1rem'}}>
        <div style={{display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', alignItems:'center'}}>
          <div>
            <h1 style={{margin:'0 0 .35rem'}}>{session?.name || 'Chargement...'}</h1>
            <p style={{margin:0}}>Code de room : <strong>{code}</strong> · Joueur : <strong>{pseudo}</strong></p>
          </div>
          <div style={{display:'flex', gap:'.5rem', flexWrap:'wrap', alignItems:'center'}}>
            <span className="badge">{players.length} joueurs</span>
            <span className="badge">{final.length} / 14</span>
            <span className="badge">{session?.status || 'waiting'}</span>
          </div>
        </div>
        {statusMsg && <div style={{marginTop:'1rem', color:'var(--color-danger)', fontWeight:700}}>{statusMsg}</div>}
      </section>

      <section className="panel" style={{padding:'1.25rem', marginBottom:'1rem'}}>
        <div style={{display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', alignItems:'center'}}>
          <div>
            <div style={{fontSize:'2rem', fontWeight:700}}>{fmt(timeLeft)}</div>
            <p style={{margin:0}}>Timer synchronisé</p>
          </div>
          {isHost && session?.status !== 'finished' && (
            <div style={{display:'flex', gap:'.5rem', flexWrap:'wrap'}}>
              {session?.status !== 'active' && <button className="btn btn-primary" onClick={startSession}>Lancer</button>}
              <button className="btn" onClick={finishSession}>Terminer</button>
            </div>
          )}
        </div>
        <div style={{height:10, borderRadius:999, overflow:'hidden', background:'color-mix(in srgb,var(--color-text) 8%,transparent)', marginTop:'1rem'}}>
          <div style={{height:'100%', width:`${Math.max(0, progress)}%`, background:'linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, white))'}} />
        </div>
      </section>

      <section style={{display:'grid', gridTemplateColumns:'1.1fr 1fr 280px', gap:'1rem', alignItems:'start'}}>
        <div className="panel" style={{padding:'1rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'.75rem'}}><h2>Pool</h2><span className="badge">{pool.length}</span></div>
          {!pool.length && <div className="empty">Aucun titre dans le pool.</div>}
          <div ref={poolRef} style={{display:'grid', gap:'.6rem'}}>
            {pool.map((track, i) => <TrackCard key={track.id} id={track.id} title={track.title} index={i} final={false} />)}
          </div>
        </div>
        <div className="panel" style={{padding:'1rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'.75rem'}}><h2>Final 14</h2><span className="badge">{final.length} / 14</span></div>
          {!final.length && <div className="empty">Glisse ici les meilleurs titres.</div>}
          <div ref={finalRef} style={{display:'grid', gap:'.6rem', minHeight:120}}>
            {final.map((track, i) => <TrackCard key={track.id} id={track.id} title={track.title} index={i} final />)}
          </div>
        </div>
        <aside style={{display:'grid', gap:'1rem'}}>
          <div className="panel" style={{padding:'1rem'}}>
            <h2 style={{marginTop:0}}>Joueurs</h2>
            <div style={{display:'grid', gap:'.5rem'}}>
              {players.map(player => <div key={player.id} style={{padding:'.5rem .75rem', border:'1px solid var(--color-border)', borderRadius:12, background:'var(--color-surface-2)', fontWeight:600}}>{player.pseudo}{player.pseudo === session?.host_name ? ' (admin)' : ''}</div>)}
            </div>
          </div>
          <div className="panel" style={{padding:'1rem'}}>
            <h2 style={{marginTop:0}}>Export</h2>
            <button className="btn btn-primary" onClick={exportFinal}>Télécharger la liste</button>
          </div>
        </aside>
      </section>
    </main>
  )
}

function TrackCard({ id, title, index, final }: { id:string; title:string; index:number; final:boolean }) {
  return (
    <article className="track-card" data-track-id={id}>
      <div className="num" style={final ? { background:'color-mix(in srgb, var(--color-success) 14%, transparent)', color:'var(--color-success)' } : {}}>{String(index + 1).padStart(2, '0')}</div>
      <div>
        <div style={{fontWeight:700}}>{title}</div>
        <div style={{fontSize:'var(--text-xs)', color:'var(--color-text-muted)'}}>{final ? 'Sélectionné' : 'Disponible'}</div>
      </div>
    </article>
  )
}

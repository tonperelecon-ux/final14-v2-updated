'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'create'|'join'>('create')
  const [sessionName, setSessionName] = useState('')
  const [hostName, setHostName] = useState('')
  const [duration, setDuration] = useState(10)
  const [titles, setTitles] = useState('')
  const [code, setCode] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createSession = async () => {
    const list = titles.split('\n').map(t => t.trim()).filter(Boolean).slice(0, 50)
    if (!sessionName.trim()) return setError('Ajoute un nom de session.')
    if (!hostName.trim()) return setError('Ajoute ton pseudo.')
    if (list.length < 14) return setError('Il faut au moins 14 titres.')
    setLoading(true); setError('')
    const res = await fetch('/api/create-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionName, hostName, duration: duration*60, titles: list }) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error || 'Erreur')
    router.push(`/room/${data.code}?pseudo=${encodeURIComponent(hostName)}&host=1`)
  }

  const joinSession = async () => {
    if (!code.trim()) return setError('Entre le code.')
    if (!pseudo.trim()) return setError('Entre ton pseudo.')
    setLoading(true); setError('')
    const res = await fetch('/api/join-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: code.trim().toUpperCase(), pseudo }) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error || 'Erreur')
    router.push(`/room/${data.code}?pseudo=${encodeURIComponent(pseudo)}`)
  }

  return (
    <main className="shell">
      <section className="panel" style={{padding:'1.5rem', marginBottom:'1.5rem'}}>
        <h1 style={{fontSize:'var(--text-xl)', margin:'0 0 .75rem'}}>Final 14 Builder — V2 multijoueur</h1>
        <p style={{margin:'0 0 1rem', color:'var(--color-text-muted)'}}>Crée une session avec 50 titres, partage un code à tes amis, lance le timer et construisez ensemble la liste finale de 14 morceaux.</p>
        <div style={{display:'flex', gap:'.5rem', flexWrap:'wrap'}}>
          {['Temps réel','Code de room','Timer synchronisé','Final 14'].map(x => <span key={x} className="badge">{x}</span>)}
        </div>
      </section>
      <section className="panel" style={{padding:'1.5rem'}}>
        <div style={{display:'flex', gap:'.75rem', marginBottom:'1.25rem'}}>
          <button className={`btn ${mode==='create' ? 'btn-primary' : ''}`} onClick={() => { setMode('create'); setError('') }}>Créer</button>
          <button className={`btn ${mode==='join' ? 'btn-primary' : ''}`} onClick={() => { setMode('join'); setError('') }}>Rejoindre</button>
        </div>
        {error && <div style={{padding:'.75rem 1rem', borderRadius:12, background:'color-mix(in srgb, var(--color-danger) 12%, transparent)', color:'var(--color-danger)', marginBottom:'1rem'}}>{error}</div>}
        {mode==='create' ? (
          <div style={{display:'grid', gap:'1rem'}}>
            <input className="input" placeholder="Nom de la session" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            <input className="input" placeholder="Ton pseudo (admin)" value={hostName} onChange={e => setHostName(e.target.value)} />
            <input className="input" type="number" min={1} max={120} value={duration} onChange={e => setDuration(Number(e.target.value))} />
            <textarea className="textarea" placeholder="Colle jusqu'à 50 titres, un par ligne" value={titles} onChange={e => setTitles(e.target.value)} />
            <button className="btn btn-primary" onClick={createSession} disabled={loading}>{loading ? 'Création...' : 'Créer la session'}</button>
          </div>
        ) : (
          <div style={{display:'grid', gap:'1rem', maxWidth:420}}>
            <input className="input" placeholder="Code de session" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            <input className="input" placeholder="Ton pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} />
            <button className="btn btn-primary" onClick={joinSession} disabled={loading}>{loading ? 'Connexion...' : 'Rejoindre la session'}</button>
          </div>
        )}
      </section>
    </main>
  )
}

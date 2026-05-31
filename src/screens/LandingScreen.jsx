import { useState, useRef, useEffect } from 'react'
import { signOut, createRoom, joinRoomByCode } from '../supabase'
import { showInterstitialAd } from '../admob'
import { playBGM } from '../game/audio/audio'

const MENU_ITEMS = [
  { id: 'classic', label: '▶ ENGAGE SOLO MODE', desc: '50 LEVELS · SINGLE PILOT' },
  { id: 'create', label: '⊕ DEPLOY ARENA', desc: 'HOST MULTIPLAYER' },
  { id: 'join', label: '⊞ JOIN ARENA', desc: 'ENTER ACCESS CODE' },
  { id: 'leaderboard', label: '🏆 WAR RECORDS', desc: 'TOP PILOTS' },
]

export default function LandingScreen({ user, nav }) {
  const [selected, setSelected] = useState(0)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const joinInputRef = useRef(null)
  
  const isGuest = user?.isGuest
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'PILOT'
  const color = user?.user_metadata?.color || 'yellow'

  const COLOR_HEX = {
    red: '#ff2244', blue: '#2288ff', green: '#00e87a',
    yellow: '#ffcc00', purple: '#cc44ff', orange: '#ff7720',
    white: '#dde8ff',
  }

  useEffect(() => {
    const lastAdTime = localStorage.getItem('last_app_open_ad_time')
    const now = Date.now()
    if (!lastAdTime || now - parseInt(lastAdTime) > 60 * 60 * 1000) {
      showInterstitialAd()
      localStorage.setItem('last_app_open_ad_time', now.toString())
    }
    playBGM('menu')
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (showJoin) return
      if (e.key === 'ArrowUp') setSelected(s => Math.max(0, s - 1))
      if (e.key === 'ArrowDown') setSelected(s => Math.min(MENU_ITEMS.length - 1, s + 1))
      if (e.key === 'Enter') {
        const item = MENU_ITEMS[selected]
        if (isGuest && ['create', 'join', 'leaderboard'].includes(item.id)) return
        handleSelect(item.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, showJoin])

  async function handleSelect(id) {
    if (isGuest && ['create', 'join', 'leaderboard'].includes(id)) return
    setError('')
    if (id === 'classic') {
      nav('level_select')
    } else if (id === 'leaderboard') {
      nav('leaderboard')
    } else if (id === 'create') {
      setLoading(true)
      try {
        const room = await createRoom(user.id)
        await import('../supabase').then(m =>
          m.supabase.from('room_players').insert({
            room_id: room.id,
            user_id: user.id,
            display_name: displayName,
            color,
            slot: 1,
          })
        )
        nav('lobby', { room })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    } else if (id === 'join') {
      setShowJoin(true)
      setTimeout(() => joinInputRef.current?.focus(), 100)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setLoading(true)
    setError('')
    try {
      const room = await joinRoomByCode(joinCode.trim(), user.id, displayName, color)
      nav('lobby', { room })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full relative overflow-y-auto flex flex-col items-center justify-center py-8"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a0a2e 0%, #060610 60%, #030308 100%)' }}
    >
      {/* Animated space grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(0,180,255,0.05) 0, rgba(0,180,255,0.05) 1px, transparent 1px, transparent 48px),
          repeating-linear-gradient(90deg, rgba(0,180,255,0.05) 0, rgba(0,180,255,0.05) 1px, transparent 1px, transparent 48px)
        `,
        backgroundSize: '48px 48px',
      }} />
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(100,0,255,0.12) 0%, transparent 70%)',
      }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid rgba(0,180,255,0.15)', background: 'rgba(6,6,16,0.8)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: COLOR_HEX[color], boxShadow: `0 0 12px ${COLOR_HEX[color]}` }}
          />
          <span style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', color: COLOR_HEX[color] }}>
            {displayName}
          </span>
        </div>
        <button
          style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}
          className="hover:text-red-400 transition-colors"
          onClick={async () => { await signOut(); nav('auth') }}
        >
          DISCONNECT
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-4">
        {/* Logo */}
        <div className="text-center">
          <PlasmaAnimation />
          <h1 style={{
            fontFamily: 'Rajdhani,Outfit,sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(32px, 8vw, 56px)',
            letterSpacing: '0.12em',
            background: 'linear-gradient(135deg, #00d4ff 0%, #7744ff 40%, #ff44ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 30px rgba(100,0,255,0.5))',
            marginTop: 12,
          }}>
            NOVA STRIKE
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(0,212,255,0.4))' }} />
            <span style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.5)' }}>
              DOMINATE THE GRID
            </span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(0,212,255,0.4))' }} />
          </div>
        </div>

        {/* Menu */}
        {!showJoin ? (
          <div className="w-full space-y-2">
            {MENU_ITEMS.map((item, i) => {
              const isDisabled = isGuest && ['create', 'join', 'leaderboard'].includes(item.id)
              const isSelected = selected === i
              return (
                <button
                  key={item.id}
                  id={`menu-${item.id}`}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 20px',
                    border: `1.5px solid ${isDisabled ? 'rgba(255,255,255,0.05)' : isSelected ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
                    background: isDisabled ? 'rgba(255,255,255,0.02)' : isSelected ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                    borderRadius: 10,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? '0 0 20px rgba(0,212,255,0.15), inset 0 1px 0 rgba(0,212,255,0.1)' : 'none',
                    fontFamily: 'Rajdhani,Outfit,sans-serif',
                  }}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => !isDisabled && setSelected(i)}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: isSelected ? '#00d4ff' : '#ccc' }}>
                    {item.label}
                    {isDisabled && <span style={{ fontSize: 10, color: '#ff2244', marginLeft: 8, letterSpacing: '0.1em' }}>(LOGIN REQ)</span>}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
                    {item.desc}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="w-full panel animate-slide-in">
            <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', color: '#00d4ff', marginBottom: 16 }}>
              ENTER ACCESS CODE
            </h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                ref={joinInputRef}
                className="input-pixel text-center text-xl tracking-widest uppercase"
                placeholder="NS-A247"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              {error && <p style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 12, color: '#ff2244' }}>⚠ {error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="btn-pixel btn-primary flex-1" disabled={loading}>
                  {loading ? '...' : 'ENTER →'}
                </button>
                <button type="button" className="btn-pixel flex-1" onClick={() => { setShowJoin(false); setError('') }}>
                  ABORT
                </button>
              </div>
            </form>
          </div>
        )}

        {error && !showJoin && <p style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 12, color: '#ff2244' }}>⚠ {error}</p>}

        <p style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em' }}>
          ↑↓ NAVIGATE  ·  ENTER CONFIRM
        </p>
      </div>

      {/* Legal Footer */}
      <div className="relative z-20 w-full flex flex-wrap justify-center items-center gap-x-4 gap-y-2 px-4 mt-12 pb-4"
        style={{ fontFamily: 'Outfit,sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}
      >
        <a href="#privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</a>
        <span className="hidden sm:inline opacity-30">|</span>
        <a href="#tos" className="hover:text-blue-400 transition-colors">Terms of Service</a>
        <span className="hidden sm:inline opacity-30">|</span>
        <a href="#contact" className="hover:text-blue-400 transition-colors">Contact</a>
        <span className="hidden sm:inline opacity-30">|</span>
        <a href="#delete-account" className="hover:text-red-400 transition-colors">Delete Account</a>
      </div>
    </div>
  )
}

// Animated plasma orb logo
function PlasmaAnimation() {
  return (
    <div className="relative inline-block" style={{ width: 72, height: 72 }}>
      {/* Outer glow rings */}
      <div style={{
        position: 'absolute', inset: -8,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(100,0,255,0.3) 0%, rgba(0,100,255,0.15) 50%, transparent 70%)',
        animation: 'pulseGlow 2s ease-in-out infinite',
      }} />
      {/* Main plasma orb */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #aaccff 0%, #4466ff 30%, #1100aa 60%, #050520 100%)',
        boxShadow: '0 0 30px rgba(80,0,255,0.6), 0 0 60px rgba(80,0,255,0.3), inset 0 2px 8px rgba(255,255,255,0.3)',
        animation: 'pulseGlow 1.8s ease-in-out infinite',
        position: 'relative',
      }}>
        {/* Specular gloss */}
        <div style={{
          position: 'absolute', top: 14, left: 16,
          width: 20, height: 12,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.45)',
          transform: 'rotate(-20deg)',
        }} />
      </div>
      {/* Orbiting energy spark */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 8, height: 8, marginTop: -4, marginLeft: -4,
        borderRadius: '50%',
        background: '#00ffff',
        boxShadow: '0 0 12px #00ffff',
        animation: 'orbit 1.5s linear infinite',
        transformOrigin: '40px 4px',
      }} />
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(36px); }
          to { transform: rotate(360deg) translateX(36px); }
        }
      `}</style>
    </div>
  )
}


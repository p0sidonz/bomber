import { useState, useRef, useEffect } from 'react'
import { signOut, createRoom, joinRoomByCode } from '../supabase'
import { showInterstitialAd } from '../admob'
import { playBGM } from '../game/audio/audio'

const MENU_ITEMS = [
  { id: 'classic', label: '▶ PLAY CLASSIC', desc: '50 LEVELS · SOLO' },
  { id: 'create', label: '⊕ CREATE ROOM', desc: 'HOST MULTIPLAYER' },
  { id: 'join', label: '⊞ JOIN ROOM', desc: 'ENTER ROOM CODE' },
  { id: 'leaderboard', label: '🏆 LEADERBOARD', desc: 'TOP PLAYERS' },
]

export default function LandingScreen({ user, nav }) {
  const [selected, setSelected] = useState(0)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const joinInputRef = useRef(null)
  
  const isGuest = user?.isGuest
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'PLAYER'
  const color = user?.user_metadata?.color || 'yellow'

  const COLOR_HEX = {
    red: '#e03040', blue: '#3060e0', green: '#30c060',
    yellow: '#f0c040', purple: '#9040c0', orange: '#e08030',
  }

  useEffect(() => {
    // Show an ad when the app lands on the main menu, max once per hour
    const lastAdTime = localStorage.getItem('last_app_open_ad_time')
    const now = Date.now()
    if (!lastAdTime || now - parseInt(lastAdTime) > 60 * 60 * 1000) {
      showInterstitialAd()
      localStorage.setItem('last_app_open_ad_time', now.toString())
    }
    
    // Play menu music (will play if user has already interacted with the page)
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
        // Also insert host as player
        const { joinRoomByCode: joinFn, supabase } = await import('../supabase')
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
    <div className="min-h-[100dvh] w-full bg-bm-dark relative overflow-y-auto flex flex-col items-center justify-center py-8">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #f0c040 0, #f0c040 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #f0c040 0, #f0c040 1px, transparent 1px, transparent 48px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 border-b border-bm-border">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: COLOR_HEX[color], boxShadow: `0 0 8px ${COLOR_HEX[color]}` }}
          />
          <span className="text-[8px] text-bm-accent">{displayName}</span>
        </div>
        <button
          className="text-[7px] text-gray-500 hover:text-bm-red transition-colors"
          onClick={async () => { await signOut(); nav('auth') }}
        >
          LOGOUT
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-4">
        {/* Logo */}
        <div className="text-center">
          <BombAnimation />
          <h1 className="logo-text text-3xl mt-4">BombRush Arena</h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-bm-accent opacity-30" />
            <span className="text-[7px] text-gray-500 tracking-widest">BLAST YOUR WAY TO GLORY</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-bm-accent opacity-30" />
          </div>
        </div>

        {/* Menu */}
        {!showJoin ? (
          <div className="w-full space-y-2">
            {MENU_ITEMS.map((item, i) => {
              const isDisabled = isGuest && ['create', 'join', 'leaderboard'].includes(item.id)
              return (
                <button
                  key={item.id}
                  id={`menu-${item.id}`}
                  className={`w-full text-left p-4 border-2 transition-all duration-150 flex items-center justify-between group ${
                    isDisabled 
                      ? 'border-gray-800 bg-gray-900/50 text-gray-600 cursor-not-allowed opacity-60'
                      : selected === i
                        ? 'border-bm-accent bg-bm-accent/10 text-bm-accent'
                        : 'border-bm-border text-gray-400 hover:border-bm-accent/50 hover:text-gray-200'
                  }`}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => !isDisabled && setSelected(i)}
                >
                  <span className="text-[10px]">
                    {item.label}
                    {isDisabled && <span className="text-[6px] text-bm-red ml-2 tracking-widest">(LOGIN REQ)</span>}
                  </span>
                  <span className={`text-[7px] ${isDisabled ? 'text-gray-700' : 'text-gray-600 group-hover:text-gray-400'}`}>
                    {item.desc}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="w-full panel animate-slide-in">
            <h2 className="text-[9px] text-bm-accent mb-4">ENTER ROOM CODE</h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                ref={joinInputRef}
                className="input-pixel text-center text-xl tracking-widest uppercase"
                placeholder="BOM247"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              {error && <p className="text-[8px] text-bm-red">⚠ {error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="btn-pixel btn-primary flex-1" disabled={loading}>
                  {loading ? '...' : 'JOIN →'}
                </button>
                <button type="button" className="btn-pixel flex-1" onClick={() => { setShowJoin(false); setError('') }}>
                  BACK
                </button>
              </div>
            </form>
          </div>
        )}

        {error && !showJoin && <p className="text-[8px] text-bm-red">⚠ {error}</p>}

        <p className="text-[7px] text-gray-700">↑↓ NAVIGATE · ENTER SELECT</p>
      </div>

      {/* Legal Footer */}
      <div className="relative z-20 w-full flex flex-wrap justify-center items-center gap-x-4 gap-y-2 px-4 text-[8px] sm:text-[10px] text-gray-500 font-['Inter',sans-serif] mt-12 pb-4">
        <a href="#privacy" className="hover:text-bm-accent transition-colors">Privacy Policy</a>
        <span className="hidden sm:inline">|</span>
        <a href="#tos" className="hover:text-bm-accent transition-colors">Terms of Service</a>
        <span className="hidden sm:inline">|</span>
        <a href="#contact" className="hover:text-bm-accent transition-colors">Contact</a>
        <span className="hidden sm:inline">|</span>
        <a href="#delete-account" className="hover:text-bm-red transition-colors">Delete Account</a>
      </div>
    </div>
  )
}

// Animated bomb logo component
function BombAnimation() {
  return (
    <div className="relative inline-block">
      <div className="text-6xl animate-bounce" style={{ animationDuration: '2s' }}>💣</div>
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-bm-red rounded-full animate-ping opacity-75" />
    </div>
  )
}

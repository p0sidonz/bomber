import { useState, useRef, useEffect, useMemo } from 'react'
import { signOut, createRoom, joinRoomByCode } from '../supabase'
import { showInterstitialAd, showRewardedAd } from '../admob'
import { isAdFree, purchaseRemoveAds, restorePurchases, getRemoveAdsPrice } from '../purchases'
import { playBGM } from '../game/audio/audio'
import { Capacitor } from '@capacitor/core'
import PlasmaAnimation from '../components/PlasmaAnimation'
import Walkthrough from '../components/Walkthrough'

const MENU_ITEMS = [
  { id: 'classic', label: 'SOLO MODE', desc: '50 LEVELS · CAMPAIGN', icon: '⚔', infoKey: 'solo' },
  { id: 'create', label: 'HOST GAME', desc: 'CREATE ARENA', icon: '◈', infoKey: 'multiplayer' },
  { id: 'join', label: 'JOIN GAME', desc: 'ENTER CODE', icon: '◉', infoKey: 'multiplayer' },
  { id: 'leaderboard', label: 'LEADERBOARD', desc: 'TOP PILOTS', icon: '♛' },
]

const COLOR_HEX = {
  red: '#ff2244', blue: '#2288ff', green: '#00e87a',
  yellow: '#ffcc00', purple: '#cc44ff', orange: '#ff7720',
  white: '#dde8ff', cyan: '#00d4ff',
}

// Generate random particles once per mount
function useParticles(count = 30) {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1.5 + Math.random() * 3,
      duration: 6 + Math.random() * 10,
      delay: Math.random() * 8,
      opacity: 0.2 + Math.random() * 0.5,
      isCyan: Math.random() > 0.6,
    })),
  [count])
}

export default function LandingScreen({ user, campaign, setCampaign, nav }) {
  const [selected, setSelected] = useState(0)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const joinInputRef = useRef(null)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [adFreeState, setAdFreeState] = useState(isAdFree())
  const [priceStr, setPriceStr] = useState('$3')
  const [showSettings, setShowSettings] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [infoMode, setInfoMode] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [showWalkthrough, setShowWalkthrough] = useState(false)

  // Admin Coins
  const [showAdminCoins, setShowAdminCoins] = useState(false)
  const [adminCoinInput, setAdminCoinInput] = useState('100')

  async function handleAddAdminCoins() {
    try {
      const { saveCampaignProgress } = await import('../supabase.js')
      const currentCoins = campaign?.coins || 0
      const amount = parseInt(adminCoinInput, 10) || 0
      if (amount > 0) {
        const newCampaign = { ...(campaign || {}), coins: currentCoins + amount }
        await saveCampaignProgress(newCampaign)
        if (setCampaign) setCampaign(newCampaign) // Update local state!
        alert(`Successfully added ${amount} coins!`)
        setShowAdminCoins(false)
      }
    } catch (e) {
      alert("Error adding coins: " + e.message)
    }
  }

  const particles = useParticles(30)
  const isGuest = user?.isGuest
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'PILOT'
  const color = user?.user_metadata?.color || 'yellow'

  useEffect(() => {
    const lastAdTime = localStorage.getItem('last_app_open_ad_time')
    const now = Date.now()
    if (!lastAdTime || now - parseInt(lastAdTime) > 60 * 60 * 1000) {
      showInterstitialAd()
      localStorage.setItem('last_app_open_ad_time', now.toString())
    }
    playBGM('menu')
    setAdFreeState(isAdFree())
    getRemoveAdsPrice().then(p => { if (p) setPriceStr(p) })
    // Trigger entrance animations
    requestAnimationFrame(() => setMounted(true))
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
        const room = await createRoom(user.id, 6, 'arena|10|180')
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

  const [earningCoin, setEarningCoin] = useState(false)

  const handleEarnCoin = async () => {
    if (earningCoin) return
    try {
      setEarningCoin(true)
      const now = Date.now()
      const fifteenMins = 15 * 60 * 1000
      let history = []
      try {
        history = JSON.parse(localStorage.getItem('bm_ad_timestamps') || '[]')
      } catch(e) {}
      
      history = history.filter(t => now - t < fifteenMins)
      if (history.length >= 2) {
        alert("You have already watched 2 ads recently. Please wait a few minutes before watching again!")
        setEarningCoin(false)
        return
      }

      const success = await showRewardedAd()
      if (success) {
        const { saveCampaignProgress } = await import('../supabase.js')
        const currentCoins = campaign?.coins || 0
        const newCampaign = { ...campaign, coins: currentCoins + 1 }
        setCampaign(newCampaign)
        await saveCampaignProgress(user.id, newCampaign)
        
        history.push(now)
        localStorage.setItem('bm_ad_timestamps', JSON.stringify(history))
        
        alert("Awesome! You earned 1 Coin. 🪙")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setEarningCoin(false)
    }
  }

  const playerColor = COLOR_HEX[color] || COLOR_HEX.yellow

  return (
    <div
      className="min-h-[100dvh] w-full relative overflow-y-auto overflow-x-hidden flex flex-col items-center"
      style={{ background: '#030308' }}
    >
      {/* ═══════════════════════════════════════════════════════
          LAYER 1: Animated Background
          ═══════════════════════════════════════════════════════ */}

      {/* Deep space gradient base */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 20%, #0c0c2f 0%, #060612 50%, #030308 100%)',
      }} />

      {/* Nebula blobs — animated floating */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '-10%', left: '20%', width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,100,255,0.08) 0%, transparent 70%)',
          animation: 'nebulaFloat 20s ease-in-out infinite',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '-5%', width: 350, height: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(100,0,200,0.06) 0%, transparent 70%)',
          animation: 'nebulaFloat 16s ease-in-out infinite reverse',
          filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '-5%', width: 300, height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)',
          animation: 'nebulaFloat 24s ease-in-out infinite 3s',
          filter: 'blur(40px)',
        }} />
      </div>

      {/* Star field grid — subtle dots */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 0.5px, transparent 0.5px)',
        backgroundSize: '60px 60px',
        opacity: 0.4,
      }} />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              bottom: '-10px',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.isCyan ? '#00d4ff' : '#cc88ff',
              boxShadow: `0 0 ${p.size * 2}px ${p.isCyan ? 'rgba(0,212,255,0.6)' : 'rgba(200,100,255,0.6)'}`,
              opacity: p.opacity,
              animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Scan line overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.03 }}>
        <div style={{
          position: 'absolute', left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.8), transparent)',
          animation: 'scanLine 4s linear infinite',
        }} />
      </div>

      {/* Animated space grid — perspective */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(0,180,255,0.03) 0, rgba(0,180,255,0.03) 1px, transparent 1px, transparent 64px),
          repeating-linear-gradient(90deg, rgba(0,180,255,0.03) 0, rgba(0,180,255,0.03) 1px, transparent 1px, transparent 64px)
        `,
        backgroundSize: '64px 64px',
      }} />

      {/* ═══════════════════════════════════════════════════════
          Top Right Icons (Info & Settings)
          ═══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', top: 20, right: 20, zIndex: 30,
        display: 'flex', gap: 12,
        animation: mounted ? 'fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' : 'none',
      }}>
        {/* Info Icon */}
        <div
          onClick={() => setShowInfo(true)}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
          }}
          className="hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          <span style={{
            fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 18,
            color: 'rgba(255,255,255,0.7)',
          }}>i</span>
        </div>

        {/* Settings Icon */}
        <div
          onClick={() => setShowSettings(true)}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
          }}
          className="hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          LAYER 3: Main Content
          ═══════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-5 flex-1 justify-center py-6 gap-6">

        {/* ─── Logo Section ─── */}
        <div
          className="flex flex-col items-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-20px)',
            transition: 'all 0.7s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <PlasmaAnimation />

          {/* Title */}
          <h1 style={{
            fontFamily: 'Rajdhani,Outfit,sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(36px, 9vw, 60px)',
            letterSpacing: '0.14em',
            background: 'linear-gradient(135deg, #00d4ff 0%, #6644ff 35%, #cc44ff 70%, #ff44aa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'titleGlow 3s ease-in-out infinite',
            marginTop: 8,
            lineHeight: 1.1,
            textAlign: 'center',
          }}>
            OMEGA ARENA
          </h1>

          {/* Tagline */}
          <div className="flex items-center gap-3 mt-2">
            <div style={{
              height: 1, width: 40,
              background: 'linear-gradient(to right, transparent, rgba(0,212,255,0.4))',
            }} />
            <span style={{
              fontFamily: 'Rajdhani,Outfit,sans-serif',
              fontSize: 10, fontWeight: 600,
              letterSpacing: '0.25em',
              color: 'rgba(0,212,255,0.45)',
            }}>
              DOMINATE THE GRID
            </span>
            <div style={{
              height: 1, width: 40,
              background: 'linear-gradient(to left, transparent, rgba(0,212,255,0.4))',
            }} />
          </div>
        </div>

        {/* ─── Menu Cards ─── */}
        {!showJoin ? (
          <div className="w-full flex flex-col gap-2.5">
            {MENU_ITEMS.map((item, i) => {
              const isDisabled = isGuest && ['create', 'join', 'leaderboard'].includes(item.id)
              const isSelected = selected === i
              return (
                <button
                  key={item.id}
                  id={`menu-${item.id}`}
                  disabled={isDisabled}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => !isDisabled && setSelected(i)}
                  className="group"
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    border: `1.5px solid ${isDisabled ? 'rgba(255,255,255,0.03)' : isSelected ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    background: isDisabled
                      ? 'rgba(255,255,255,0.01)'
                      : isSelected
                        ? 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(100,0,255,0.05) 100%)'
                        : 'rgba(255,255,255,0.02)',
                    borderRadius: 12,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.35 : 1,
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: isSelected
                      ? '0 0 20px rgba(0,212,255,0.12), 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,212,255,0.08)'
                      : '0 2px 8px rgba(0,0,0,0.2)',
                    fontFamily: 'Rajdhani,Outfit,sans-serif',
                    textAlign: 'left',
                    transform: isSelected && !isDisabled ? 'translateX(4px)' : 'translateX(0)',
                    position: 'relative',
                    overflow: 'hidden',
                    // Staggered entrance animation
                    animation: mounted ? `fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) ${0.15 + i * 0.08}s both` : 'none',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {/* Shimmer sweep on hover */}
                  {isSelected && !isDisabled && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, width: '30%',
                      background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.06), transparent)',
                      animation: 'shimmerSweep 2s ease-in-out infinite',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40,
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(100,0,255,0.1))'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.25s',
                    flexShrink: 0,
                    color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                    boxShadow: isSelected ? '0 0 12px rgba(0,212,255,0.2)' : 'none',
                  }}>
                    {item.icon}
                  </div>

                  {/* Text content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, letterSpacing: '0.06em',
                      color: isSelected ? '#fff' : '#aab',
                      transition: 'color 0.2s',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      {item.label}
                      {isDisabled && (
                        <span style={{
                          fontSize: 8, color: '#ff2244', letterSpacing: '0.12em',
                          background: 'rgba(255,34,68,0.1)', padding: '2px 6px', borderRadius: 4,
                          border: '1px solid rgba(255,34,68,0.2)',
                        }}>LOGIN REQ</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 10, letterSpacing: '0.1em',
                      color: isSelected ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.2)',
                      transition: 'color 0.2s', marginTop: 1,
                    }}>
                      {item.desc}
                    </div>
                  </div>

                  {/* Mode Info Icon (Pushed to Right) */}
                  {item.infoKey && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setInfoMode(item.infoKey)
                      }}
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: isSelected ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.3)',
                        cursor: 'help', transition: 'all 0.2s',
                        flexShrink: 0, marginRight: isSelected ? 0 : -8,
                      }}
                      className="hover:scale-110 hover:bg-cyan-500/20 hover:text-cyan-300"
                    >
                      i
                    </div>
                  )}

                  {/* Arrow indicator */}
                  <div style={{
                    fontSize: 14,
                    color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                    transition: 'all 0.25s',
                    transform: isSelected ? 'translateX(0)' : 'translateX(-4px)',
                    opacity: isSelected ? 1 : 0,
                    flexShrink: 0,
                  }}>
                    →
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          /* ─── Join Code Input Panel ─── */
          <div
            className="w-full animate-slide-in"
            style={{
              background: 'rgba(8,8,24,0.9)',
              border: '1.5px solid rgba(0,212,255,0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <h2 style={{
              fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
              letterSpacing: '0.15em', color: '#00d4ff', marginBottom: 16,
            }}>
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

        {/* ─── Remove Ads Button ─── */}
        {Capacitor.isNativePlatform() && !adFreeState && !showJoin && (
          <button
            id="btn-remove-ads"
            disabled={purchaseLoading}
            onClick={async () => {
              setPurchaseLoading(true)
              setPurchaseError('')
              try {
                const success = await purchaseRemoveAds()
                if (success) {
                  setAdFreeState(true)
                  setPurchaseSuccess(true)
                  setTimeout(() => setPurchaseSuccess(false), 4000)
                }
              } catch (err) {
                setPurchaseError(err.message || 'Purchase failed')
                setTimeout(() => setPurchaseError(''), 4000)
              } finally {
                setPurchaseLoading(false)
              }
            }}
            style={{
              width: '100%',
              padding: '12px 18px',
              border: '1.5px solid rgba(255,200,0,0.2)',
              background: 'linear-gradient(135deg, rgba(255,170,0,0.08) 0%, rgba(255,100,0,0.04) 100%)',
              borderRadius: 12,
              cursor: purchaseLoading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.25s',
              fontFamily: 'Rajdhani,Outfit,sans-serif',
              opacity: purchaseLoading ? 0.6 : 1,
              backdropFilter: 'blur(8px)',
              animation: mounted ? 'fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.55s both' : 'none',
            }}
            onMouseEnter={e => { if (!purchaseLoading) { e.currentTarget.style.borderColor = 'rgba(255,200,0,0.5)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,170,0,0.15)' } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,200,0,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#ffcc00' }}>
              {purchaseLoading ? '⏳ PROCESSING...' : '✦ REMOVE ADS'}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,200,0,0.4)', letterSpacing: '0.08em', fontWeight: 600 }}>
              {priceStr}
            </span>
          </button>
        )}

        {/* Purchase success toast */}
        {purchaseSuccess && (
          <div style={{
            padding: '10px 16px', width: '100%',
            background: 'rgba(0,232,122,0.1)',
            border: '1px solid rgba(0,232,122,0.25)',
            borderRadius: 10,
            fontFamily: 'Rajdhani,Outfit,sans-serif',
            fontSize: 12, color: '#00e87a', letterSpacing: '0.08em', fontWeight: 700,
            textAlign: 'center',
            animation: 'fadeSlideUp 0.3s ease-out',
          }}>
            ✓ ADS REMOVED SUCCESSFULLY
          </div>
        )}

        {/* Purchase error toast */}
        {purchaseError && (
          <div style={{
            padding: '10px 16px', width: '100%',
            background: 'rgba(255,34,68,0.1)',
            border: '1px solid rgba(255,34,68,0.25)',
            borderRadius: 10,
            fontFamily: 'Rajdhani,Outfit,sans-serif',
            fontSize: 11, color: '#ff2244', letterSpacing: '0.06em',
            textAlign: 'center',
          }}>
            ⚠ {purchaseError}
          </div>
        )}

        {error && !showJoin && <p style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 12, color: '#ff2244' }}>⚠ {error}</p>}

        {/* Navigation hint */}
        <p style={{
          fontFamily: 'Rajdhani,Outfit,sans-serif',
          fontSize: 10, color: 'rgba(255,255,255,0.12)',
          letterSpacing: '0.15em',
          animation: mounted ? 'fadeSlideUp 0.5s ease-out 0.6s both' : 'none',
        }}>
          ↑↓ NAVIGATE  ·  ENTER CONFIRM
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════
          LAYER 4: Footer
          ═══════════════════════════════════════════════════════ */}
      <div
        className="relative z-20 w-full shrink-0 flex flex-wrap justify-center items-center gap-x-4 gap-y-2 px-4 py-4"
        style={{
          fontFamily: 'Outfit,sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.15)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'linear-gradient(0deg, rgba(6,6,18,0.8) 0%, transparent 100%)',
        }}
      >
        <a href="#privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</a>
        <span className="opacity-30">·</span>
        <a href="#tos" className="hover:text-blue-400 transition-colors">Terms of Service</a>
        <span className="opacity-30">·</span>
        <a href="#contact" className="hover:text-blue-400 transition-colors">Contact</a>
        <span className="opacity-30">·</span>
        <a href="#delete-account" className="hover:text-red-400 transition-colors">Delete Account</a>
        {Capacitor.isNativePlatform() && (
          <>
            <span className="opacity-30">·</span>
            <button
              onClick={async () => {
                try {
                  const found = await restorePurchases()
                  if (found) {
                    setAdFreeState(true)
                    setPurchaseSuccess(true)
                    setTimeout(() => setPurchaseSuccess(false), 4000)
                  } else {
                    setPurchaseError('No previous purchase found')
                    setTimeout(() => setPurchaseError(''), 3000)
                  }
                } catch (err) {
                  setPurchaseError(err.message || 'Restore failed')
                  setTimeout(() => setPurchaseError(''), 3000)
                }
              }}
              className="hover:text-blue-400 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', padding: 0 }}
            >
              Restore Purchases
            </button>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          Corner HUD Decorations
          ═══════════════════════════════════════════════════════ */}
      {/* Top-left bracket */}
      <div className="absolute top-12 left-3 pointer-events-none" style={{ opacity: 0.1 }}>
        <div style={{ width: 20, height: 1, background: '#00d4ff' }} />
        <div style={{ width: 1, height: 20, background: '#00d4ff' }} />
      </div>
      {/* Top-right bracket */}
      <div className="absolute top-12 right-3 pointer-events-none" style={{ opacity: 0.1 }}>
        <div style={{ width: 20, height: 1, background: '#00d4ff', marginLeft: 'auto' }} />
        <div style={{ width: 1, height: 20, background: '#00d4ff', marginLeft: 'auto' }} />
      </div>
      {/* Bottom-left bracket */}
      <div className="absolute bottom-12 left-3 pointer-events-none" style={{ opacity: 0.1 }}>
        <div style={{ width: 1, height: 20, background: '#00d4ff' }} />
        <div style={{ width: 20, height: 1, background: '#00d4ff' }} />
      </div>
      {/* Bottom-right bracket */}
      <div className="absolute bottom-12 right-3 pointer-events-none" style={{ opacity: 0.1 }}>
        <div style={{ width: 1, height: 20, background: '#00d4ff', marginLeft: 'auto' }} />
        <div style={{ width: 20, height: 1, background: '#00d4ff', marginLeft: 'auto' }} />
      </div>
      {/* ═══════════════════════════════════════════════════════
          Settings Modal Overlay
          ═══════════════════════════════════════════════════════ */}
      {showSettings && (
        <div 
          style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div 
            style={{
              width: '100%', maxWidth: 320,
              background: 'linear-gradient(180deg, rgba(12,12,32,0.95) 0%, rgba(6,6,18,0.95) 100%)',
              border: '1.5px solid rgba(0,212,255,0.2)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.1) inset',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
              animation: 'fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 16, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.1em' }}>
                PILOT PROFILE
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{
                width: 64, height: 64,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${playerColor}22, ${playerColor}44)`,
                border: `2px solid ${playerColor}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 20px ${playerColor}44`,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: playerColor,
                  boxShadow: `0 0 12px ${playerColor}`,
                }} />
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'Rajdhani,Outfit,sans-serif', fontWeight: 800,
                  fontSize: 20, letterSpacing: '0.08em', color: playerColor,
                }}>
                  {displayName}
                </div>
                <div style={{
                  fontFamily: 'Outfit,sans-serif', fontSize: 10, letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.4)', marginTop: 2,
                }}>
                  {isGuest ? 'GUEST PILOT' : 'AUTHORIZED PILOT'}
                </div>
                {!isGuest && user?.email && (
                  <div style={{
                    fontFamily: 'Outfit,sans-serif', fontSize: 11,
                    color: 'rgba(255,255,255,0.6)', marginTop: 6,
                  }}>
                    {user.email}
                  </div>
                )}
              </div>
            </div>

            {user?.email === 'mail@iankit.me' && (
              <div style={{ width: '100%', marginTop: -8 }}>
                {!showAdminCoins ? (
                  <button
                    style={{
                      width: '100%',
                      fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                      letterSpacing: '0.12em', color: '#ffcc00',
                      background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.3)',
                      padding: '12px', borderRadius: 10, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    className="hover:bg-yellow-500/20 hover:border-yellow-500/50"
                    onClick={() => setShowAdminCoins(true)}
                  >
                    🛠 ADMIN: GET FREE COINS
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input 
                      type="number" 
                      value={adminCoinInput}
                      onChange={e => setAdminCoinInput(e.target.value)}
                      style={{
                        flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,200,0,0.4)',
                        color: '#ffcc00', padding: '10px', borderRadius: 8, fontFamily: 'Outfit,sans-serif',
                        outline: 'none', textAlign: 'center', fontSize: 16, fontWeight: 'bold'
                      }}
                    />
                    <button
                      onClick={handleAddAdminCoins}
                      style={{
                        background: 'rgba(0,255,100,0.1)', border: '1px solid rgba(0,255,100,0.4)',
                        color: '#00ff66', padding: '0 16px', borderRadius: 8, fontWeight: 'bold',
                        cursor: 'pointer',
                        fontFamily: 'Rajdhani,Outfit,sans-serif', letterSpacing: '0.05em'
                      }}
                      className="hover:bg-green-500/20"
                    >
                      ADD
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* REPLAY TUTORIAL */}
            <div style={{ width: '100%', marginTop: 8 }}>
              <button
                onClick={() => { setShowSettings(false); setShowWalkthrough(true) }}
                style={{
                  width: '100%',
                  fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.12em', color: '#00d4ff',
                  background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.25)',
                  padding: '12px', borderRadius: 10, cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                className="hover:bg-cyan-500/20 hover:border-cyan-500/50"
              >
                <span>📖</span> REPLAY TUTORIAL
              </button>
            </div>

            {/* RATE US */}
            {Capacitor.isNativePlatform() && (
              <div style={{ width: '100%', marginTop: 8 }}>
                <button
                  onClick={() => {
                    const appId = 'com.iankit.omegaarena'
                    const platform = Capacitor.getPlatform()
                    let url
                    if (platform === 'android') {
                      url = `market://details?id=${appId}`
                    } else if (platform === 'ios') {
                      // Replace APPLE_APP_ID with the real numeric App Store ID once published
                      url = `https://apps.apple.com/app/idAPPLE_APP_ID?action=write-review`
                    } else {
                      url = `https://play.google.com/store/apps/details?id=${appId}`
                    }
                    window.open(url, '_system')
                  }}
                  style={{
                    width: '100%',
                    fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                    letterSpacing: '0.12em', color: '#ffcc00',
                    background: 'rgba(255,204,0,0.08)',
                    border: '1px solid rgba(255,204,0,0.25)',
                    padding: '12px', borderRadius: 10, cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                  className="hover:bg-yellow-500/20 hover:border-yellow-500/50"
                >
                  <span>⭐</span> RATE US
                </button>
              </div>
            )}

            {/* EARN FREE COINS */}
            <div style={{ width: '100%', marginTop: 8 }}>
              <button
                onClick={handleEarnCoin}
                disabled={earningCoin}
                style={{
                  width: '100%',
                  fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.12em', color: '#00ffaa',
                  background: earningCoin ? 'rgba(0,255,170,0.05)' : 'rgba(0,255,170,0.1)',
                  border: `1px solid rgba(0,255,170,${earningCoin ? '0.1' : '0.3'})`,
                  padding: '12px', borderRadius: 10, cursor: earningCoin ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                className={earningCoin ? '' : "hover:bg-green-500/20 hover:border-green-500/50"}
              >
                <span>📺</span> {earningCoin ? 'LOADING...' : 'EARN 1 COIN'}
              </button>
            </div>

            <button
              style={{
                width: '100%',
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.12em', color: '#ff2244',
                background: 'rgba(255,34,68,0.1)', border: '1px solid rgba(255,34,68,0.3)',
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              className="hover:bg-red-500/20 hover:border-red-500/50"
              onClick={async () => { await signOut(); nav('auth') }}
            >
              DISCONNECT
            </button>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════
          Info Modal Overlay
          ═══════════════════════════════════════════════════════ */}
      {showInfo && (
        <div 
          style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
          onClick={() => setShowInfo(false)}
        >
          <div 
            style={{
              width: '100%', maxWidth: 360,
              background: 'linear-gradient(180deg, rgba(12,12,32,0.95) 0%, rgba(6,6,18,0.95) 100%)',
              border: '1.5px solid rgba(0,212,255,0.2)',
              borderRadius: 20,
              padding: '24px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.1) inset',
              display: 'flex', flexDirection: 'column', gap: 20,
              animation: 'fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: '#00d4ff', letterSpacing: '0.1em' }}>
                SCORING RULES
              </h2>
              <button 
                onClick={() => setShowInfo(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Outfit,sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>🧱</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Destroy Walls</div>
                  <div style={{ color: '#00d4ff', fontWeight: 600 }}>+10 pts <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>per block</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>👾</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Defeat Enemies</div>
                  <div style={{ color: '#00d4ff', fontWeight: 600 }}>+100 to +500 pts <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>based on type</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>⏱️</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Time Bonus</div>
                  <div style={{ color: '#00d4ff', fontWeight: 600 }}>+10 pts <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>per second remaining</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Sector Cleared</div>
                  <div style={{ color: '#00d4ff', fontWeight: 600 }}>+1,000 pts <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>flat bonus</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 16 }}>🥚</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Mystery Egg</div>
                  <div style={{ color: '#00d4ff', fontWeight: 600 }}>+2,000 pts <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>or extra life (or trap!)</span></div>
                </div>
              </div>

            </div>

            <button
              style={{
                width: '100%',
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.12em', color: '#00d4ff',
                background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.2s', marginTop: 8,
              }}
              className="hover:bg-cyan-500/20 hover:border-cyan-500/50"
              onClick={() => setShowInfo(false)}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════
          Mode Info Modal Overlay
          ═══════════════════════════════════════════════════════ */}
      {infoMode && (
        <div 
          style={{
            position: 'absolute', inset: 0, zIndex: 110,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
          onClick={() => setInfoMode(null)}
        >
          <div 
            style={{
              width: '100%', maxWidth: 360,
              background: 'linear-gradient(180deg, rgba(12,12,32,0.95) 0%, rgba(6,6,18,0.95) 100%)',
              border: '1.5px solid rgba(0,212,255,0.2)',
              borderRadius: 20,
              padding: '24px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.1) inset',
              display: 'flex', flexDirection: 'column', gap: 20,
              animation: 'fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: '#00d4ff', letterSpacing: '0.1em' }}>
                {infoMode === 'solo' ? 'SOLO MODE OBJECTIVE' : 'MULTIPLAYER OBJECTIVE'}
              </h2>
              <button 
                onClick={() => setInfoMode(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Outfit,sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              
              {infoMode === 'solo' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>👾</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Clear Sector</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>Destroy all enemies on the map using your bombs. Be careful not to blow yourself up!</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>★</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Find the Exit</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>A hidden exit portal is concealed beneath one of the soft walls. Destroy walls to find it.</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>⚡</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Escape the Arena</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>Once all enemies are defeated and the portal is revealed, enter the portal before time runs out to advance to the next sector.</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>⚔️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Eliminate Rivals</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>Use your bombs to trap and destroy other players. The last pilot standing wins the match.</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>🎁</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Power Up</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>Destroy walls to uncover power-ups like extra bombs, larger fire radius, and speed boosts to gain an edge.</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>☠️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Sudden Death</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>Watch the clock! When time runs low, the arena shrinks and blocks start falling to force an intense final showdown.</div>
                    </div>
                  </div>
                </>
              )}

            </div>

            <button
              style={{
                width: '100%',
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.12em', color: '#00d4ff',
                background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.2s', marginTop: 8,
              }}
              className="hover:bg-cyan-500/20 hover:border-cyan-500/50"
              onClick={() => setInfoMode(null)}
            >
              UNDERSTOOD
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Walkthrough */}
      <Walkthrough
        forceShow={showWalkthrough}
        onComplete={() => setShowWalkthrough(false)}
      />
    </div>
  )
}

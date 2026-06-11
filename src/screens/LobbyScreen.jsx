import { useState, useEffect, useMemo } from 'react'
import { supabase, setPlayerReady, startGame, getRoomPlayers, updateRoomSettings } from '../supabase'
import { playBGM } from '../game/audio/audio'
import { Share } from '@capacitor/share'

const COLORS = {
  red: '#ff2244', blue: '#2288ff', green: '#00e87a',
  yellow: '#ffcc00', purple: '#cc44ff', orange: '#ff7720',
  white: '#dde8ff', cyan: '#00d4ff',
}

const MAPS = [
  { id: 6, name: 'BATTLE ARENA', desc: 'All players, one map', icon: '⚔' },
  { id: 1, name: 'CLASSIC', desc: 'Symmetric corner zones', icon: '◈' },
]

const MATCH_TYPES = [
  { id: 'gate_rush', label: 'GATE RUSH', desc: 'Find the gate first to win!' },
]

const TIME_OPTIONS = [
  { value: '180', label: '3 MIN' },
  { value: '300', label: '5 MIN' },
  { value: '600', label: '10 MIN' },
  { value: '900', label: '15 MIN' },
  { value: '1200', label: '20 MIN' },
  { value: '1800', label: '30 MIN' },
  { value: '2700', label: '45 MIN' },
  { value: '3600', label: '60 MIN' },
]

// Floating particles for background
function useParticles(count = 20) {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 6,
      opacity: 0.15 + Math.random() * 0.35,
      isCyan: Math.random() > 0.5,
    })),
  [count])
}

export default function LobbyScreen({ user, room, nav }) {
  useEffect(() => {
    playBGM('menu')
  }, [])

  const [players, setPlayers] = useState([])
  const [isReady, setIsReady] = useState(false)
  const [mapId, setMapId] = useState(room?.map_id || 6) // Default: Battle Arena
  const [matchType, setMatchType] = useState(room?.match_type || 'last_standing')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isHost = room?.host_id === user?.id
  const particles = useParticles(20)

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  useEffect(() => {
    if (!room) return
    loadPlayers()

    const ch = supabase
      .channel(`lobby-${room.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${room.id}`,
      }, () => loadPlayers())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`,
      }, ({ new: updated }) => {
        if (updated.status === 'countdown') {
          nav('countdown', { room: updated })
        }
        setMapId(updated.map_id)
        setMatchType(updated.match_type)
      })
      .subscribe()

    const poll = setInterval(loadPlayers, 3000)

    return () => {
      supabase.removeChannel(ch)
      clearInterval(poll)
    }
  }, [room])

  async function loadPlayers() {
    const data = await getRoomPlayers(room.id)
    setPlayers(data || [])
    const me = (data || []).find(p => p.user_id === user.id)
    if (me) setIsReady(me.is_ready)
  }

  async function toggleReady() {
    const next = !isReady
    setIsReady(next)
    await setPlayerReady(room.id, user.id, next)
  }

  async function handleStart() {
    const allReady = players.filter(p => p.user_id !== room.host_id).every(p => p.is_ready)
    if (players.length < 2) return alert('Need at least 2 players')
    if (!allReady) return alert('All non-host players must be ready')
    setLoading(true)
    await startGame(room.id)
    setLoading(false)
  }

  async function handleMapChange(id) {
    setMapId(id)
    // When switching to battle arena, set default arena match type
    const newMatchType = id === 6 ? `arena|10|180` : 'gate_rush'
    setMatchType(newMatchType)
    if (isHost) await updateRoomSettings(room.id, id, newMatchType)
  }

  async function handleMatchTypeChange(mt) {
    setMatchType(mt)
    if (isHost) await updateRoomSettings(room.id, mapId, mt)
  }

  // FIX: Use a separate handler for arena sliders that debounces & doesn't trigger re-render loops
  function handleArenaEnemies(val) {
    const timePart = matchType.split('|')[2] || '180'
    const newMt = `arena|${val}|${timePart}`
    setMatchType(newMt)
    // Debounce the DB update to avoid rapid fire
    clearTimeout(window._arenaSettingsTimer)
    window._arenaSettingsTimer = setTimeout(() => {
      if (isHost) updateRoomSettings(room.id, mapId, newMt)
    }, 300)
  }

  function handleArenaTime(val) {
    const enemyPart = matchType.split('|')[1] || '10'
    const newMt = `arena|${enemyPart}|${val}`
    setMatchType(newMt)
    if (isHost) updateRoomSettings(room.id, mapId, newMt)
  }

  const allNonHostReady = players.filter(p => p.user_id !== room?.host_id).every(p => p.is_ready)
  const canStart = isHost && players.length >= 2 && allNonHostReady

  const filledSlots = players.length
  const showSlots = Math.min(6, filledSlots + 1)
  const slots = Array.from({ length: showSlots }, (_, i) => players.find(p => p.slot === i + 1) || null)

  async function handleShare() {
    try {
      await Share.share({
        title: 'Join my Bomberman Room',
        text: `Join my room in Omega Arena! Room Code: ${room?.code}`,
        dialogTitle: 'Share Room Code',
      })
    } catch (e) {
      console.error('Error sharing', e)
    }
  }

  const arenaEnemies = matchType.split('|')[1] || '10'
  const arenaTime = matchType.split('|')[2] || '180'
  const arenaTimeLabel = TIME_OPTIONS.find(t => t.value === arenaTime)?.label || `${Math.round(parseInt(arenaTime) / 60)} MIN`

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#030308', overflow: 'hidden' }}>

      {/* ═══════════════════════════════════════════════════════
          BACKGROUND LAYERS
          ═══════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 20%, #0c0c2f 0%, #060612 50%, #030308 100%)',
      }} />

      {/* Nebula blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '10%', right: '-10%', width: 300, height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(100,0,200,0.06) 0%, transparent 70%)',
          animation: 'nebulaFloat 18s ease-in-out infinite',
          filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '-5%', width: 250, height: 250,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)',
          animation: 'nebulaFloat 22s ease-in-out infinite reverse',
          filter: 'blur(40px)',
        }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 0.5px, transparent 0.5px)',
        backgroundSize: '60px 60px', opacity: 0.3,
      }} />

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute', left: `${p.left}%`, bottom: '-10px',
              width: p.size, height: p.size, borderRadius: '50%',
              background: p.isCyan ? '#00d4ff' : '#cc88ff',
              boxShadow: `0 0 ${p.size * 2}px ${p.isCyan ? 'rgba(0,212,255,0.5)' : 'rgba(200,100,255,0.5)'}`,
              opacity: p.opacity,
              animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          CONTENT — Scrollable
          ═══════════════════════════════════════════════════════ */}
      <div className="relative z-10 scrollbar-hide" style={{ flex: '1 1 0%', overflowY: 'auto', overflowX: 'hidden', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        <div className="w-full max-w-md mx-auto px-5 py-6 flex flex-col gap-5">

          {/* ─── Header: Room Code ─── */}
          <div
            className="text-center"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-15px)',
              transition: 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <p style={{
              fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.2em', color: 'rgba(0,212,255,0.4)', marginBottom: 6,
            }}>ROOM CODE</p>

            <div style={{
              fontFamily: 'Rajdhani,sans-serif', fontWeight: 700,
              fontSize: 'clamp(28px, 7vw, 42px)', letterSpacing: '0.35em',
              color: '#00d4ff',
              textShadow: '0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.2)',
            }}>
              {room?.code}
            </div>

            <button
              onClick={handleShare}
              className="group"
              style={{
                marginTop: 10, padding: '8px 16px',
                background: 'rgba(0,212,255,0.06)',
                border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: 8, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 10,
                fontWeight: 600, letterSpacing: '0.12em', color: '#00d4ff',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              SHARE CODE
            </button>
          </div>

          {/* ─── Players Panel ─── */}
          <div
            style={{
              background: 'rgba(8,8,24,0.85)',
              border: '1px solid rgba(0,212,255,0.1)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 14, padding: '16px 16px 14px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              animation: mounted ? 'fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' : 'none',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 style={{
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', color: '#00d4ff',
              }}>
                PILOTS ({players.length}/6)
              </h2>
              <span style={{
                fontFamily: 'Outfit,sans-serif', fontSize: 9, letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.2)',
              }}>
                MIN 2 TO LAUNCH
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {slots.map((player, i) => {
                const isMe = player?.user_id === user?.id
                const isPlayerHost = player?.user_id === room?.host_id
                const pColor = COLORS[player?.color] || '#555'

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${player
                        ? (isPlayerHost || player.is_ready)
                          ? 'rgba(0,232,122,0.2)'
                          : 'rgba(255,200,0,0.15)'
                        : 'rgba(255,255,255,0.03)'}`,
                      background: player
                        ? (isPlayerHost || player.is_ready)
                          ? 'rgba(0,232,122,0.04)'
                          : 'rgba(255,200,0,0.03)'
                        : 'rgba(255,255,255,0.01)',
                      transition: 'all 0.25s',
                    }}
                  >
                    {player ? (
                      <>
                        {/* Color dot */}
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: `linear-gradient(135deg, ${pColor}22, ${pColor}44)`,
                          border: `1.5px solid ${pColor}66`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 0 8px ${pColor}33`,
                        }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: pColor, boxShadow: `0 0 6px ${pColor}`,
                          }} />
                        </div>

                        {/* Name */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 12, fontWeight: 700,
                            letterSpacing: '0.04em', color: isMe ? pColor : '#ccc',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {player.display_name}
                          </div>
                        </div>

                        {/* Badge */}
                        {isPlayerHost ? (
                          <span style={{
                            fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.1em', color: '#00d4ff',
                            background: 'rgba(0,212,255,0.1)', padding: '3px 8px', borderRadius: 5,
                            border: '1px solid rgba(0,212,255,0.2)',
                          }}>HOST</span>
                        ) : (
                          <span style={{
                            fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: player.is_ready ? '#00e87a' : 'rgba(255,255,255,0.25)',
                            background: player.is_ready ? 'rgba(0,232,122,0.1)' : 'rgba(255,255,255,0.03)',
                            padding: '3px 8px', borderRadius: 5,
                            border: `1px solid ${player.is_ready ? 'rgba(0,232,122,0.25)' : 'rgba(255,255,255,0.05)'}`,
                            transition: 'all 0.2s',
                          }}>
                            {player.is_ready ? '✓ READY' : 'WAITING'}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{
                        fontFamily: 'Outfit,sans-serif', fontSize: 10, letterSpacing: '0.1em',
                        color: 'rgba(255,255,255,0.1)', padding: '4px 0',
                      }}>+ OPEN SLOT</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── Map Selector (host only) ─── */}
          {isHost && (
            <div
              style={{
                background: 'rgba(8,8,24,0.85)',
                border: '1px solid rgba(0,212,255,0.1)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 14, padding: 16,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                animation: mounted ? 'fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' : 'none',
              }}
            >
              <h2 style={{
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', color: '#00d4ff', marginBottom: 10,
              }}>SELECT MAP</h2>

              <div className="flex gap-2">
                {MAPS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleMapChange(m.id)}
                    style={{
                      flex: 1, padding: '12px 8px',
                      border: `1.5px solid ${mapId === m.id ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                      background: mapId === m.id
                        ? 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(100,0,255,0.05))'
                        : 'rgba(255,255,255,0.02)',
                      borderRadius: 10, cursor: 'pointer',
                      transition: 'all 0.25s', textAlign: 'center',
                      boxShadow: mapId === m.id ? '0 0 15px rgba(0,212,255,0.1)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{
                      fontFamily: 'Rajdhani,sans-serif', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: mapId === m.id ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                    }}>{m.name}</div>
                    <div style={{
                      fontFamily: 'Outfit,sans-serif', fontSize: 8, letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.2)', marginTop: 2,
                    }}>{m.desc}</div>
                  </button>
                ))}
              </div>

              {/* Battle Arena Settings */}
              {mapId === 6 && (
                <div style={{
                  marginTop: 12, padding: 14,
                  border: '1px solid rgba(0,212,255,0.12)',
                  background: 'rgba(0,0,0,0.3)', borderRadius: 10,
                }}>
                  <h3 style={{
                    fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.12em', color: 'rgba(0,212,255,0.6)', marginBottom: 12,
                  }}>ARENA SETTINGS</h3>

                  <div className="flex flex-col gap-4">
                    {/* Enemies Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label style={{
                          fontFamily: 'Outfit,sans-serif', fontSize: 10, letterSpacing: '0.08em',
                          color: 'rgba(255,255,255,0.4)',
                        }}>ENEMIES</label>
                        <span style={{
                          fontFamily: 'Rajdhani,sans-serif', fontSize: 14, fontWeight: 700,
                          color: '#ffcc00',
                        }}>{arenaEnemies}</span>
                      </div>
                      <input
                        type="range" min="0" max="20"
                        value={arenaEnemies}
                        onChange={(e) => handleArenaEnemies(e.target.value)}
                        className="w-full accent-bm-accent"
                        style={{ height: 4 }}
                      />
                    </div>

                    {/* Time Limit */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label style={{
                          fontFamily: 'Outfit,sans-serif', fontSize: 10, letterSpacing: '0.08em',
                          color: 'rgba(255,255,255,0.4)',
                        }}>TIME LIMIT</label>
                        <span style={{
                          fontFamily: 'Rajdhani,sans-serif', fontSize: 14, fontWeight: 700,
                          color: '#00d4ff',
                        }}>{arenaTimeLabel}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TIME_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleArenaTime(opt.value)}
                            style={{
                              padding: '5px 10px',
                              fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600,
                              letterSpacing: '0.04em',
                              border: `1px solid ${arenaTime === opt.value ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                              background: arenaTime === opt.value ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.02)',
                              color: arenaTime === opt.value ? '#00d4ff' : 'rgba(255,255,255,0.3)',
                              borderRadius: 6, cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Match Type (host, non-arena maps only) ─── */}
          {isHost && mapId !== 6 && (
            <div
              style={{
                background: 'rgba(8,8,24,0.85)',
                border: '1px solid rgba(0,212,255,0.1)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 14, padding: 16,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                animation: mounted ? 'fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s both' : 'none',
              }}
            >
              <h2 style={{
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', color: '#00d4ff', marginBottom: 10,
              }}>MATCH TYPE</h2>
              <div className="flex gap-2">
                {MATCH_TYPES.map(mt => (
                  <button
                    key={mt.id}
                    onClick={() => handleMatchTypeChange(mt.id)}
                    style={{
                      flex: 1, padding: '12px 10px',
                      border: `1.5px solid ${matchType === mt.id ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                      background: matchType === mt.id
                        ? 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(100,0,255,0.05))'
                        : 'rgba(255,255,255,0.02)',
                      borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'Rajdhani,sans-serif', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: matchType === mt.id ? '#00d4ff' : 'rgba(255,255,255,0.35)',
                      transition: 'all 0.25s', textAlign: 'center',
                    }}
                  >
                    {mt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Current Settings (Non-Host) ─── */}
          {!isHost && (
            <div
              style={{
                background: 'rgba(8,8,24,0.85)',
                border: '1px solid rgba(0,212,255,0.1)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 14, padding: 16,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                animation: mounted ? 'fadeSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' : 'none',
              }}
            >
              <h2 style={{
                fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', color: '#00d4ff', marginBottom: 10,
              }}>GAME SETTINGS</h2>

              <div style={{
                padding: 12, borderRadius: 10,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,255,0.08)',
              }}>
                <div style={{
                  fontFamily: 'Rajdhani,sans-serif', fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.06em', color: '#fff', marginBottom: 2,
                }}>
                  {MAPS.find(m => m.id === mapId)?.name || 'UNKNOWN MAP'}
                </div>
                <div style={{
                  fontFamily: 'Outfit,sans-serif', fontSize: 9, letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.25)', marginBottom: 10,
                }}>
                  {MAPS.find(m => m.id === mapId)?.desc}
                </div>

                {mapId === 6 ? (
                  <div className="flex gap-6">
                    <div>
                      <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>ENEMIES</div>
                      <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 16, fontWeight: 700, color: '#ffcc00' }}>{arenaEnemies}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>TIME LIMIT</div>
                      <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 16, fontWeight: 700, color: '#00d4ff' }}>{arenaTimeLabel}</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>MATCH TYPE</div>
                    <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 14, fontWeight: 700, color: '#00d4ff' }}>
                      {MATCH_TYPES.find(mt => mt.id === matchType)?.label || matchType}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Bottom padding so content doesn't hide behind fixed bar ─── */}
          <div style={{ height: 90, flexShrink: 0 }} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BOTTOM ACTIONS BAR — Fixed at bottom
          ═══════════════════════════════════════════════════════ */}
      <div
        className="z-20 w-full px-5 pt-3"
        style={{
          flexShrink: 0,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          background: 'linear-gradient(0deg, rgba(3,3,8,1) 0%, rgba(3,3,8,0.95) 50%, rgba(3,3,8,0.7) 80%, transparent 100%)',
        }}
      >
        <div className="max-w-md mx-auto flex gap-3">
          <button
            className="btn-pixel flex-1"
            onClick={() => nav('landing')}
            style={{ padding: '14px 16px' }}
          >
            ← LEAVE
          </button>
          {!isHost && (
            <button
              className={`btn-pixel flex-1 ${isReady ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleReady}
              style={{ padding: '14px 16px' }}
            >
              {isReady ? 'CANCEL READY' : 'READY ✓'}
            </button>
          )}
          {isHost && (
            <button
              className="btn-pixel btn-primary flex-1"
              onClick={handleStart}
              disabled={!canStart || loading}
              style={{ padding: '14px 16px' }}
            >
              {loading ? 'STARTING...' : canStart ? 'LAUNCH GAME →' : 'WAITING...'}
            </button>
          )}
        </div>

        {!isHost && (
          <p style={{
            fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 10,
            color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em',
            textAlign: 'center', marginTop: 8,
          }}>
            Waiting for host to launch...
          </p>
        )}
      </div>

      {/* Corner decorations */}
      <div className="absolute top-3 left-3 pointer-events-none" style={{ opacity: 0.08 }}>
        <div style={{ width: 16, height: 1, background: '#00d4ff' }} />
        <div style={{ width: 1, height: 16, background: '#00d4ff' }} />
      </div>
      <div className="absolute top-3 right-3 pointer-events-none" style={{ opacity: 0.08 }}>
        <div style={{ width: 16, height: 1, background: '#00d4ff', marginLeft: 'auto' }} />
        <div style={{ width: 1, height: 16, background: '#00d4ff', marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

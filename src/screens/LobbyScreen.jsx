import { useState, useEffect } from 'react'
import { supabase, setPlayerReady, startGame, getRoomPlayers, updateRoomSettings } from '../supabase'

const COLORS = { red: '#e03040', blue: '#3060e0', green: '#30c060', yellow: '#f0c040', purple: '#9040c0', orange: '#e08030' }
const MAPS = [
  { id: 1, name: 'CLASSIC', desc: 'Symmetric corner zones' },
  { id: 2, name: 'LABYRINTH', desc: 'Maze corridors' },
  { id: 3, name: 'OPEN FIELD', desc: 'Sparse walls, open center' },
  { id: 4, name: 'SPLIT', desc: 'Two halves, center gate' },
  { id: 5, name: 'CHAOS', desc: 'Asymmetric tight zones' },
]
const MATCH_TYPES = [
  { id: 'gate_rush', label: 'GATE RUSH', desc: 'Find the gate first to win!' },
]

export default function LobbyScreen({ user, room, nav }) {
  const [players, setPlayers] = useState([])
  const [isReady, setIsReady] = useState(false)
  const [mapId, setMapId] = useState(room?.map_id || 1)
  const [matchType, setMatchType] = useState(room?.match_type || 'last_standing')
  const [loading, setLoading] = useState(false)
  const isHost = room?.host_id === user?.id

  useEffect(() => {
    if (!room) return
    loadPlayers()

    // Subscribe to room_players changes (realtime)
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

    // Polling fallback (in case realtime isn't enabled for the table)
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
    if (isHost) await updateRoomSettings(room.id, id, matchType)
  }

  async function handleMatchTypeChange(mt) {
    setMatchType(mt)
    if (isHost) await updateRoomSettings(room.id, mapId, mt)
  }

  const allNonHostReady = players.filter(p => p.user_id !== room?.host_id).every(p => p.is_ready)
  const canStart = isHost && players.length >= 2 && allNonHostReady

  // Show occupied slots + 1 open slot (up to 6 max)
  const filledSlots = players.length
  const showSlots = Math.min(6, filledSlots + 1)
  const slots = Array.from({ length: showSlots }, (_, i) => players.find(p => p.slot === i + 1) || null)

  return (
    <div className="full-screen overflow-auto py-8">
      <div className="w-full max-w-2xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-[8px] text-gray-500 mb-2">ROOM CODE</p>
          <div className="room-code">{room?.code}</div>
          <p className="text-[7px] text-gray-600 mt-2">Share this code with friends</p>
        </div>

        {/* Players */}
        <div className="panel">
          <h2 className="text-[8px] text-bm-accent mb-4">PLAYERS ({players.length}/6) · MIN 2 TO START</h2>
          <div className="space-y-2">
            {slots.map((player, i) => (
              <div
                key={i}
                className={`player-slot ${player ? (player.is_ready || player.user_id === room?.host_id ? 'ready' : 'occupied') : ''}`}
              >
                {player ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ background: COLORS[player.color], boxShadow: `0 0 6px ${COLORS[player.color]}` }}
                    />
                    <span className="text-[9px] flex-1">{player.display_name}</span>
                    {player.user_id === room?.host_id && (
                      <span className="text-[7px] text-bm-accent">HOST</span>
                    )}
                    {player.user_id !== room?.host_id && (
                      <span className={`ready-badge ${player.is_ready ? 'opacity-100' : 'opacity-30'}`}>
                        {player.is_ready ? 'READY' : 'NOT READY'}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[7px] text-gray-700">OPEN SLOT</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Map selector (host only) */}
        {isHost && (
          <div className="panel">
            <h2 className="text-[8px] text-bm-accent mb-4">SELECT MAP</h2>
            <div className="grid grid-cols-5 gap-2">
              {MAPS.map(m => (
                <button
                  key={m.id}
                  className={`p-2 border-2 text-center transition-all ${mapId === m.id ? 'border-bm-accent bg-bm-accent/10' : 'border-bm-border hover:border-bm-accent/50'}`}
                  onClick={() => handleMapChange(m.id)}
                >
                  <div className="text-[7px] text-bm-accent mb-1">{m.name}</div>
                  <div className="text-[6px] text-gray-600">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Match type (host only) */}
        {isHost && (
          <div className="panel">
            <h2 className="text-[8px] text-bm-accent mb-4">MATCH TYPE</h2>
            <div className="grid grid-cols-2 gap-2">
              {MATCH_TYPES.map(mt => (
                <button
                  key={mt.id}
                  className={`p-3 border-2 text-[8px] transition-all ${matchType === mt.id ? 'border-bm-accent bg-bm-accent/10 text-bm-accent' : 'border-bm-border text-gray-400 hover:border-bm-accent/50'}`}
                  onClick={() => handleMatchTypeChange(mt.id)}
                >
                  {mt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button className="btn-pixel flex-1" onClick={() => nav('landing')}>
            ← LEAVE
          </button>
          {!isHost && (
            <button
              className={`btn-pixel flex-1 ${isReady ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleReady}
            >
              {isReady ? 'NOT READY' : 'READY ✓'}
            </button>
          )}
          {isHost && (
            <button
              className="btn-pixel btn-primary flex-1"
              onClick={handleStart}
              disabled={!canStart || loading}
            >
              {loading ? 'STARTING...' : `START GAME ${canStart ? '→' : '(WAITING)'}`}
            </button>
          )}
        </div>

        {!isHost && (
          <p className="text-center text-[7px] text-gray-600">Waiting for host to start...</p>
        )}
      </div>
    </div>
  )
}

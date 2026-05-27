import { useEffect, useRef, useState } from 'react'
import { generateMultiplayerZones } from '../game/levels/generator.js'
import { createInitialState, TILE } from '../game/engine/state.js'
import { movePlayer, updateSlidingBombs } from '../game/engine/physics.js'
import { plantBomb, updateBombs, updateExplosions, checkPowerupPickups } from '../game/engine/bombs.js'
import { updateEnemies } from '../game/enemies/enemies.js'
import { initInput, destroyInput, getPlayerInput } from '../game/input/input.js'
import { sfx, playBGM, stopBGM } from '../game/audio/audio.js'
import { subscribeGame, unsubscribeGame, broadcastInput, broadcastState } from '../game/multiplayer/channels.js'
import { getRoomPlayers } from '../supabase.js'
import PhaserGame from '../game/phaser/PhaserGame.jsx'

const TICK_RATE = 50

export default function GameScreen({ user, room, nav }) {
  const stateRef = useRef(null)
  const prevStateRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const inputQueueRef = useRef({}) // userId → keys
  const isHost = room?.host_id === user?.id
  const [gameOver, setGameOver] = useState(false)
  const [gameReady, setGameReady] = useState(false)
  const [spectating, setSpectating] = useState(false)
  const [hudData, setHudData] = useState(null)
  const bombPressedRef = useRef(false)
  const myUserId = user?.id

  async function initGame() {
    const players = await getRoomPlayers(room.id)

    // Generate zone-based map: each player gets their own solo-style zone
    const zoneData = generateMultiplayerZones(players.length)

    const playerConfigs = players.map((p, i) => ({
      userId: p.user_id,
      name: p.display_name,
      color: p.color,
      slot: p.slot,
      startX: zoneData.spawnPoints[i]?.x || 1,
      startY: zoneData.spawnPoints[i]?.y || 1,
    }))

    const state = createInitialState(zoneData.grid, playerConfigs, 'multiplayer')
    state.enemies = zoneData.enemies
    state.portals = zoneData.portals          // portal info per zone
    state.hiddenGateTiles = zoneData.hiddenGateTiles  // one exit gate per zone
    state.gateVisible = false
    state.matchType = 'gate_rush'
    state.timer = 99999
    state.zoneWidth = zoneData.zoneWidth
    state.dividerWidth = zoneData.dividerWidth

    // Assign each player to their zone
    Object.values(state.players).forEach((p, i) => {
      p.zone = i
      p.shieldTimer = 60  // 3-second spawn shield
    })

    stateRef.current = state
    setGameReady(true)
    playBGM('world1')
  }

  function hostTick() {
    const state = stateRef.current
    if (!state || state.status !== 'active') return

    prevStateRef.current = JSON.parse(JSON.stringify(state))

    // Apply all queued inputs from clients
    for (const [userId, keys] of Object.entries(inputQueueRef.current)) {
      const player = state.players[userId]
      if (!player || !player.alive) continue
      const skullReverse = player.skullEffect === 'reverse'
      movePlayer(player, keys, state.grid, state.bombs, skullReverse)
    }

    // Passability — pixel overlap check to avoid stuck-on-bomb bug
    const TS = 48, margin = 6
    for (const [userId, player] of Object.entries(state.players)) {
      if (!player.alive) continue
      for (const bomb of state.bombs) {
        if (bomb.passable && bomb.ownerId === userId) {
          const pL = player.px + margin, pR = player.px + TS - margin
          const pT = player.py + margin, pB = player.py + TS - margin
          const bL = bomb.x * TS, bR = bL + TS
          const bT = bomb.y * TS, bB = bT + TS
          const overlaps = pR > bL && pL < bR && pB > bT && pT < bB
          if (!overlaps) bomb.passable = false
        }
      }
    }

    // Local input
    const myKeys = getPlayerInput(0, 'online')
    const myPlayer = state.players[myUserId]
    if (myPlayer?.alive) {
      movePlayer(myPlayer, myKeys, state.grid, state.bombs, myPlayer.skullEffect === 'reverse')

      const bombPressed = myKeys.bomb
      if (bombPressed && !bombPressedRef.current) {
        plantBomb(state, myUserId)
        sfx.bombPlant()
      }
      bombPressedRef.current = bombPressed
    }

    // Update systems
    updateBombs(state)
    updateExplosions(state)
    updateEnemies(state)
    checkPowerupPickups(state)
    updateSlidingBombs(state.bombs, state.grid, state.players)
    checkPortalReveals(state)
    checkPortalTeleport(state)

    // Skull timers
    for (const player of Object.values(state.players)) {
      if (player.skullTimer > 0 && --player.skullTimer === 0) player.skullEffect = null
      if (player.wallPassTimer > 0) player.wallPassTimer--
      if (player.shieldTimer > 0) player.shieldTimer--
      if (player.respawnTimer > 0) {
        player.respawnTimer--
        if (player.respawnTimer === 0) {
          player.alive = true
          player.powerups = []
          player.maxBombs = 1
          player.fireRange = 1
          player.speed = 4
          player.activeBombs = 0
          player.shieldTimer = 60
          
          // Re-spawn at their original zone spawn
          const spawn = state.spawnPoints?.[player.slot - 1] || { x: 1, y: 1 }
          player.x = spawn.x; player.y = spawn.y; player.px = spawn.x * 48; player.py = spawn.y * 48
          player.zone = player.slot - 1
        }
      }
    }

    state.tick++
    state.timer--

    checkWinCondition(state)
    broadcastState(state)
    updateMPHud(state)
  }

  function updateMPHud(state) {
    const ticks = state.timer || 0
    const secs = Math.floor(ticks / 20)
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    setHudData({
      timerStr: `${m}:${s}`,
      timerTicks: ticks,
      players: Object.values(state.players || {}).map(p => ({
        userId: p.userId,
        name: p.name,
        color: p.color,
        kills: p.kills || 0,
        alive: p.alive,
      })),
    })
  }

  // Check if portals should be revealed (soft block was destroyed)
  function checkPortalReveals(state) {
    for (const portal of state.portals || []) {
      if (portal.revealed) continue
      // If the soft block hiding the portal was destroyed (now EMPTY), reveal it
      if (state.grid[portal.y] && state.grid[portal.y][portal.x] === TILE.EMPTY) {
        state.grid[portal.y][portal.x] = 4  // 4 = PORTAL tile
        portal.revealed = true
      }
    }
  }

  // Check if any player is standing on a revealed portal → teleport
  function checkPortalTeleport(state) {
    for (const player of Object.values(state.players)) {
      if (!player.alive) continue
      if ((player.teleportCooldown || 0) > 0) {
        player.teleportCooldown--
        continue
      }
      for (const portal of state.portals || []) {
        if (!portal.revealed) continue
        if (player.x === portal.x && player.y === portal.y) {
          // Teleport to target zone's portal position
          player.x = portal.targetX
          player.y = portal.targetY
          player.px = portal.targetX * 48
          player.py = portal.targetY * 48
          player.zone = portal.targetZone
          // Cooldown to avoid instant back-teleport (20 ticks = 1 second)
          player.teleportCooldown = 20
          
          // Also give them a brief invincibility shield
          player.shieldTimer = Math.max(player.shieldTimer || 0, 20)
          break
        }
      }
    }
  }

  function checkWinCondition(state) {
    if (state.status === 'finished') return
    // Grace period: don't check win in the first 3 seconds
    if (state.tick < 60) return
    const alive = Object.values(state.players).filter(p => p.alive)

    // Per-zone gate reveal: when all enemies in a zone are dead, reveal that zone's gate
    for (let z = 0; z < (state.hiddenGateTiles || []).length; z++) {
      const gateTile = state.hiddenGateTiles[z]
      if (!gateTile) continue // already revealed
      const zoneEnemies = (state.enemies || []).filter(e => e.zone === z && e.alive)
      if (zoneEnemies.length === 0) {
        // Reveal exit gate for this zone
        const [gx, gy] = gateTile
        state.grid[gy][gx] = TILE.GATE
        state.hiddenGateTiles[z] = null
      }
    }

    // Check if any player reached an exit gate
    for (const player of alive) {
      const grid = state.grid
      if (grid[player.y] && grid[player.y][player.x] === TILE.GATE) {
        state.status = 'finished'
        state.winner = player.userId
        setGameOver(true)
        stopBGM()
        setTimeout(() => nav('results', { result: buildResult(state) }), 2000)
        return
      }
    }

    // Fallback: last player alive wins
    if (alive.length <= 1 && Object.values(state.players).length > 1) {
      state.status = 'finished'
      state.winner = alive[0]?.userId || null
      setGameOver(true)
      stopBGM()
      setTimeout(() => nav('results', { result: buildResult(state) }), 2000)
    }
  }

  function buildResult(state) {
    return {
      winner: state.winner,
      players: Object.values(state.players).map(p => ({
        userId: p.userId,
        name: p.name,
        color: p.color,
        kills: p.kills || 0,
        alive: p.alive,
      })),
      matchType: state.matchType,
    }
  }

  useEffect(() => {
    initInput()
    initGame().then(() => {
      if (isHost) {
        tickIntervalRef.current = setInterval(hostTick, TICK_RATE)
      }
    })

    // Subscribe to game channel
    subscribeGame(room.code, {
      onInput: ({ userId, keys }) => {
        if (!isHost || userId === myUserId) return
        inputQueueRef.current[userId] = keys
      },
      onState: (newState) => {
        if (isHost) return
        prevStateRef.current = stateRef.current
        stateRef.current = newState
        const me = newState.players?.[myUserId]
        if (me && !me.alive && !spectating) setSpectating(true)
        if (newState.status === 'finished' && !gameOver) {
          setGameOver(true)
          stopBGM()
          setTimeout(() => nav('results', { result: buildResult(newState) }), 2000)
        }
        updateMPHud(newState)
      },
    })

    // Non-host: send inputs every tick
    if (!isHost) {
      tickIntervalRef.current = setInterval(() => {
        const keys = getPlayerInput(0, 'online')
        broadcastInput(myUserId, keys)

        const state = stateRef.current
        if (state) {
          const me = state.players?.[myUserId]
          if (me?.alive) {
            movePlayer(me, keys, state.grid, state.bombs, me.skullEffect === 'reverse')
            const bombPressed = keys.bomb
            if (bombPressed && !bombPressedRef.current) {
              plantBomb(state, myUserId)
              sfx.bombPlant()
            }
            bombPressedRef.current = bombPressed
          }
        }
      }, TICK_RATE)
    }

    return () => {
      destroyInput()
      clearInterval(tickIntervalRef.current)
      unsubscribeGame()
      stopBGM()
    }
  }, [isHost])

  return (
    <div className="full-screen bg-bm-dark relative" style={{ overflow: 'hidden' }}>
      {/* Phaser Game Engine — only mount after state is ready */}
      {gameReady ? (
        <PhaserGame
          stateRef={stateRef}
          mode="multiplayer"
          userId={myUserId}
          hudData={hudData}
      /> 
      ) : (
        <div className="countdown-overlay flex-col gap-4" style={{ zIndex: 30 }}>
          <div className="text-3xl">💣</div>
          <h2 className="text-pixel text-bm-accent" style={{ fontSize: '10px' }}>LOADING MAP...</h2>
        </div>
      )}

      {/* Debug Buttons */}
      {gameReady && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 50, display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '4px 10px', fontSize: '8px',
              fontFamily: '"Press Start 2P", monospace',
              background: '#e03040', color: '#fff', border: 'none',
              cursor: 'pointer', borderRadius: 4,
            }}
            onClick={() => {
              const s = stateRef.current
              if (!s) return
              for (const enemy of s.enemies || []) {
                enemy.alive = false
                enemy.deathFrame = 0
              }
            }}
          >☠ KILL ALL</button>
          <button
            style={{
              padding: '4px 10px', fontSize: '8px',
              fontFamily: '"Press Start 2P", monospace',
              background: '#f0c040', color: '#111', border: 'none',
              cursor: 'pointer', borderRadius: 4,
            }}
            onClick={() => {
              const s = stateRef.current
              if (!s) return
              for (let y = 0; y < s.grid.length; y++) {
                for (let x = 0; x < s.grid[y].length; x++) {
                  if (s.grid[y][x] === 2) { // SOFT
                    s.grid[y][x] = 0 // EMPTY
                  }
                }
              }
              // Reveal gates
              for (let i = 0; i < (s.hiddenGateTiles || []).length; i++) {
                const gateTile = s.hiddenGateTiles[i]
                if (gateTile) {
                  s.grid[gateTile[1]][gateTile[0]] = 3 // GATE
                  s.hiddenGateTiles[i] = null
                }
              }
              // Reveal portals
              for (const portal of s.portals || []) {
                if (!portal.revealed) {
                  s.grid[portal.y][portal.x] = 4 // PORTAL
                  portal.revealed = true
                }
              }
            }}
          >💥 BLAST WALLS</button>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        fontSize: '7px', color: '#555', zIndex: 20,
        fontFamily: '"Press Start 2P", monospace',
        pointerEvents: 'none',
      }}>
        ← → ↑ ↓ MOVE · SPACE BOMB
        {spectating && <span style={{ color: '#e03040', marginLeft: 16 }}>SPECTATING</span>}
      </div>

      {gameOver && (
        <div className="countdown-overlay flex-col gap-4" style={{ zIndex: 30 }}>
          <div className="text-4xl">🏆</div>
          <h2 className="text-pixel text-bm-yellow text-lg">GAME OVER</h2>
          <p style={{ fontSize: '8px', color: '#888', fontFamily: '"Press Start 2P", monospace' }}>
            Loading results...
          </p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { generateLevel, generateMultiplayerMap, SP_COLS, SP_ROWS } from '../game/levels/generator.js'
import { createInitialState, TILE } from '../game/engine/state.js'
import { movePlayer, checkPortalGates, updateSlidingBombs, interpolateStates } from '../game/engine/physics.js'
import { plantBomb, updateBombs, updateExplosions, checkPowerupPickups, updateGates, killPlayer } from '../game/engine/bombs.js'
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

    // Generate a singleplayer-style map (wide, with enemies and a hidden gate)
    const levelData = generateLevel(1) // Level 1 difficulty for multiplayer
    const grid = levelData.grid

    // Spawn points at safe corners of the 30×11 map
    const mpSpawns = [
      { x: 1, y: 1 },
      { x: SP_COLS - 2, y: SP_ROWS - 2 },
      { x: 1, y: SP_ROWS - 2 },
      { x: SP_COLS - 2, y: 1 },
      { x: Math.floor(SP_COLS / 2), y: 1 },
      { x: Math.floor(SP_COLS / 2), y: SP_ROWS - 2 },
    ]

    // Clear spawn zones for each player
    for (let i = 0; i < players.length; i++) {
      const sp = mpSpawns[i]
      const clears = [[sp.x,sp.y],[sp.x+1,sp.y],[sp.x,sp.y+1],[sp.x-1,sp.y],[sp.x,sp.y-1]]
      for (const [cx, cy] of clears) {
        if (cy >= 0 && cy < grid.length && cx >= 0 && cx < grid[0].length && grid[cy][cx] !== TILE.SOLID) {
          grid[cy][cx] = TILE.EMPTY
        }
      }
    }

    const playerConfigs = players.map((p, i) => ({
      userId: p.user_id,
      name: p.display_name,
      color: p.color,
      slot: p.slot,
      startX: mpSpawns[i]?.x || 1,
      startY: mpSpawns[i]?.y || 1,
    }))

    const state = createInitialState(grid, playerConfigs, 'multiplayer')
    state.enemies = levelData.enemies
    state.hiddenGateTile = levelData.hiddenGateTile
    state.gateVisible = false
    state.matchType = 'gate_rush'
    state.timer = 99999

    // Move enemies away from all player spawn zones (5-tile radius)
    const spawnSet = new Set()
    for (let i = 0; i < players.length; i++) {
      const sp = mpSpawns[i]
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          spawnSet.add(`${sp.x + dx},${sp.y + dy}`)
        }
      }
    }
    for (const enemy of state.enemies) {
      if (spawnSet.has(`${enemy.x},${enemy.y}`)) {
        // Find a safe position far from all spawns
        const safePos = state.enemies.length > 0
          ? findSafeEnemyPos(grid, spawnSet)
          : null
        if (safePos) {
          enemy.x = safePos[0]; enemy.y = safePos[1]
          enemy.px = safePos[0] * 48; enemy.py = safePos[1] * 48
        }
      }
    }

    // Give all players a spawn shield (3 seconds)
    for (const player of Object.values(state.players)) {
      player.shieldTimer = 60 // 60 ticks = 3 seconds at 20tps
    }

    stateRef.current = state
    setGameReady(true)
    playBGM('world1')
  }

  function findSafeEnemyPos(grid, spawnSet) {
    const rows = grid.length, cols = grid[0].length
    const candidates = []
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] === TILE.EMPTY && !spawnSet.has(`${x},${y}`)) {
          candidates.push([x, y])
        }
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)] || null
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
    updateGates(state)
    updateSlidingBombs(state.bombs, state.grid, state.players)
    checkPortalGatesTick(state)

    // Skull timers
    for (const player of Object.values(state.players)) {
      if (player.skullTimer > 0 && --player.skullTimer === 0) player.skullEffect = null
      if (player.wallPassTimer > 0) player.wallPassTimer--
      if (player.shieldTimer > 0) player.shieldTimer--
      if (player.respawnTimer > 0) {
        player.respawnTimer--
        if (player.respawnTimer === 0) {
          player.alive = true
          const spawn = state.spawnPoints?.[player.slot - 1]
          if (spawn) { player.x = spawn.x; player.y = spawn.y; player.px = spawn.x * 48; player.py = spawn.y * 48 }
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

  function checkPortalGatesTick(state) {
    for (const player of Object.values(state.players)) {
      if (player.alive) checkPortalGates(player, state.gates || [])
    }
  }

  function checkWinCondition(state) {
    if (state.status === 'finished') return
    // Grace period: don't check win in the first 3 seconds
    if (state.tick < 60) return
    const alive = Object.values(state.players).filter(p => p.alive)

    // Gate Rush: gate opens when all enemies are dead
    const enemiesAlive = (state.enemies || []).filter(e => e.alive)
    if (enemiesAlive.length === 0 && state.hiddenGateTile) {
      // Reveal the gate
      const [gx, gy] = state.hiddenGateTile
      state.grid[gy][gx] = TILE.GATE
      state.gateVisible = true
      state.hiddenGateTile = null
    }

    // Check if any player reached the gate
    if (state.gateVisible) {
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

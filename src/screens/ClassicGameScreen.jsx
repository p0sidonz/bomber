import { useEffect, useRef, useState, useCallback } from 'react'
import { generateLevel } from '../game/levels/generator.js'
import { createInitialState } from '../game/engine/state.js'
import { movePlayer } from '../game/engine/physics.js'
import { plantBomb, updateBombs, updateExplosions, checkPowerupPickups, remoteDetonate } from '../game/engine/bombs.js'
import { updateEnemies } from '../game/enemies/enemies.js'
import { initInput, destroyInput, getPlayerInput } from '../game/input/input.js'
import { sfx, playBGM, stopBGM, setBGMFast } from '../game/audio/audio.js'
import { insertHighScore, saveCampaignProgress } from '../supabase.js'
import { showInterstitialAd } from '../admob.js'
import PhaserGame from '../game/phaser/PhaserGame.jsx'
import MobileControls from '../components/MobileControls.jsx'

const TICK_RATE = 50 // ms per game tick (20 tps)
const DEBUG = false // set to false to hide debug buttons

const PW_COLORS_CSS = {
  extrabomb: '#f0c040', fireup: '#ff4400', speedup: '#40ff40',
  kick: '#ff8800', remote: '#8888ff', bombpass: '#cccccc',
  wallpass: '#aaffaa', fullfire: '#ff2200', skull: '#aa0000',
  clock: '#00ccff', mystery: '#ff00ff', gatebomb: '#ffaa00',
  shield: '#4488ff', decoy: '#ff88ff', blockitem: '#888888', swap: '#00ffcc',
}

export default function ClassicGameScreen({ user, startingLevel = 1, nav }) {
  const stateRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const levelRef = useRef(1)
  const [overlay, setOverlay] = useState(null) // null | 'paused' | 'level_clear' | 'game_over' | 'game_complete'
  const [hudData, setHudData] = useState(null)
  const bombPressedRef = useRef(false)

  const displayName = user?.user_metadata?.display_name || 'PLAYER'

  function loadLevel(level) {
    const { grid, hiddenGateTile, hiddenPowerupTile, powerupType, enemies, playerSpawn, config } = generateLevel(level)
    const playerConfig = [{
      userId: user.id,
      name: displayName,
      color: user?.user_metadata?.color || 'white',
      startX: playerSpawn.x,
      startY: playerSpawn.y,
      zone: 1,
    }]
    const s = createInitialState(grid, playerConfig, 'singleplayer')
    s.level = level
    s.timer = config.timer * 20 // convert to ticks
    s.hiddenGateTile = hiddenGateTile
    s.hiddenPowerupTile = hiddenPowerupTile
    s.powerupType = powerupType
    s.enemies = enemies

    // Restore stats from previous level (carry forward powerups)
    const prevPlayer = stateRef.current ? Object.values(stateRef.current.players)[0] : null
    const playerInState = Object.values(s.players)[0]
    const resetPowerups = ['remote', 'wallpass', 'bombpass']

    if (prevPlayer) {
      playerInState.score = prevPlayer.score || 0
      playerInState.lives = prevPlayer.lives || 3
      // Carry forward accumulated stats
      playerInState.maxBombs = prevPlayer.maxBombs || 1
      playerInState.fireRange = prevPlayer.fireRange || 1
      playerInState.speed = prevPlayer.speed || 8
      // Carry forward powerups EXCEPT remote, wallpass, bombpass (these reset each level)
      playerInState.powerups = (prevPlayer.powerups || []).filter(p => !resetPowerups.includes(p))
    } else {
      // First load from level select: always start with 3 lives.
      // Snapshot stats (score, powerups, etc.) are only used during sequential play (prevPlayer path above).
      // When replaying a stage from level select, start fresh.
      playerInState.score = 0
      playerInState.lives = 3
      playerInState.maxBombs = 1
      playerInState.fireRange = 1
      playerInState.speed = 8
      playerInState.powerups = []
    }
    playerInState.startX = playerSpawn.x
    playerInState.startY = playerSpawn.y

    stateRef.current = s

    // Play BGM
    if (level % 10 === 0) playBGM('boss')
    else if (level > 25) playBGM('world2')
    else playBGM('world1')
  }

  function gameTick() {
    const state = stateRef.current
    if (!state || state.status !== 'active') return

    // Input
    const keys = getPlayerInput(0, 'online')
    const player = Object.values(state.players)[0]
    if (!player) return

    const skullReverse = player.skullEffect === 'reverse'
    movePlayer(player, keys, state.grid, state.bombs, skullReverse)

    // Once the planting player walks off their own bomb, make it solid again
    // Uses pixel overlap to avoid premature solidification that causes stuck bug
    const TS = 48, margin = 6
    for (const bomb of state.bombs) {
      if (bomb.passable && bomb.ownerId === player.userId) {
        const pL = player.px + margin, pR = player.px + TS - margin
        const pT = player.py + margin, pB = player.py + TS - margin
        const bL = bomb.x * TS, bR = bL + TS
        const bT = bomb.y * TS, bB = bT + TS
        const overlaps = pR > bL && pL < bR && pB > bT && pT < bB
        if (!overlaps) {
          bomb.passable = false
        }
      }
    }

    // Bomb press
    const currentBomb = keys.bomb
    if (currentBomb && !bombPressedRef.current) {
      const hasRemote = player.powerups?.includes('remote')
      const myRemoteBombs = hasRemote ? state.bombs.filter(b => b.ownerId === player.userId && b.remote) : []
      const atMaxBombs = player.activeBombs >= player.maxBombs

      if (hasRemote && myRemoteBombs.length > 0 && atMaxBombs) {
        // All bombs placed — detonate them
        remoteDetonate(state, player.userId)
        sfx.explosion()
      } else {
        // Plant a new bomb
        plantBomb(state, player.userId)
        sfx.bombPlant()
      }
    }
    bombPressedRef.current = currentBomb

    // Skull timers
    if (player.skullTimer > 0) {
      player.skullTimer--
      if (player.skullTimer <= 0) player.skullEffect = null
    }
    if (player.wallPassTimer > 0) player.wallPassTimer--
    if (player.shieldTimer > 0) player.shieldTimer--

    // Update systems
    const enemiesBefore = (state.enemies || []).filter(e => e.alive).length

    updateBombs(state)
    updateExplosions(state)
    checkPowerupPickups(state)
    updateEnemies(state)

    const enemiesAfter = (state.enemies || []).filter(e => e.alive).length
    if (enemiesBefore > 0 && enemiesAfter === 0) {
      sfx.allEnemiesDead()
    }

    // Advance tick
    state.tick = (state.tick || 0) + 1

    // Timer
    state.timer--
    if (state.timer <= 0) {
      spawnOneals(state)
      state.timer = 300 * 20
    }
    if (state.timer === 600) {
      sfx.timerWarning()
      setBGMFast(true)
    }

    // Respawn handling
    if (!player.alive) {
      if (state.status !== 'game_over') {
        sfx.playerDeath()
        state.status = 'game_over'
        stopBGM()
        setOverlay('game_over')
        showInterstitialAd() // AdMob Trigger: Game over/lost
      }
      return
    }

    // Check gate step (enter exit)
    if (state.gateVisible && state.grid[player.y]?.[player.x] === 3 /* GATE */) {
      const allEnemiesDead = (state.enemies || []).filter(e => e.alive).length === 0
      if (allEnemiesDead) {
        clearLevel()
        return
      }
    }

    // Update HUD data for React overlay
    const ticks = state.timer || 0
    const secs = Math.floor(ticks / 20)
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    setHudData({
      level: state.level || 1,
      timerStr: `${m}:${s}`,
      timerTicks: ticks,
      lives: player.lives,
      score: player.score || 0,
      enemyCount: (state.enemies || []).filter(e => e.alive).length,
      maxBombs: player.maxBombs || 1,
      fireRange: player.fireRange || 1,
      speed: player.speed || 1,
      skullEffect: player.skullEffect,
      gateOpen: state.gateVisible,
      powerups: (player.powerups || []).map(pw => ({
        name: pw.toUpperCase(),
        color: PW_COLORS_CSS[pw] || '#ffffff',
      })),
    })
  }

  function clearLevel() {
    sfx.levelClear()
    stopBGM()
    setOverlay('level_clear')
    stateRef.current.status = 'cleared'
    showInterstitialAd() // AdMob Trigger: Level cleared

    const player = stateRef.current ? Object.values(stateRef.current.players)[0] : null
    if (player) {
      player.score = (player.score || 0) + 1000 // level clear bonus

      const currentLevel = levelRef.current
      
      // Reward +1 life every 3rd level, max 6
      if (currentLevel % 3 === 0) {
        player.lives = Math.min(6, (player.lives || 3) + 1)
      }

      // Save campaign progress to Supabase (Snapshot Memory)
      const nextLevel = currentLevel + 1
      const campaign = user?.user_metadata?.campaign || {}
      
      let maxLevel = campaign.maxLevel || 1
      if (maxLevel < nextLevel) maxLevel = nextLevel

      const levelStats = campaign.levelStats || {}

      // Only save a snapshot for the next level if they've never reached it before
      if (!levelStats[nextLevel]) {
        levelStats[nextLevel] = {
          score: player.score,
          lives: player.lives,
          maxBombs: player.maxBombs,
          fireRange: player.fireRange,
          speed: player.speed,
          powerups: player.powerups
        }
      }

      saveCampaignProgress({ maxLevel, levelStats })
        .catch(err => console.error('Failed to save campaign:', err))
    }

    setTimeout(() => {
      const nextLevel = levelRef.current + 1
      if (nextLevel > 50) {
        setOverlay('game_complete')
        saveHighScore()
      } else {
        levelRef.current = nextLevel
        loadLevel(nextLevel)
        setOverlay(null)
        stateRef.current.status = 'active'
      }
    }, 2000)
  }

  async function saveHighScore() {
    const player = stateRef.current ? Object.values(stateRef.current.players)[0] : null
    if (!player) return
    try {
      await insertHighScore(user.id, displayName, player.score || 0, levelRef.current)
    } catch (_) {}
  }

  function spawnOneals(state) {
    const gridRows = state.grid.length
    const gridCols = state.grid[0].length
    for (let i = 0; i < 3; i++) {
      const side = Math.floor(Math.random() * 4)
      let x, y
      if (side === 0) { x = 1; y = Math.floor(Math.random() * gridRows) }
      else if (side === 1) { x = gridCols - 2; y = Math.floor(Math.random() * gridRows) }
      else if (side === 2) { x = Math.floor(Math.random() * gridCols); y = 1 }
      else { x = Math.floor(Math.random() * gridCols); y = gridRows - 2 }
      if (state.grid[y]?.[x] === 0) {
        state.enemies.push({
          id: `oneal-rush-${Date.now()}-${i}`,
          type: 'Oneal', x, y, px: x * 48, py: y * 48,
          alive: true, hp: 1, speed: 2, ai: 'chase_loose',
          dir: 'down', frame: 0, frameTimer: 0, moveTimer: 0, points: 200,
        })
      }
    }
  }

  // Handle ESC for pause and tab switching
  useEffect(() => {
    function togglePause() {
      setOverlay(prev => {
        if (!prev) {
          if (stateRef.current) stateRef.current.status = 'paused'
          return 'paused'
        }
        if (prev === 'paused') {
          if (stateRef.current) stateRef.current.status = 'active'
          return null
        }
        return prev
      })
    }

    function handleKey(e) {
      if (e.key === 'Escape') togglePause()
    }

    function pauseGame() {
      setOverlay(prev => {
        if (!prev) {
          if (stateRef.current && stateRef.current.status === 'active') {
            stateRef.current.status = 'paused'
            return 'paused'
          }
        }
        return prev
      })
    }

    function handleVisibility() {
      if (document.hidden) pauseGame()
    }

    window.addEventListener('keydown', handleKey)
    window.addEventListener('blur', pauseGame)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('blur', pauseGame)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    initInput()
    loadLevel(startingLevel)
    levelRef.current = startingLevel

    tickIntervalRef.current = setInterval(gameTick, TICK_RATE)

    return () => {
      destroyInput()
      clearInterval(tickIntervalRef.current)
      stopBGM()
    }
  }, [startingLevel])

  function handleRestart() {
    const currentLevel = levelRef.current
    loadLevel(currentLevel)
    setOverlay(null)
    stateRef.current.status = 'active'
    playBGM('world1')
  }

  function handleQuit() {
    saveHighScore()
    stopBGM()
    nav('level_select')
  }

  return (
    <div className="full-screen bg-bm-dark relative" style={{ overflow: 'hidden' }}>
      {/* Phaser Game Engine */}
      <PhaserGame
        stateRef={stateRef}
        mode="singleplayer"
        userId={user.id}
        hudData={hudData}
      />

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 8, right: 16,
        fontSize: '7px', color: '#555', zIndex: 20,
        fontFamily: '"Press Start 2P", monospace',
        pointerEvents: 'none',
      }}>
        ← → ↑ ↓ MOVE · SPACE BOMB · ESC PAUSE
      </div>

      {/* Mobile Touch Controls */}
      {!overlay && <MobileControls />}

      {/* Top right Pause Button */}
      {!overlay && (
        <button
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 300,
            background: 'rgba(0,0,0,0.5)', color: '#fff',
            border: '2px solid #f0c040', borderRadius: '4px',
            padding: '8px 12px', fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px', cursor: 'pointer', pointerEvents: 'auto'
          }}
          onClick={() => setOverlay('paused')}
        >
          ⏸ PAUSE
        </button>
      )}

      {/* Debug buttons */}
      {DEBUG && (
        <div style={{
          position: 'absolute', top: 60, right: 16, zIndex: 25,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
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
                  if (s.grid[y][x] === 2) {
                    // Reveal gate if hidden here
                    if (s.hiddenGateTile && s.hiddenGateTile[0] === x && s.hiddenGateTile[1] === y) {
                      s.grid[y][x] = 3 // GATE
                      s.gateVisible = true
                      s.hiddenGateTile = null
                    // Reveal powerup if hidden here
                    } else if (s.hiddenPowerupTile && s.hiddenPowerupTile[0] === x && s.hiddenPowerupTile[1] === y) {
                      s.grid[y][x] = 0 // EMPTY
                      s.powerupsOnMap.push({ x, y, type: s.powerupType || 'extrabomb' })
                      s.hiddenPowerupTile = null
                    } else {
                      s.grid[y][x] = 0 // EMPTY
                    }
                  }
                }
              }
            }}
          >💥 BLAST WALLS</button>
        </div>
      )}

      {/* Overlays */}
      {overlay === 'paused' && (
        <div className="countdown-overlay" style={{ zIndex: 300, flexDirection: 'column', overflowY: 'auto' }}>
          <h2 className="text-pixel text-bm-accent text-xl" style={{ marginBottom: 16 }}>PAUSED</h2>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button className="btn-pixel" onClick={() => {
              if (stateRef.current) stateRef.current.status = 'active'
              setOverlay(null)
            }}>RESUME</button>
            <button className="btn-pixel btn-danger" onClick={handleQuit}>QUIT</button>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '12px 16px',
            maxWidth: 480, width: '90%',
            fontFamily: '"Press Start 2P", monospace', fontSize: '7px',
            color: '#ccc', lineHeight: '1.8',
          }}>
            <div style={{ color: '#f0c040', fontSize: '9px', marginBottom: 8, textAlign: 'center' }}>⚡ POWERUP GUIDE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
              <div><span style={{ color: '#f0c040' }}>B</span> Extra Bomb — +1 bomb</div>
              <div><span style={{ color: '#ff4400' }}>F</span> Fire Up — +1 blast range</div>
              <div><span style={{ color: '#40ff40' }}>S</span> Speed Up — move faster</div>
              <div><span style={{ color: '#ff8800' }}>K</span> Kick — push bombs</div>
              <div><span style={{ color: '#8888ff' }}>R</span> Remote — detonate anytime</div>
              <div><span style={{ color: '#cccccc' }}>P</span> Bomb Pass — walk thru bombs</div>
              <div><span style={{ color: '#aaffaa' }}>W</span> Wall Pass — walk thru bricks</div>
              <div><span style={{ color: '#ff2200' }}>X</span> Full Fire — max blast range</div>
              <div><span style={{ color: '#aa0000' }}>!</span> Skull — random curse (bad!)</div>
              <div><span style={{ color: '#00ccff' }}>T</span> Clock — +60 sec timer</div>
              <div><span style={{ color: '#ff00ff' }}>?</span> Mystery — random powerup</div>
            </div>
            <div style={{ marginTop: 10, color: '#888', textAlign: 'center', fontSize: '6px' }}>
              DESTROY BRICKS TO FIND POWERUPS · FIND THE EXIT GATE · KILL ALL ENEMIES TO OPEN IT
            </div>
          </div>
        </div>
      )}

      {overlay === 'level_clear' && (
        <div className="countdown-overlay flex-col gap-4" style={{ zIndex: 300 }}>
          <div className="text-5xl">🎉</div>
          <h2 className="text-pixel text-bm-green text-lg">LEVEL CLEAR!</h2>
          <p style={{ fontSize: '8px', color: '#f0c040', fontFamily: '"Press Start 2P", monospace' }}>
            Score: {hudData?.score || 0}
          </p>
          <p style={{ fontSize: '7px', color: '#888', fontFamily: '"Press Start 2P", monospace' }}>
            Next level loading...
          </p>
        </div>
      )}

      {overlay === 'game_over' && (
        <div className="countdown-overlay flex-col gap-6" style={{ zIndex: 300 }}>
          <div className="text-5xl">💥</div>
          <h2 className="text-pixel text-bm-red text-xl">GAME OVER</h2>
          <p style={{ fontSize: '8px', color: '#f0c040', fontFamily: '"Press Start 2P", monospace' }}>
            Score: {hudData?.score || 0} · Level: {hudData?.level || 1}
          </p>
          <div className="flex gap-3">
            <button className="btn-pixel btn-primary" onClick={handleRestart}>RETRY</button>
            <button className="btn-pixel" onClick={handleQuit}>MENU</button>
          </div>
        </div>
      )}

      {overlay === 'game_complete' && (
        <div className="countdown-overlay flex-col gap-6" style={{ zIndex: 300 }}>
          <div className="text-5xl">🏆</div>
          <h2 className="text-pixel text-bm-yellow text-base leading-loose text-center">
            YOU BEAT<br />ALL 50 LEVELS!
          </h2>
          <p style={{ fontSize: '8px', color: '#f0c040', fontFamily: '"Press Start 2P", monospace' }}>
            Final Score: {hudData?.score || 0}
          </p>
          <button className="btn-pixel btn-primary" onClick={handleQuit}>MAIN MENU</button>
        </div>
      )}
    </div>
  )
}

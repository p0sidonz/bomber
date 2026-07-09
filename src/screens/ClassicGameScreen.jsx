import { useEffect, useRef, useState, useCallback } from 'react'
import { generateLevel } from '../game/levels/generator.js'
import { createInitialState } from '../game/engine/state.js'
import { movePlayer, updateSlidingBombs } from '../game/engine/physics.js'
import { plantBomb, updateBombs, updateExplosions, checkPowerupPickups, remoteDetonate } from '../game/engine/bombs.js'
import { updateEnemies } from '../game/enemies/enemies.js'
import { initInput, destroyInput, getPlayerInput } from '../game/input/input.js'
import { sfx, playBGM, stopBGM, setBGMFast, toggleMute, getIsMuted } from '../game/audio/audio.js'
import { insertHighScore, saveCampaignProgress } from '../supabase.js'
import { adOnGameOver, adOnLevelClear, adOnQuit, showRewardedAd } from '../admob.js'
import { Capacitor } from '@capacitor/core'
import PhaserGame from '../game/phaser/PhaserGame.jsx'
import MobileControls from '../components/MobileControls.jsx'

const TICK_RATE = 50 // ms per game tick (20 tps)
const DEBUG = false // set to false to hide debug buttons

const PW_COLORS_CSS = {
  extrabomb: '#ffcc00', fireup: '#ff4400', speedup: '#00ff88',
  kick: '#ff8800', remote: '#8888ff', bombpass: '#aabbcc',
  wallpass: '#88ffbb', skull: '#cc0044',
  clock: '#00ccff', mystery: '#ff44ff', gatebomb: '#ffaa00',
  shield: '#44aaff', decoy: '#ff88ff', blockitem: '#8899aa', swap: '#00ffcc',
}

const GAME_HINTS = [
  "Did you know you can earn free coins by watching ads? Go to Settings to earn them!",
  "Stuck on a tough sector? You can use coins to skip it or buy powerful loadouts.",
  "Yellow (+B) powerups give Extra Bombs, while Orange (+F) ones increase Fire Range.",
  "Grab the Green (+S) powerup to boost your movement speed!",
  "Found a Blue (RD) powerup? You can now remote-detonate your bombs anytime!",
  "The Orange (KK) Kick powerup lets you push bombs away by walking into them.",
  "Cyan (+T) Clocks will add precious extra seconds to your mission timer.",
  "Light Blue (BP) powerups give you the ability to walk straight through bombs.",
  "Light Green (WP) Wallpass lets you walk right through destructible walls!",
  "Pink (?!) Mystery powerups give you a random effect... feeling lucky?",
  "You can stack powerups! Collect multiple Fire powerups to maximize your blast radius.",
  "In a pinch? Watch an Ad when you die to get an Extra Life and keep your progress.",
  "Beware of Crimson (☠) Skulls! They will infect you with a random curse for 10 seconds.",
  "You can use the 'First Drop Assurance' loadout to guarantee a specific powerup drop.",
]

export default function ClassicGameScreen({ user, campaign, setCampaign, startingLevel = 1, level: propLevel, loadout, nav }) {
  const initialLevel = propLevel || startingLevel
  const stateRef = useRef(null)
  const loadoutRef = useRef(loadout)
  const tickIntervalRef = useRef(null)
  const levelRef = useRef(initialLevel)
  const [overlay, setOverlay] = useState('loading') // null | 'paused' | 'level_clear' | 'game_over' | 'game_complete' | 'loading'
  const [hint, setHint] = useState('')
  const loadingTimeoutRef = useRef(null)
  const [muted, setMuted] = useState(getIsMuted())
  const [showGuide, setShowGuide] = useState(false)
  const clearLevelTimeoutRef = useRef(null)
  const [skipAdsWatched, setSkipAdsWatched] = useState(0)
  const [skipping, setSkipping] = useState(false)

  // In-game tutorial state
  const [tutorialStep, setTutorialStep] = useState(-1) // -1 = not active
  const tutorialShownRef = useRef(false)

  // Earn coin in pause menu
  const [earningCoinPause, setEarningCoinPause] = useState(false)

  // Rate prompt after milestones
  const [showRatePrompt, setShowRatePrompt] = useState(false)

  // Handle hardware back button
  useEffect(() => {
    const onBack = () => {
      if (!overlay) {
        if (stateRef.current) stateRef.current.status = 'paused'
        setOverlay('paused')
      } else if (overlay === 'paused') {
        if (stateRef.current) stateRef.current.status = 'active'
        setOverlay(null)
      }
    }
    window.addEventListener('hw_back_pressed', onBack)
    return () => window.removeEventListener('hw_back_pressed', onBack)
  }, [overlay])
  const [hudData, setHudData] = useState(null)
  const bombPressedRef = useRef(false)
  const detonatePressedRef = useRef(false)

  const displayName = user?.user_metadata?.display_name || 'PLAYER'

  function loadLevel(level) {
    const { grid, hiddenGateTile, hiddenPowerupTile, hiddenEggTile, powerupType, enemies, playerSpawn, config } = generateLevel(level)
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
    s.hiddenEggTile = hiddenEggTile  // mystery egg tile (50% chance per level)
    s.powerupType = powerupType
    s.enemies = enemies

    // Restore stats from previous level (carry forward powerups)
    const prevPlayer = stateRef.current ? Object.values(stateRef.current.players)[0] : null
    const playerInState = Object.values(s.players)[0]
    const resetPowerups = ['wallpass', 'bombpass']

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
      // First load from level select: try to load saved stats from campaign.
      // We ALWAYS start with 3 lives so players don't get stuck with 1 life on replay,
      // but we do want to load their saved powerups and bomb stats!
      const levelStats = campaign?.levelStats || {}
      const stats = levelStats[level]

      if (stats) {
        playerInState.score = stats.score || 0
        playerInState.lives = 3 // Always 3 lives for fresh level start!
        playerInState.maxBombs = stats.maxBombs || 1
        playerInState.fireRange = stats.fireRange || 1
        playerInState.speed = stats.speed || 8
        playerInState.powerups = (stats.powerups || []).filter(p => !resetPowerups.includes(p))
      } else {
        playerInState.score = 0
        playerInState.lives = 3
        playerInState.maxBombs = 1
        playerInState.fireRange = 1
        playerInState.speed = 8
        playerInState.powerups = []
      }
    }
    playerInState.startX = playerSpawn.x
    playerInState.startY = playerSpawn.y

    // Apply Pre-Game Loadout (Only once)
    if (loadoutRef.current) {
      if (loadoutRef.current.extraLife) {
        playerInState.lives += 1
      }
      if (loadoutRef.current.powerup) {
        s.guaranteedFirstDrop = loadoutRef.current.powerup
      }
    }

    stateRef.current = s

    // Set Loading State
    setOverlay('loading')
    setHint(GAME_HINTS[Math.floor(Math.random() * GAME_HINTS.length)])
    s.status = 'paused' // Pause engine during loading screen
    
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    loadingTimeoutRef.current = setTimeout(() => {
      setOverlay(prev => {
        if (prev === 'loading') {
          if (stateRef.current && stateRef.current.status !== 'game_over' && stateRef.current.status !== 'level_clear') {
            stateRef.current.status = 'active'
          }
          return null
        }
        return prev
      })
    }, 3500)

    // Trigger in-game tutorial for first-time Sector 1 play
    if (level === 1 && !tutorialShownRef.current && !localStorage.getItem('bm_game_tutorial_done')) {
      tutorialShownRef.current = true
      // Start tutorial after loading screen auto-dismisses
      setTimeout(() => {
        if (stateRef.current) stateRef.current.status = 'paused'
        setTutorialStep(0)
      }, 3800)
    }

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
      if ((player.activeBombs || 0) < (player.maxBombs || 1)) {
        plantBomb(state, player.userId)
        sfx.bombPlant()
      }
    }
    bombPressedRef.current = currentBomb

    // Detonate press
    const detonatePressed = keys.detonate
    if (detonatePressed && !detonatePressedRef.current) {
      const hasRemote = player.powerups?.includes('remote')
      if (hasRemote) {
        remoteDetonate(state, player.userId)
      }
    }
    detonatePressedRef.current = detonatePressed

    // Skull timers
    if (player.skullTimer > 0) {
      player.skullTimer--
      if (player.skullTimer <= 0) player.skullEffect = null
    }
    if (player.wallPassTimer > 0) player.wallPassTimer--
    if (player.shieldTimer > 0) player.shieldTimer--

    // Update systems
    const enemiesBefore = (state.enemies || []).filter(e => e.alive).length

    updateSlidingBombs(state.bombs, state.grid, state.players)
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
      player.lives = 0
      player.alive = false
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
        adOnGameOver() // AdMob Trigger: Game over / drone destroyed
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
    const isLowTime = ticks < 600
    const enemyCount = (state.enemies || []).filter(e => e.alive).length
    const powerups = Array.isArray(player.powerups) ? player.powerups.filter(pw => typeof pw === 'string') : []
    
    setHudData(prev => {
      // Abort React re-render if nothing visually significant changed
      if (prev &&
          prev.level === state.level &&
          prev.timerStr === `${m}:${s}` &&
          prev.isLowTime === isLowTime &&
          prev.lives === player.lives &&
          prev.score === player.score &&
          prev.enemyCount === enemyCount &&
          prev.maxBombs === player.maxBombs &&
          prev.fireRange === player.fireRange &&
          prev.speed === player.speed &&
          prev.skullEffect === player.skullEffect &&
          prev.hasRemote === (powerups.includes('remote')) &&
          prev.gateOpen === state.gateVisible &&
          prev.powerupsCount === powerups.length
      ) {
        return prev
      }
      
      return {
        level: state.level || 1,
        timerStr: `${m}:${s}`,
        isLowTime,
        lives: player.lives,
        score: player.score || 0,
        enemyCount,
        maxBombs: player.maxBombs || 1,
        fireRange: player.fireRange || 1,
        speed: player.speed || 1,
        skullEffect: player.skullEffect,
        hasRemote: powerups.includes('remote'),
        gateOpen: state.gateVisible,
        powerupsCount: powerups.length,
        powerups: powerups.map(pw => ({
          name: pw.toUpperCase(),
          color: PW_COLORS_CSS[pw] || '#ffffff',
        })),
      }
    })
  }

  function clearLevel() {
    sfx.levelClear()
    stopBGM()
    setOverlay('level_clear')
    stateRef.current.status = 'cleared'
    adOnLevelClear() // AdMob Trigger: Sector cleared

    const player = stateRef.current ? Object.values(stateRef.current.players)[0] : null
    if (player) {
      const remainingSeconds = Math.floor(Math.max(0, stateRef.current.timer || 0) / 20)
      const timeBonus = remainingSeconds * 10
      player.score = (player.score || 0) + 1000 + timeBonus // level clear + time bonus

      const currentLevel = levelRef.current
      
      // Reward +1 life every 3rd level, max 6
      if (currentLevel % 3 === 0) {
        player.lives = Math.min(6, (player.lives || 3) + 1)
      }

      // Save campaign progress to Supabase Database
      const nextLevel = currentLevel + 1
      const currentCampaign = campaign || {}
      
      let maxLevel = currentCampaign.maxLevel || 1
      if (maxLevel < nextLevel) maxLevel = nextLevel

      const levelStats = currentCampaign.levelStats || {}

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

      const newCampaign = { maxLevel, levelStats }
      setCampaign(newCampaign)
      saveCampaignProgress(newCampaign)
        .catch(err => console.error('Failed to save campaign:', err))
    }

    clearLevelTimeoutRef.current = setTimeout(() => {
      const nextLevel = levelRef.current + 1

      // Milestone-based rating prompt (levels 3, 10, 25 — only once)
      const RATE_MILESTONES = [3, 10, 25]
      const clearedLevel = levelRef.current
      if (Capacitor.isNativePlatform() && RATE_MILESTONES.includes(clearedLevel) && !localStorage.getItem('bm_rate_prompted')) {
        localStorage.setItem('bm_rate_prompted', 'true')
        setShowRatePrompt(true)
        // Don't auto-advance while prompt is showing — handled by prompt dismiss
        return
      }

      if (nextLevel > 50) {
        setOverlay('game_complete')
        saveHighScore()
      } else {
        levelRef.current = nextLevel
        loadoutRef.current = null // Consume before next level
        loadLevel(nextLevel)
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
    loadLevel(initialLevel)
    levelRef.current = initialLevel

    tickIntervalRef.current = setInterval(gameTick, TICK_RATE)

    return () => {
      destroyInput()
      clearInterval(tickIntervalRef.current)
      if (clearLevelTimeoutRef.current) clearTimeout(clearLevelTimeoutRef.current)
      stopBGM()
    }
  }, [initialLevel])

  async function handleSkipWithCoins() {
    if (skipping || (campaign?.coins || 0) < 10) return
    setSkipping(true)
    
    // Deduct coins
    const newCampaign = { ...campaign, coins: (campaign.coins || 0) - 10 }
    let maxL = newCampaign.maxLevel || 1
    if (levelRef.current >= maxL) {
      newCampaign.maxLevel = levelRef.current + 1
    }
    await saveCampaignProgress(newCampaign)
    if (setCampaign) setCampaign(newCampaign)
    
    // Skip to next level
    nav('classic', { level: levelRef.current + 1 })
  }

  async function handleReviveWithAd() {
    if (skipping) return
    setSkipping(true)
    const success = await showRewardedAd()
    if (success) {
      // Revive the player with 1 life and resume the level
      const player = Object.values(stateRef.current.players)[0]
      if (player) {
        player.lives = 1
        player.status = 'alive'
        player.alive = true
        player.x = player.startX
        player.y = player.startY
        player.px = player.startX * 48
        player.py = player.startY * 48
        player.activeBombs = 0
        player.direction = 'down'
        player.shieldTimer = 60 // 3 seconds of invulnerability
        player.skullEffect = null
        player.skullTimer = 0
        stateRef.current.explosions = [] // Fix Fire Flare persistence bug
        if (stateRef.current.timer <= 0) {
          stateRef.current.timer = 1200 // +60 seconds if died from timeout
        }
        stateRef.current.status = 'active'
        setOverlay(null)
      }
    }
    setSkipping(false)
  }

  function handleRestart() {
    if (clearLevelTimeoutRef.current) clearTimeout(clearLevelTimeoutRef.current)
    const currentLevel = levelRef.current
    loadoutRef.current = null // Consume before retry
    loadLevel(currentLevel)
  }

  function handleQuit() {
    saveHighScore()
    stopBGM()
    adOnQuit() // AdMob Trigger: Player quit mid-game or used back button
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

      {/* Controls hint (desktop only) */}
      {!('ontouchstart' in window) && (
        <div style={{
          position: 'absolute', bottom: 8, right: 16,
          fontSize: '7px', color: '#555', zIndex: 20,
          fontFamily: '"Press Start 2P", monospace',
          pointerEvents: 'none',
        }}>
        ← → ↑ ↓ MOVE  ·  SPACE PLASMA CHARGE  ·  ESC PAUSE
        </div>
      )}

      {/* Mobile Touch Controls */}
      {!overlay && <MobileControls hudData={hudData} />}

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
              background: '#ff4400', color: '#fff', border: 'none',
              cursor: 'pointer', borderRadius: 4,
            }}
            onClick={() => {
              const s = stateRef.current
              if (!s) return
              const p = Object.values(s.players)[0]
              if (p) p.fireRange = Math.min(8, p.fireRange + 1)
            }}
          >+ FIRE RANGE</button>
          
          <button
            style={{
              padding: '4px 10px', fontSize: '8px',
              fontFamily: '"Press Start 2P", monospace',
              background: '#40ff40', color: '#111', border: 'none',
              cursor: 'pointer', borderRadius: 4,
            }}
            onClick={() => {
              const s = stateRef.current
              if (!s) return
              const p = Object.values(s.players)[0]
              if (p) p.speed = Math.min(12, p.speed + 1)
            }}
          >+ SPEED</button>

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
              const p = Object.values(s.players)[0]
              if (p) p.maxBombs = Math.min(8, p.maxBombs + 1)
            }}
          >+ MAX BOMBS</button>
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
                    // Reveal egg if hidden here
                    } else if (s.hiddenEggTile && s.hiddenEggTile[0] === x && s.hiddenEggTile[1] === y) {
                      s.grid[y][x] = 0 // EMPTY
                      s.powerupsOnMap.push({ x, y, type: 'egg' })
                      s.hiddenEggTile = null
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
      {overlay === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500,
          background: '#060610',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Animated Text */}
          <div className="text-bm-accent text-pixel text-4xl mb-8 animate-pulse" style={{ textShadow: '0 0 20px rgba(0, 212, 255, 0.8)' }}>
            LOADING SECTOR...
          </div>
          
          {/* Hint Box */}
          <div style={{
             width: '80%', maxWidth: 450,
             background: 'linear-gradient(180deg, rgba(12,12,32,0.95) 0%, rgba(6,6,18,0.95) 100%)',
             border: '1.5px solid rgba(0,212,255,0.3)',
             borderRadius: 16, padding: 24, textAlign: 'center',
             display: 'flex', flexDirection: 'column', gap: 12,
             boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.1) inset',
             animation: 'fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards'
          }}>
             <div style={{ color: '#00d4ff', fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: '0.15em' }}>
               💡 PILOT HINT
             </div>
             <div style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Outfit, sans-serif', fontSize: 16, lineHeight: 1.5, letterSpacing: '0.05em' }}>
               {hint}
             </div>
          </div>
        </div>
      )}

      {overlay === 'paused' && (
        <div className="countdown-overlay" style={{ zIndex: 300, flexDirection: 'column', overflowY: 'auto' }}>
          {/* <h2 className="text-pixel text-bm-accent text-3xl" style={{ marginBottom: 32, textShadow: '0 0 15px rgba(255,165,0,0.8)' }}>
            {showGuide ? '' : 'PAUSED'}
          </h2> */}

          {!showGuide ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '220px', marginBottom: 24 }}>
              <button className="btn-pixel btn-primary w-full py-4" onClick={() => {
                if (stateRef.current) stateRef.current.status = 'active'
                setOverlay(null)
                setShowGuide(false)
              }}>RESUME</button>
              <button className="btn-pixel w-full py-4" onClick={() => setMuted(toggleMute())}>
                SOUND: {muted ? 'OFF 🔇' : 'ON 🔊'}
              </button>
              <button className="btn-pixel w-full py-4" onClick={() => setShowGuide(true)}>
                POWERUP INFO
              </button>
              {/* Earn Coin Button */}
              <button
                className="btn-pixel w-full py-4"
                disabled={earningCoinPause}
                onClick={async () => {
                  if (earningCoinPause) return
                  try {
                    setEarningCoinPause(true)
                    const now = Date.now()
                    const fifteenMins = 15 * 60 * 1000
                    let history = []
                    try { history = JSON.parse(localStorage.getItem('bm_ad_timestamps') || '[]') } catch(e) {}
                    history = history.filter(t => now - t < fifteenMins)
                    if (history.length >= 2) {
                      alert('You have already watched 2 ads recently. Please wait a few minutes!')
                      setEarningCoinPause(false)
                      return
                    }
                    const success = await showRewardedAd()
                    if (success) {
                      const currentCoins = campaign?.coins || 0
                      const newCampaign = { ...campaign, coins: currentCoins + 1 }
                      setCampaign(newCampaign)
                      await saveCampaignProgress(newCampaign)
                      history.push(now)
                      localStorage.setItem('bm_ad_timestamps', JSON.stringify(history))
                      alert('Awesome! You earned 1 Coin. 🪙')
                    }
                  } catch (e) {
                    console.error(e)
                  } finally {
                    setEarningCoinPause(false)
                  }
                }}
                style={{
                  color: earningCoinPause ? 'rgba(0,255,170,0.4)' : '#00ffaa',
                  borderColor: earningCoinPause ? 'rgba(0,255,170,0.15)' : 'rgba(0,255,170,0.4)',
                  background: earningCoinPause ? 'rgba(0,255,170,0.03)' : 'rgba(0,255,170,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span>📺</span> {earningCoinPause ? 'LOADING...' : 'EARN 1 COIN'}
              </button>
              <button className="btn-pixel btn-danger w-full py-4" onClick={() => {
                if (window.confirm("Quit to Main Menu? Progress will be lost.")) {
                  handleQuit()
                }
              }}>MAIN MENU</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '480px' }}>
              <div style={{
                background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '16px',
                width: '90%', fontFamily: '"Press Start 2P", monospace', fontSize: '7px',
                color: '#ccc', lineHeight: '1.8', marginBottom: 24
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <div><span style={{ color: '#f0c040' }}>B</span> Extra Bomb — +1 bomb</div>
                  <div><span style={{ color: '#ff4400' }}>F</span> Fire Up — +1 blast range</div>
                  <div><span style={{ color: '#40ff40' }}>S</span> Speed Up — move faster</div>
                  <div><span style={{ color: '#ff8800' }}>K</span> Kick — push bombs</div>
                  <div><span style={{ color: '#8888ff' }}>R</span> Remote — detonate anytime</div>
                  <div><span style={{ color: '#cccccc' }}>P</span> Bomb Pass — walk thru bombs</div>
                  <div><span style={{ color: '#aaffaa' }}>W</span> Wall Pass — walk thru bricks</div>
                  <div><span style={{ color: '#aa0000' }}>!</span> Skull — random curse (bad!)</div>
                  <div><span style={{ color: '#00ccff' }}>T</span> Clock — +60 sec timer</div>
                  <div><span style={{ color: '#ff00ff' }}>?</span> Mystery — random powerup</div>
                </div>
                <div style={{ marginTop: 12, color: '#888', textAlign: 'center', fontSize: '6px' }}>
                  DESTROY BRICKS TO FIND POWERUPS · FIND THE EXIT GATE · KILL ALL ENEMIES TO OPEN IT
                </div>
              </div>
              <button className="btn-pixel w-full max-w-[220px] py-4" onClick={() => setShowGuide(false)}>
                ← BACK
              </button>
            </div>
          )}
        </div>
      )}

      {overlay === 'level_clear' && (
      <div className="countdown-overlay flex-col gap-4" style={{ zIndex: 300 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #aaccff 0%, #4466ff 40%, #110088 100%)',
            boxShadow: '0 0 30px rgba(80,0,255,0.8)',
            animation: 'pulseGlow 0.8s ease-in-out infinite',
          }} />
          <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 28, fontWeight: 900, color: '#00e87a', letterSpacing: '0.1em' }}>SECTOR CLEAR</h2>
          <p style={{ fontSize: '13px', color: '#ffcc00', fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.1em' }}>
            SCORE: {hudData?.score || 0}
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.15em' }}>
            NEXT SECTOR LOADING...
          </p>
      </div>
      )}

      {overlay === 'game_over' && (
        <div className="countdown-overlay flex flex-row gap-8 items-center justify-center py-4 px-8 w-full h-full" style={{ zIndex: 300, background: 'rgba(0,0,0,0.9)' }}>
          {/* Left Side: Status */}
          <div className="flex flex-col items-center justify-center flex-1 max-w-[280px]">
            <div className="flex-shrink-0 mx-auto" style={{
              width: 56, height: 56, borderRadius: 12,
              background: 'linear-gradient(135deg, #ff2244 0%, #880022 100%)',
              boxShadow: '0 0 30px rgba(255,0,60,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="text-white text-2xl font-bold">✕</span>
            </div>
            
            <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 36, fontWeight: 900, color: '#ff2244', letterSpacing: '0.1em', textAlign: 'center', marginTop: 16 }}>
              MISSION FAILED
            </h2>
            
            <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 16, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center', marginTop: 8 }}>
              <div>SECTOR {hudData?.level || 1}</div>
              <div>FINAL SCORE: {hudData?.score || 0}</div>
            </div>
          </div>
          
          {/* Right Side: Actions */}
          <div className="flex flex-col gap-4 flex-1 w-full max-w-[340px]">
            {/* Primary Actions Grid */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => nav('level_select')}
                className="btn-pixel bg-bm-dark/50 text-gray-400 border border-gray-600 hover:bg-bm-dark py-3 w-full text-[10px]"
              >
                ABORT
              </button>
            </div>

            {/* Advanced Actions */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-3">
              <h3 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', color: '#fff', fontSize: 10, textAlign: 'center', letterSpacing: '0.1em' }}>
                EMERGENCY OPTIONS
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={skipping || (campaign?.coins || 0) < 10}
                  onClick={handleSkipWithCoins}
                  className="btn-pixel bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 disabled:opacity-50 py-2 w-full flex flex-col items-center justify-center gap-1"
                  style={{ lineHeight: 1 }}
                >
                  <span className="text-[8px]">SKIP SECTOR</span>
                  <span style={{ fontSize: 8, color: 'rgba(255,200,0,0.6)' }}>(COST: 10 COINS)</span>
                </button>
                <button
                  disabled={skipping}
                  onClick={handleReviveWithAd}
                  className="btn-pixel bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-50 py-2 w-full flex flex-col items-center justify-center gap-1"
                  style={{ lineHeight: 1 }}
                >
                  <span className="text-[8px]">REVIVE (AD)</span>
                  <span style={{ fontSize: 8, color: 'rgba(0,255,100,0.6)' }}>+1 LIFE</span>
                </button>
              </div>
            </div>
          </div>
          {skipping && <div className="text-center text-xs text-yellow-500 animate-pulse pb-8">Processing...</div>}
        </div>
      )}

      {overlay === 'game_complete' && (
        <div className="countdown-overlay flex-col gap-6" style={{ zIndex: 300 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ffcc44 0%, #ff8800 40%, #882200 100%)',
            boxShadow: '0 0 40px rgba(255,160,0,0.8)',
            animation: 'pulseGlow 1s ease-in-out infinite',
            fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>★</div>
          <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 26, fontWeight: 900, letterSpacing: '0.08em', textAlign: 'center', color: '#ffcc00' }}>
            ALL SECTORS<br/>CONQUERED
          </h2>
          <p style={{ fontSize: '13px', color: '#00d4ff', fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.1em' }}>
            FINAL SCORE: {hudData?.score || 0}
          </p>
          <button className="btn-pixel btn-primary" onClick={handleQuit}>RETURN TO BASE</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Rate App Prompt (milestone-based, once only)
          ═══════════════════════════════════════════════════════ */}
      {showRatePrompt && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 700,
            background: 'rgba(2,2,12,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out forwards',
          }}
        >
          <div
            style={{
              width: '90%', maxWidth: 340,
              background: 'linear-gradient(180deg, rgba(14,14,38,0.97) 0%, rgba(6,6,20,0.97) 100%)',
              border: '1.5px solid rgba(255,204,0,0.3)',
              borderRadius: 24,
              padding: '28px 24px 24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 50px rgba(255,204,0,0.08) inset',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              animation: 'fadeSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            {/* Stars Row */}
            <div style={{ display: 'flex', gap: 6, fontSize: 28 }}>
              {'⭐⭐⭐⭐⭐'.split('').filter(c => c === '⭐').map((_, i) => (
                <span key={i} style={{
                  animation: `fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) ${0.1 + i * 0.08}s both`,
                  filter: 'drop-shadow(0 0 6px rgba(255,204,0,0.5))',
                }}>⭐</span>
              ))}
            </div>

            {/* Title */}
            <h2 style={{
              fontFamily: 'Rajdhani,Outfit,sans-serif',
              fontSize: 22, fontWeight: 900,
              letterSpacing: '0.08em', color: '#ffcc00',
              textAlign: 'center', lineHeight: 1.2,
              textShadow: '0 0 15px rgba(255,204,0,0.4)',
            }}>
              ENJOYING OMEGA ARENA?
            </h2>

            {/* Body */}
            <p style={{
              fontFamily: 'Outfit,sans-serif',
              fontSize: 13, lineHeight: 1.6,
              color: 'rgba(255,255,255,0.65)',
              textAlign: 'center',
            }}>
              Your feedback helps us improve! Take a moment to rate us on the store — it really means a lot. 🙏
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 4 }}>
              <button
                onClick={() => {
                  const appId = 'com.iankit.omegaarena'
                  const platform = Capacitor.getPlatform()
                  let url
                  if (platform === 'android') {
                    url = `market://details?id=${appId}`
                  } else if (platform === 'ios') {
                    url = `https://apps.apple.com/app/idAPPLE_APP_ID?action=write-review`
                  } else {
                    url = `https://play.google.com/store/apps/details?id=${appId}`
                  }
                  window.open(url, '_system')
                  // Dismiss and continue to next level
                  setShowRatePrompt(false)
                  const nextLevel = levelRef.current + 1
                  if (nextLevel > 50) {
                    setOverlay('game_complete')
                    saveHighScore()
                  } else {
                    levelRef.current = nextLevel
                    loadoutRef.current = null
                    loadLevel(nextLevel)
                  }
                }}
                style={{
                  width: '100%',
                  fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 15, fontWeight: 800,
                  letterSpacing: '0.1em', color: '#ffcc00',
                  background: 'rgba(255,204,0,0.12)',
                  border: '1.5px solid rgba(255,204,0,0.4)',
                  padding: '14px', borderRadius: 12, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 0 20px rgba(255,204,0,0.1)',
                }}
                className="hover:bg-yellow-500/25 hover:border-yellow-400"
              >
                ⭐ RATE NOW
              </button>

              <button
                onClick={() => {
                  setShowRatePrompt(false)
                  const nextLevel = levelRef.current + 1
                  if (nextLevel > 50) {
                    setOverlay('game_complete')
                    saveHighScore()
                  } else {
                    levelRef.current = nextLevel
                    loadoutRef.current = null
                    loadLevel(nextLevel)
                  }
                }}
                style={{
                  width: '100%',
                  fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px', borderRadius: 10, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                MAYBE LATER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          In-Game Tutorial Overlay (first Sector 1 play)
          ═══════════════════════════════════════════════════════ */}
      {tutorialStep >= 0 && tutorialStep < GAME_TUTORIAL_STEPS.length && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 600,
            background: 'rgba(2,2,12,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => {
            const nextStep = tutorialStep + 1
            if (nextStep >= GAME_TUTORIAL_STEPS.length) {
              // Tutorial complete
              setTutorialStep(-1)
              localStorage.setItem('bm_game_tutorial_done', 'true')
              if (stateRef.current) stateRef.current.status = 'active'
              setOverlay(null)
            } else {
              setTutorialStep(nextStep)
            }
          }}
        >
          <div
            className="game-tutorial-tooltip"
            key={tutorialStep}
            style={{
              width: '90%', maxWidth: 380,
              background: 'linear-gradient(180deg, rgba(12,12,36,0.97) 0%, rgba(6,6,20,0.97) 100%)',
              border: '1.5px solid rgba(0,212,255,0.3)',
              borderRadius: 20,
              padding: '24px 24px 20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.12) inset',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(100,0,255,0.1))',
                border: '1px solid rgba(0,212,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: '0 0 15px rgba(0,212,255,0.2)',
                flexShrink: 0,
              }}>
                {GAME_TUTORIAL_STEPS[tutorialStep].icon}
              </div>
              <div>
                <div style={{
                  fontFamily: 'Rajdhani,Outfit,sans-serif',
                  fontSize: 18, fontWeight: 800,
                  letterSpacing: '0.1em', color: '#00d4ff',
                }}>
                  {GAME_TUTORIAL_STEPS[tutorialStep].title}
                </div>
                <div style={{
                  fontFamily: 'Outfit,sans-serif',
                  fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)',
                }}>
                  TIP {tutorialStep + 1} OF {GAME_TUTORIAL_STEPS.length}
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{
              fontFamily: 'Outfit,sans-serif',
              fontSize: 14, lineHeight: 1.6,
              color: 'rgba(255,255,255,0.75)',
              marginBottom: 20,
            }}>
              {GAME_TUTORIAL_STEPS[tutorialStep].body}
            </div>

            {/* Progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
              {GAME_TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === tutorialStep ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === tutorialStep
                      ? 'linear-gradient(90deg, #00d4ff, #6644ff)'
                      : i < tutorialStep
                        ? 'rgba(0,212,255,0.4)'
                        : 'rgba(255,255,255,0.1)',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {tutorialStep < GAME_TUTORIAL_STEPS.length - 1 && (
                <button
                  onClick={() => {
                    setTutorialStep(-1)
                    localStorage.setItem('bm_game_tutorial_done', 'true')
                    if (stateRef.current) stateRef.current.status = 'active'
                    setOverlay(null)
                  }}
                  style={{
                    flex: 1,
                    fontFamily: 'Rajdhani,Outfit,sans-serif',
                    fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '10px 16px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  SKIP
                </button>
              )}
              <button
                onClick={() => {
                  const nextStep = tutorialStep + 1
                  if (nextStep >= GAME_TUTORIAL_STEPS.length) {
                    setTutorialStep(-1)
                    localStorage.setItem('bm_game_tutorial_done', 'true')
                    if (stateRef.current) stateRef.current.status = 'active'
                    setOverlay(null)
                  } else {
                    setTutorialStep(nextStep)
                  }
                }}
                style={{
                  flex: tutorialStep === GAME_TUTORIAL_STEPS.length - 1 ? 1 : 2,
                  fontFamily: 'Rajdhani,Outfit,sans-serif',
                  fontSize: 13, fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: tutorialStep === GAME_TUTORIAL_STEPS.length - 1 ? '#00e87a' : '#00d4ff',
                  background: tutorialStep === GAME_TUTORIAL_STEPS.length - 1
                    ? 'rgba(0,232,122,0.1)'
                    : 'rgba(0,212,255,0.08)',
                  border: `1.5px solid ${tutorialStep === GAME_TUTORIAL_STEPS.length - 1 ? 'rgba(0,232,122,0.4)' : 'rgba(0,212,255,0.35)'}`,
                  padding: '10px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tutorialStep === GAME_TUTORIAL_STEPS.length - 1
                    ? '0 0 15px rgba(0,232,122,0.15)'
                    : '0 0 15px rgba(0,212,255,0.1)',
                }}
              >
                {tutorialStep === GAME_TUTORIAL_STEPS.length - 1 ? 'START PLAYING! →' : 'NEXT →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── In-Game Tutorial Steps ──
const GAME_TUTORIAL_STEPS = [
  {
    icon: '🎮',
    title: 'MOVEMENT',
    body: 'Use the joystick (mobile) or arrow keys (desktop) to move your pilot around the arena.',
  },
  {
    icon: '💣',
    title: 'PLANT BOMBS',
    body: 'Tap the bomb button (mobile) or press SPACE (desktop) to plant a plasma charge. Stand back before it explodes!',
  },
  {
    icon: '🧱',
    title: 'DESTROY WALLS',
    body: 'Blast soft walls to reveal hidden power-ups, the exit portal, and mystery eggs!',
  },
  {
    icon: '👾',
    title: 'DEFEAT ENEMIES',
    body: 'Eliminate all enemies in the sector. Once they\'re gone, the exit gate will open.',
  },
  {
    icon: '★',
    title: 'FIND THE EXIT',
    body: 'The exit portal is hidden under a wall. Find it, defeat all enemies, then step into the portal to advance!',
  },
]

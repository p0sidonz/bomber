import { TILE, POWERUP, POWERUP_CHANCE, applyPowerup } from './state.js'
import { getTile } from './physics.js'
import { sfx } from '../audio/audio.js'

let bombIdCounter = 0
let explosionIdCounter = 0

// ─── PLANT BOMB ──────────────────────────────────────────────────────────────
export function plantBomb(state, userId) {
  const player = state.players[userId]
  if (!player || !player.alive) return

  // Skull auto-bomb check
  if (player.activeBombs >= player.maxBombs) return

  // Don't plant if bomb already at this tile
  const existing = state.bombs.find(b => b.x === player.x && b.y === player.y)
  if (existing) return

  const bomb = {
    id: `b${++bombIdCounter}`,
    x: player.x,
    y: player.y,
    px: player.x * 48,
    py: player.y * 48,
    ownerId: userId,
    fuseMs: 3000,
    fuseTicks: 60, // 3s at 20 ticks/sec
    range: player.fireRange,
    remote: player.powerups?.includes('remote'),
    sliding: false,
    slideDir: null,
    // passable: owner can still walk through this tile until they leave it.
    // Set to false once the owner's tile changes — see gameTick cleanup.
    passable: true,
  }

  state.bombs.push(bomb)
  player.activeBombs = (player.activeBombs || 0) + 1
}

// ─── UPDATE BOMBS (fuse countdown) ───────────────────────────────────────────
export function updateBombs(state) {
  const toDetonate = []

  for (const bomb of state.bombs) {
    if (bomb.remote) continue // Remote bombs only explode on command
    bomb.fuseTicks--
    if (bomb.fuseTicks <= 0) {
      toDetonate.push(bomb.id)
    }
  }

  // Skull autobomb
  for (const [uid, player] of Object.entries(state.players)) {
    if (player.skullEffect === 'autobomb' && Math.random() < 0.05) {
      plantBomb(state, uid)
    }
  }

  for (const id of toDetonate) {
    detonateBomb(state, id)
  }
}

// ─── DETONATE BOMB ────────────────────────────────────────────────────────────
export function detonateBomb(state, bombId) {
  const bombIdx = state.bombs.findIndex(b => b.id === bombId)
  if (bombIdx === -1) return

  // Play explosion sound
  try { sfx.explosion() } catch (_) {}

  const bomb = state.bombs[bombIdx]
  state.bombs.splice(bombIdx, 1)

  // Free up owner's bomb count
  const owner = state.players[bomb.ownerId]
  if (owner) owner.activeBombs = Math.max(0, (owner.activeBombs || 1) - 1)

  // Calculate explosion tiles
  const explosionTiles = calcExplosionTiles(state, bomb)

  // Create explosion
  const explosion = {
    id: `e${++explosionIdCounter}`,
    tiles: explosionTiles.map(t => t.pos),
    centerX: bomb.x,
    centerY: bomb.y,
    dieAt: Date.now() + 600,
    dieTick: state.tick + 12, // 0.6s at 20tps
    ownerId: bomb.ownerId,
    frame: 0,
  }
  state.explosions.push(explosion)

  // Destroy soft blocks + spawn powerups
  for (const { pos, hit } of explosionTiles) {
    if (hit === 'soft') {
      const [ex, ey] = pos
      state.grid[ey][ex] = TILE.EMPTY

      // Reveal gate if hidden here
      if (state.hiddenGateTile && state.hiddenGateTile[0] === ex && state.hiddenGateTile[1] === ey) {
        state.grid[ey][ex] = TILE.GATE
        state.gateVisible = true
        state.hiddenGateTile = null
      }

      // Reveal powerup if hidden here (Singleplayer deterministic)
      if (state.mode === 'singleplayer') {
        if (state.hiddenPowerupTile && state.hiddenPowerupTile[0] === ex && state.hiddenPowerupTile[1] === ey) {
          if (state.grid[ey][ex] !== TILE.GATE) {
            state.powerupsOnMap.push({ x: ex, y: ey, type: state.powerupType || 'extrabomb' })
            state.hiddenPowerupTile = null
          }
        }
        if (state.hiddenEggTile && state.hiddenEggTile[0] === ex && state.hiddenEggTile[1] === ey) {
          if (state.grid[ey][ex] !== TILE.GATE) {
            state.powerupsOnMap.push({ x: ex, y: ey, type: 'egg' })
            state.hiddenEggTile = null
          }
        }
      } else {
        // Multiplayer: fewer powerups, only core types
        if (Math.random() < 0.18) {
          const pwTypes = [
            POWERUP.EXTRA_BOMB, POWERUP.FIRE_UP, POWERUP.SPEED_UP,
            POWERUP.KICK, POWERUP.FULL_FIRE,
          ]
          const type = pwTypes[Math.floor(Math.random() * pwTypes.length)]
          // Don't spawn powerup on gate tile
          if (state.grid[ey][ex] !== TILE.GATE) {
            state.powerupsOnMap.push({ x: ex, y: ey, type })
          }
        }
      }
    }

    // Portal gates: bomb-open them
    const [ex, ey] = pos
    const gate = state.gates?.find(g => g.x === ex && g.y === ey && !g.open)
    if (gate) {
      gate.open = true
      gate.openTimer = 300 // 15s at 20tps
    }
  }

  // Chain reaction: detonate any bombs in explosion tiles
  const explosionPositions = new Set(explosionTiles.map(t => `${t.pos[0]},${t.pos[1]}`))
  const chainBombs = state.bombs.filter(b => explosionPositions.has(`${b.x},${b.y}`))
  for (const cb of chainBombs) {
    detonateBomb(state, cb.id)
  }

  // Hit players
  for (const [uid, player] of Object.entries(state.players)) {
    if (!player.alive) continue
    if (player.shieldTimer > 0) continue
    const hit = explosionPositions.has(`${player.x},${player.y}`)
    if (hit) {
      killPlayer(state, uid, bomb.ownerId)
    }
  }

  // Hit enemies — use pixel position for accuracy during smooth movement
  for (const enemy of state.enemies || []) {
    if (!enemy.alive) continue
    // Derive tile from visual pixel position (center of sprite)
    const etx = Math.floor((enemy.px + 24) / 48)
    const ety = Math.floor((enemy.py + 24) / 48)
    if (explosionPositions.has(`${etx},${ety}`)) {
      damageEnemy(state, enemy, bomb.ownerId)
    }
  }

  // Destroy powerups caught in explosion
  if (state.powerupsOnMap) {
    state.powerupsOnMap = state.powerupsOnMap.filter(p => {
      const hit = explosionPositions.has(`${p.x},${p.y}`)
      if (hit) {
        if (p.type === 'egg') crackEgg(state, p.x, p.y)
        return false // remove it
      }
      return true
    })
  }
}

function crackEgg(state, x, y) {
  const event = Math.random()
  if (event < 0.33) {
    // Jackpot: +1 Life
    for (const player of Object.values(state.players)) {
      if (player.alive) player.lives = Math.min(6, (player.lives || 3) + 1)
    }
  } else if (event < 0.66) {
    // Treasure: +2000 Points
    for (const player of Object.values(state.players)) {
      if (player.alive) player.score = (player.score || 0) + 2000
    }
  } else {
    // Ambush: 3 MiniSlimes
    state.enemies = state.enemies || []
    for (let i = 0; i < 3; i++) {
      state.enemies.push({
        id: `egg-slime-${state.tick}-${i}`,
        type: 'MiniSlime',
        x: x, y: y,
        px: x * 48 + (Math.random() * 20 - 10), 
        py: y * 48 + (Math.random() * 20 - 10),
        alive: true, speed: 4, ai: 'chase_loose', hp: 1, points: 500,
        passAll: false, passWalls: false
      })
    }
  }
}

// ─── EXPLOSION TILE CALCULATION ───────────────────────────────────────────────
function calcExplosionTiles(state, bomb) {
  const { grid } = state
  const tiles = [{ pos: [bomb.x, bomb.y], hit: 'center' }]
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]]

  for (const [dx, dy] of dirs) {
    for (let i = 1; i <= bomb.range; i++) {
      const nx = bomb.x + dx * i
      const ny = bomb.y + dy * i
      const tile = getTile(grid, nx, ny)

      if (tile === TILE.SOLID) break

      if (tile === TILE.SOFT) {
        tiles.push({ pos: [nx, ny], hit: 'soft' })
        break // stops here
      }

      tiles.push({ pos: [nx, ny], hit: 'empty' })
    }
  }

  return tiles
}

// ─── KILL PLAYER ─────────────────────────────────────────────────────────────
export function killPlayer(state, userId, killerId) {
  const player = state.players[userId]
  if (!player || !player.alive) return

  // Play death sound
  try { sfx.playerDeath() } catch (_) {}

  if (state.mode === 'singleplayer') {
    player.lives--
    if (player.lives <= 0) {
      player.alive = false
    } else {
      // Respawn at start
      player.px = player.startX * 48
      player.py = player.startY * 48
      player.x = player.startX
      player.y = player.startY
      player.powerups = []
      player.speed = 8
      player.activeBombs = 0
    }
  } else {
    player.alive = false
  }

  // Credit kill
  if (killerId && killerId !== userId) {
    const killer = state.players[killerId]
    if (killer) {
      killer.kills = (killer.kills || 0) + 1
      state.scores[killerId] = (state.scores[killerId] || 0) + 1
    }
  }

  // Multiplayer: 3 lives with respawn
  if (state.mode === 'multiplayer') {
    player.lives = (player.lives || 3) - 1
    if (player.lives > 0) {
      // Set respawn timer (2 seconds = 40 ticks at 20tps)
      player.respawnTimer = 40
    }
  }
}

// ─── DAMAGE ENEMY ─────────────────────────────────────────────────────────────
export function damageEnemy(state, enemy, killerId) {
  enemy.hp = (enemy.hp || 1) - 1
  if (enemy.hp <= 0) {
    enemy.alive = false
    enemy.deathFrame = 0
    try { sfx.enemyDeath() } catch (_) {}

    // Score for classic mode
    if (killerId && state.players[killerId]) {
      const points = enemy.points || 100
      state.players[killerId].score = (state.players[killerId].score || 0) + points
    }

    // Coin enemy drops powerup
    if (enemy.type === 'Coin' || enemy.dropsPowerup) {
      // Find powerup types for single-player
      const pwTypes = [POWERUP.EXTRA_BOMB, POWERUP.FIRE_UP, POWERUP.SPEED_UP]
      state.powerupsOnMap.push({
        x: enemy.x,
        y: enemy.y,
        type: pwTypes[Math.floor(Math.random() * pwTypes.length)],
      })
    }

    // Slime splitting logic
    if (enemy.splits) {
      // Create two MiniSlimes slightly offset from the parent
      const newEnemies = [
        { offsetX: -16, offsetY: -16, suffix: 'a' },
        { offsetX: 16, offsetY: 16, suffix: 'b' }
      ]
      
      for (const ne of newEnemies) {
        state.enemies.push({
          id: `${enemy.id}-split-${ne.suffix}`,
          type: 'MiniSlime',
          x: enemy.x,
          y: enemy.y,
          px: enemy.px + ne.offsetX,
          py: enemy.py + ne.offsetY,
          alive: true,
          speed: 4,
          ai: 'chase_loose',
          hp: 1,
          points: 500,
          passAll: false,
          passWalls: false
        })
      }
    }
  } else {
    enemy.hitFlash = 6 // flash for 6 frames
  }
}

// ─── UPDATE EXPLOSIONS ────────────────────────────────────────────────────────
export function updateExplosions(state) {
  state.explosions = state.explosions.filter(e => {
    e.frame++
    return state.tick < e.dieTick
  })

  // Continuously check if enemies/players are standing in active explosions
  for (const exp of state.explosions) {
    if (!exp._hitSet) exp._hitSet = new Set()
    const expTiles = new Set(exp.tiles.map(t => `${t[0]},${t[1]}`))

    // Damage enemies in explosion tiles (once per explosion)
    for (const enemy of state.enemies || []) {
      if (!enemy.alive || exp._hitSet.has(enemy.id)) continue
      const etx = Math.floor((enemy.px + 24) / 48)
      const ety = Math.floor((enemy.py + 24) / 48)
      if (expTiles.has(`${etx},${ety}`)) {
        exp._hitSet.add(enemy.id)
        damageEnemy(state, enemy, exp.ownerId)
      }
    }

    // Damage players in explosion tiles (once per explosion)
    for (const [uid, player] of Object.entries(state.players)) {
      if (!player.alive || player.shieldTimer > 0 || exp._hitSet.has(uid)) continue
      if (expTiles.has(`${player.x},${player.y}`)) {
        exp._hitSet.add(uid)
        killPlayer(state, uid, exp.ownerId)
      }
    }
  }
}

// ─── CHECK POWERUP PICKUPS ────────────────────────────────────────────────────
export function checkPowerupPickups(state) {
  for (const [uid, player] of Object.entries(state.players)) {
    if (!player.alive) continue
    const idx = state.powerupsOnMap.findIndex(p => p.x === player.x && p.y === player.y)
    if (idx !== -1) {
      const pw = state.powerupsOnMap[idx]
      state.powerupsOnMap.splice(idx, 1)
      const result = applyPowerup(player, pw.type)
      if (result?.clockBonus) state.timer = Math.min(state.timer + 1200, 6000) // +60s in ticks
      // Float label
      state.floatLabels.push({
        id: `fl${Date.now()}`,
        x: player.x,
        y: player.y,
        text: pw.type.toUpperCase(),
        timer: 40,
        color: pw.type === POWERUP.SKULL ? '#e03040' : '#30c060',
      })
    }
  }
  // Clean up labels
  state.floatLabels = (state.floatLabels || []).filter(l => {
    l.timer--
    return l.timer > 0
  })
}

// ─── UPDATE PORTAL GATE TIMERS ────────────────────────────────────────────────
export function updateGates(state) {
  for (const gate of state.gates || []) {
    if (gate.open && gate.openTimer > 0) {
      gate.openTimer--
      if (gate.openTimer <= 0) {
        gate.open = false
        // Push players out
        for (const player of Object.values(state.players)) {
          if (player.x === gate.x && player.y === gate.y) {
            // Push to entry side
            player.x = gate.entryExitX || gate.x
            player.y = gate.entryExitY || gate.y + 1
            player.px = player.x * 48
            player.py = player.y * 48
          }
        }
      }
    }
  }
}

// ─── REMOTE DETONATE ─────────────────────────────────────────────────────────
export function remoteDetonate(state, userId) {
  const myBombs = state.bombs.filter(b => b.ownerId === userId && b.remote)
  for (const b of myBombs) {
    detonateBomb(state, b.id)
  }
}

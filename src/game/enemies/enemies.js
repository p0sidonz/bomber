import { TILE } from '../engine/state.js'
import { getTile } from '../engine/physics.js'
import { killPlayer } from '../engine/bombs.js'

// ─── ENEMY AI UPDATE ─────────────────────────────────────────────────────────
export function updateEnemies(state) {
  const { grid, players, bombs, enemies } = state
  if (!enemies) return

  const playerList = Object.values(players).filter(p => p.alive)
  const nearestPlayer = (ex, ey) => {
    let best = null, bestDist = Infinity
    for (const p of playerList) {
      const d = Math.abs(p.x - ex) + Math.abs(p.y - ey)
      if (d < bestDist) { bestDist = d; best = p }
    }
    return best
  }

  for (const enemy of enemies) {
    if (!enemy.alive) {
      // Death animation
      enemy.deathFrame = (enemy.deathFrame || 0) + 1
      continue
    }

    // ── EVERY TICK: timers & animation ──────────────────────────────────

    // Hurry: speed increases over time
    if (enemy.speedsUp) {
      enemy.speedUpTimer = (enemy.speedUpTimer || 0) + 1
      if (enemy.speedUpTimer >= 200) {
        enemy.speed = Math.min(4, enemy.speed + 1)
        enemy.speedUpTimer = 0
      }
    }

    // Ghost: invisibility cycle
    if (enemy.invisible) {
      enemy.invisTimer = (enemy.invisTimer || 0) + 1
      const period = enemy.invisCycle || 100
      enemy.isInvisible = (enemy.invisTimer % period) < (period / 3)
    }

    // Hit flash
    if (enemy.hitFlash > 0) enemy.hitFlash--

    // Animation frame (runs every tick for smooth walking)
    enemy.frameTimer = (enemy.frameTimer || 0) + 1
    if (enemy.frameTimer >= 6) {
      enemy.frame = (enemy.frame + 1) % 2
      enemy.frameTimer = 0
    }

    // ── AI DECISION (periodic based on speed) ──────────────────────────
    // Only fire AI when smooth movement is complete (enemy has arrived at tile)
    const atTarget = Math.abs(enemy.px - enemy.x * 48) < 2 && Math.abs(enemy.py - enemy.y * 48) < 2
    const moveInterval = Math.max(1, Math.round(40 / (enemy.speed || 2)))
    enemy.moveTimer = (enemy.moveTimer || 0) + 1
    if (enemy.moveTimer >= moveInterval && atTarget) {
      enemy.moveTimer = 0

      const target = nearestPlayer(enemy.x, enemy.y)
      let nextDir = chooseDir(enemy, state, target)

      const dirs = { 
        up: [0,-1], down: [0,1], left: [-1,0], right: [1,0],
        jump_up: [0,-2], jump_down: [0,2], jump_left: [-2,0], jump_right: [2,0]
      }
      if (nextDir && dirs[nextDir]) {
        const [dx, dy] = dirs[nextDir]
        const nx = enemy.x + dx
        const ny = enemy.y + dy
        if (canEnemyMove(enemy, grid, nx, ny, enemies, bombs)) {
          enemy.x = nx
          enemy.y = ny
          // px/py NOT snapped — smooth interpolation below handles it
          enemy.dir = nextDir
        } else {
          const randomDir = pickRandomDir(enemy, grid, enemies, bombs)
          if (randomDir) {
            const [rdx, rdy] = dirs[randomDir]
            enemy.x = enemy.x + rdx
            enemy.y = enemy.y + rdy
            enemy.dir = randomDir
          }
        }
      }

      // Smoky: leave fire trail
      if (enemy.leavesFire && Math.random() < 0.1) {
        state.explosions.push({
          id: `smoky-${Date.now()}-${enemy.id}`,
          tiles: [[enemy.x, enemy.y]],
          dieTick: state.tick + 60,
          frame: 0,
          ownerId: null,
          isFire: true,
        })
      }

      // Blaze: detonate nearby bombs early
      if (enemy.ai === 'target_bombs') {
        const nearBomb = (state.bombs || []).find(b => Math.abs(b.x - enemy.x) + Math.abs(b.y - enemy.y) <= 2)
        if (nearBomb) nearBomb.fuseTicks = 1
      }
      
      // Mechanic: Leaves Fire Trail
      if (enemy.leavesFire && Math.random() < 0.25) {
        state.explosions = state.explosions || []
        state.explosions.push({
          x: enemy.x, y: enemy.y,
          frame: 0, dieTick: state.tick + 10,
          tiles: [{ pos: [enemy.x, enemy.y], hit: 'empty' }]
        })
      }
      
      // Mechanic: Plants Bombs
      if (enemy.plantsBombs && Math.random() < 0.1) {
        const hasBomb = (state.bombs || []).some(b => b.x === enemy.x && b.y === enemy.y)
        if (!hasBomb) {
          state.bombs = state.bombs || []
          state.bombs.push({
            id: `ebomb-${state.tick}-${enemy.id}`,
            x: enemy.x, y: enemy.y,
            ownerId: 'enemy',
            fireRange: 2,
            fuseTicks: 60, // 3 seconds
            plantedTick: state.tick
          })
        }
      }
    }

    // ── EVERY TICK: check if destination tile became blocked by a bomb ──
    // If a bomb was placed on the enemy's target tile after it committed to moving there,
    // revert the enemy to its current pixel-position tile so it doesn't walk through the bomb.
    if (!enemy.passAll) {
      const hasBombOnTarget = bombs && bombs.some(b => b.x === enemy.x && b.y === enemy.y)
      if (hasBombOnTarget) {
        // Snap back to the tile the enemy is currently visually on
        const currentTileX = Math.round(enemy.px / 48)
        const currentTileY = Math.round(enemy.py / 48)
        // Only revert if the enemy hasn't already arrived at the bomb tile
        if (currentTileX !== enemy.x || currentTileY !== enemy.y) {
          enemy.x = currentTileX
          enemy.y = currentTileY
        }
      }
    }

    // ── EVERY TICK: smooth pixel movement ──────────────────────────────
    // Gradually move px/py toward the tile position for smooth visual movement
    const targetPx = enemy.x * 48
    const targetPy = enemy.y * 48
    const currentMoveInterval = Math.max(1, Math.round(40 / (enemy.speed || 2)))
    const moveSpeed = 48 / currentMoveInterval
    const ddx = targetPx - enemy.px
    const ddy = targetPy - enemy.py
    if (Math.abs(ddx) > 0.5) enemy.px += Math.sign(ddx) * Math.min(Math.abs(ddx), moveSpeed)
    else enemy.px = targetPx
    if (Math.abs(ddy) > 0.5) enemy.py += Math.sign(ddy) * Math.min(Math.abs(ddy), moveSpeed)
    else enemy.py = targetPy

    // ── EVERY TICK: collision check (pixel-based, must be touching) ────
    for (const player of playerList) {
      if (player.shieldTimer > 0) continue
      // Use pixel positions so collision only triggers when sprites visually overlap
      const dx = Math.abs(enemy.px - player.px)
      const dy = Math.abs(enemy.py - player.py)
      if (dx < 20 && dy < 20) {
        player._hitByEnemy = enemy.id
      }
    }
  }

  // Apply enemy collision deaths (after loop)
  for (const player of playerList) {
    if (player._hitByEnemy) {
      killPlayer(state, player.userId, null)
      player._hitByEnemy = null
    }
  }
}

function canEnemyMove(enemy, grid, nx, ny, enemies, bombs) {
  const tile = getTile(grid, nx, ny)
  if (tile === TILE.SOLID) return false
  if (tile === TILE.SOFT && !enemy.passWalls && !enemy.passAll) return false
  // Enemies cannot walk through bombs unless they have passAll
  if (bombs && bombs.some(b => b.x === nx && b.y === ny)) {
    if (!enemy.passAll) return false
  }
  return true
}

function chooseDir(enemy, state, target) {
  const bombs = state.bombs || []
  switch (enemy.ai) {
    case 'random': return pickRandomDir(enemy, state.grid, state.enemies, bombs)
    case 'chase_loose': return chaseLoose(enemy, target, state.grid, state.enemies, bombs)
    case 'turn_toward': return turnToward(enemy, target, state.grid, state.enemies, bombs)
    case 'astar': return astar(enemy, target, state.grid, state.enemies, bombs)
    case 'wall_follower': return wallFollow(enemy, state.grid, state.enemies, bombs)
    case 'wall_hugger': return wallHug(enemy, state.grid, state.enemies, bombs)
    case 'mimic': return mimicPlayer(enemy, state)
    case 'boss': return bossAI(enemy, state, target)
    case 'target_bombs': return chaseLoose(enemy, (state.bombs || [])[0] || target, state.grid, state.enemies, bombs)
    case 'charger': return chargerAI(enemy, state, target)
    case 'hopper': return hopperAI(enemy, state, target)
    case 'dragon': return dragonAI(enemy, state, target)
    default: return pickRandomDir(enemy, state.grid, state.enemies, bombs)
  }
}

const ALL_DIRS = ['up', 'down', 'left', 'right']

function pickRandomDir(enemy, grid, enemies, bombs) {
  const dirs = ALL_DIRS.filter(d => {
    const [dx, dy] = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[d]
    return canEnemyMove(enemy, grid, enemy.x + dx, enemy.y + dy, enemies, bombs)
  })
  if (dirs.length === 0) return null
  // Prefer current direction
  if (dirs.includes(enemy.dir) && Math.random() < 0.7) return enemy.dir
  return dirs[Math.floor(Math.random() * dirs.length)]
}

function chaseLoose(enemy, target, grid, enemies, bombs) {
  if (!target) return null
  // 50% chance to move toward player
  if (Math.random() < 0.5) {
    return turnToward(enemy, target, grid, enemies, bombs)
  }
  return null // random fallback
}

function turnToward(enemy, target, grid, enemies, bombs) {
  if (!target) return null
  const dx = target.x - enemy.x
  const dy = target.y - enemy.y
  
  const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }
  const primary = Math.abs(dx) > Math.abs(dy) 
    ? (dx > 0 ? 'right' : 'left') 
    : (dy > 0 ? 'down' : 'up')
    
  const secondary = Math.abs(dx) > Math.abs(dy)
    ? (dy > 0 ? 'down' : 'up')
    : (dx > 0 ? 'right' : 'left')

  // Try primary direction
  const [pdx, pdy] = dirs[primary]
  if (canEnemyMove(enemy, grid, enemy.x + pdx, enemy.y + pdy, enemies, bombs)) {
    return primary
  }
  
  // Try secondary direction if primary is blocked
  const [sdx, sdy] = dirs[secondary]
  if (canEnemyMove(enemy, grid, enemy.x + sdx, enemy.y + sdy, enemies, bombs)) {
    return secondary
  }

  // If both direct paths are blocked, return null to fall back to random wander
  return null
}

function astar(enemy, target, grid, enemies, bombs) {
  if (!target) return null
  // Simple greedy best-first (approximation of A*)
  const dx = target.x - enemy.x
  const dy = target.y - enemy.y
  const candidates = []
  if (dx > 0) candidates.push('right')
  if (dx < 0) candidates.push('left')
  if (dy > 0) candidates.push('down')
  if (dy < 0) candidates.push('up')
  const dirs = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }
  for (const d of candidates) {
    const [ddx, ddy] = dirs[d]
    if (canEnemyMove(enemy, grid, enemy.x + ddx, enemy.y + ddy, enemies, bombs)) return d
  }
  return null
}

function wallFollow(enemy, grid, enemies, bombs) {
  // Wall follower: keep wall on left
  const order = {
    right: ['down','right','up','left'],
    down:  ['left','down','right','up'],
    left:  ['up','left','down','right'],
    up:    ['right','up','left','down'],
  }
  const dirs = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }
  const seq = order[enemy.dir] || order.right
  // Random reversal
  if (Math.random() < 0.05) return seq[seq.length - 1]
  for (const d of seq) {
    const [dx, dy] = dirs[d]
    if (canEnemyMove(enemy, grid, enemy.x + dx, enemy.y + dy, enemies, bombs)) return d
  }
  return null
}

function wallHug(enemy, grid, enemies, bombs) {
  // Stay close to walls
  const dirs = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }
  const candidates = ALL_DIRS.filter(d => {
    const [dx, dy] = dirs[d]
    return canEnemyMove(enemy, grid, enemy.x + dx, enemy.y + dy, enemies, bombs)
  })
  // Prefer dirs adjacent to walls
  const withWalls = candidates.filter(d => {
    const [dx, dy] = dirs[d]
    const nx = enemy.x + dx, ny = enemy.y + dy
    return ALL_DIRS.some(d2 => {
      const [dx2, dy2] = dirs[d2]
      const t = getTile(grid, nx + dx2, ny + dy2)
      return t === TILE.SOLID || t === TILE.SOFT
    })
  })
  const pool = withWalls.length > 0 ? withWalls : candidates
  return pool[Math.floor(Math.random() * pool.length)] || null
}

function mimicPlayer(enemy, state) {
  // Mirror last recorded player moves
  if (!enemy.mimicBuffer || enemy.mimicBuffer.length === 0) return null
  return enemy.mimicBuffer[0]
}

function bossAI(enemy, state, target) {
  // Boss: occasionally plant bombs, chase player
  if (Math.random() < 0.02) {
    // Plant bomb at current position (handled in enemy update)
    enemy.wantsToPlantBomb = true
  }
  return turnToward(enemy, target, state.grid, state.enemies, state.bombs)
}

function chargerAI(enemy, state, target) {
  if (!target) return null
  
  // If already charging, keep charging until hit wall
  if (enemy.isCharging) {
    const [dx, dy] = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[enemy.dir] || [0,0]
    if (dx !== 0 || dy !== 0) {
      if (canEnemyMove(enemy, state.grid, enemy.x + dx, enemy.y + dy, state.enemies, state.bombs)) {
        return enemy.dir
      }
    }
    // Hit a wall! Stop charging, stun for a sec
    enemy.isCharging = false
    enemy.speed = 1
    return null // stop moving this tick
  }

  // Check line of sight
  if (enemy.x === target.x) {
    const dy = Math.sign(target.y - enemy.y)
    let clear = true
    for (let y = enemy.y + dy; y !== target.y; y += dy) {
      if (!canEnemyMove(enemy, state.grid, enemy.x, y, state.enemies, state.bombs)) clear = false
    }
    if (clear) {
      enemy.isCharging = true
      enemy.speed = 10
      return dy > 0 ? 'down' : 'up'
    }
  } else if (enemy.y === target.y) {
    const dx = Math.sign(target.x - enemy.x)
    let clear = true
    for (let x = enemy.x + dx; x !== target.x; x += dx) {
      if (!canEnemyMove(enemy, state.grid, x, enemy.y, state.enemies, state.bombs)) clear = false
    }
    if (clear) {
      enemy.isCharging = true
      enemy.speed = 10
      return dx > 0 ? 'right' : 'left'
    }
  }

  // Otherwise, wander slowly
  enemy.speed = 1
  return pickRandomDir(enemy, state.grid, state.enemies, state.bombs)
}

function hopperAI(enemy, state, target) {
  if (!target) return null
  
  const dx = target.x - enemy.x
  const dy = target.y - enemy.y
  
  const dirsList = ['up', 'down', 'left', 'right']
  const prefs = []
  if (Math.abs(dx) > Math.abs(dy)) {
    prefs.push(dx > 0 ? 'right' : 'left')
    prefs.push(dy > 0 ? 'down' : 'up')
  } else {
    prefs.push(dy > 0 ? 'down' : 'up')
    prefs.push(dx > 0 ? 'right' : 'left')
  }

  const dirsMap = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }
  
  for (const d of prefs) {
    const [vx, vy] = dirsMap[d]
    // Can we move normally?
    if (canEnemyMove(enemy, state.grid, enemy.x + vx, enemy.y + vy, state.enemies, state.bombs)) {
      return d
    }
    // Blocked! Is it a soft block (2)?
    if (state.grid[enemy.y + vy] && state.grid[enemy.y + vy][enemy.x + vx] === 2) {
      // Can we land on the other side?
      if (canEnemyMove(enemy, state.grid, enemy.x + vx * 2, enemy.y + vy * 2, state.enemies, state.bombs)) {
        return 'jump_' + d
      }
    }
  }

  return pickRandomDir(enemy, state.grid, state.enemies, state.bombs)
}

function dragonAI(enemy, state, target) {
  if (!target) return null
  
  const dx = Math.sign(target.x - enemy.x)
  const dy = Math.sign(target.y - enemy.y)
  
  if ((dx === 0 || dy === 0) && (dx !== 0 || dy !== 0)) {
    // Check line of sight
    let clear = true
    for (let i = 1; i <= Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y)); i++) {
      const checkX = enemy.x + dx * i
      const checkY = enemy.y + dy * i
      if (state.grid[checkY] && state.grid[checkY][checkX] === 1) { // 1 = SOLID
        clear = false; break
      }
    }
    if (clear) {
      enemy.fireTimer = (enemy.fireTimer || 0) + 1
      if (enemy.fireTimer > 30) {
        enemy.fireTimer = 0
        state.explosions = state.explosions || []
        const tiles = []
        for(let i = 1; i <= 6; i++) {
          const fx = enemy.x + dx * i
          const fy = enemy.y + dy * i
          if (state.grid[fy] && state.grid[fy][fx] === 1) break // Stop fire at walls
          tiles.push({ pos: [fx, fy], hit: i === 6 ? 'end' : 'mid' })
          if (state.grid[fy] && state.grid[fy][fx] === 2) {
            tiles.push({ pos: [fx, fy], hit: 'end' })
            break // Stop fire after hitting soft block
          }
        }
        if (tiles.length > 0) {
          state.explosions.push({
            x: enemy.x, y: enemy.y,
            frame: 0, dieTick: state.tick + 15,
            tiles
          })
        }
      }
      return null // Don't move while tracking/firing
    }
  }

  // Not in LOS, wander towards player slowly
  return turnToward(enemy, target, state.grid, state.enemies, state.bombs)
}

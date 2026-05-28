import { TILE } from '../engine/state.js'

// Singleplayer maps are wide for camera-follow gameplay
export const SP_COLS = 30
export const SP_ROWS = 11
// Multiplayer maps stay compact for arena gameplay
export const MP_COLS = 15
export const MP_ROWS = 13
// Backwards-compatible aliases (use grid dimensions from state where possible)
export const COLS = SP_COLS
export const ROWS = SP_ROWS

// ─── LEVEL CONFIGS ────────────────────────────────────────────────────────────
// Each level defines which enemies spawn, how many, and soft block density
export const LEVEL_CONFIGS = Array.from({ length: 50 }, (_, i) => {
  const level = i + 1
  // Enemy count: 8 at level 1, scaling to 14 at level 50
  const enemyCount = Math.min(14, Math.max(8, 8 + Math.floor((level - 1) / 7)))
  let enemies = []
  // Progressive wall density: 25% at level 1 → 60% at level 50
  const softDensity = Math.round((0.25 + (level - 1) * 0.0071) * 100) / 100

  const enemyProgression = [
    'Ballom', 'Oneal', 'Dahl', 'Minvo', 'Doria', 'Ovapi', 'Pass', 'Nail',
    'Zael', 'Coin', 'Hurry', 'Rocky', 'Smoky', 'Pontan', 'Skuller', 'Ghost', 'Blaze', 'Titan', 'Mimic'
  ]
  const typesAvailable = Math.min(enemyProgression.length, level)
  const pool = enemyProgression.slice(0, typesAvailable)
  enemies = pickEnemies(pool, enemyCount)

  // Every 10th level: replace last enemy with BossBomb (stays within count)
  if (level % 10 === 0) enemies[enemies.length - 1] = { type: 'BossBomb', hp: 5 }

  return { level, enemies, softDensity, timer: 300 }
})

function pickEnemies(pool, count) {
  const result = []
  for (let i = 0; i < count; i++) {
    result.push({ type: pool[Math.floor(Math.random() * pool.length)], hp: 1 })
  }
  return result
}

// ─── PROCEDURAL MAP GENERATOR ─────────────────────────────────────────────────
export function generateLevel(level) {
  const config = LEVEL_CONFIGS[level - 1]
  const grid = []
  const mapCols = SP_COLS
  const mapRows = SP_ROWS

  // Initialize grid
  for (let y = 0; y < mapRows; y++) {
    grid.push([])
    for (let x = 0; x < mapCols; x++) {
      // Outer border
      if (x === 0 || x === mapCols - 1 || y === 0 || y === mapRows - 1) {
        grid[y].push(TILE.SOLID)
      }
      // Checkerboard solid walls (every even column AND even row, not counting border)
      else if (x % 2 === 0 && y % 2 === 0) {
        grid[y].push(TILE.SOLID)
      }
      else {
        grid[y].push(TILE.EMPTY)
      }
    }
  }

  // Place soft blocks (avoid player spawn zone: 1,1 + 2 tiles right + 1 tile down)
  const spawnClear = new Set(['1,1','2,1','3,1','1,2','1,3'])
  const emptyTiles = []
  for (let y = 1; y < mapRows - 1; y++) {
    for (let x = 1; x < mapCols - 1; x++) {
      if (grid[y][x] === TILE.EMPTY && !spawnClear.has(`${x},${y}`)) {
        emptyTiles.push([x, y])
      }
    }
  }

  // Shuffle
  for (let i = emptyTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyTiles[i], emptyTiles[j]] = [emptyTiles[j], emptyTiles[i]]
  }

  const softCount = Math.floor(emptyTiles.length * config.softDensity)
  let gateHidden = false
  const softTiles = []

  for (let i = 0; i < emptyTiles.length; i++) {
    const [x, y] = emptyTiles[i]
    if (i < softCount) {
      grid[y][x] = TILE.SOFT
      softTiles.push([x, y])
    }
  }

  // Hide exit gate under a random soft block
  const hiddenGateTile = softTiles[Math.floor(Math.random() * softTiles.length)] || [mapCols - 2, mapRows - 2]

  // Deterministic Powerup Sequence
  const sequence = [
    'extrabomb', // 1
    'fireup',    // 2
    'speedup',   // 3
    'remote',    // 4
    'bombpass',  // 5
    'fullfire',  // 6
    'kick',      // 7
    'extrabomb', // 8
    'fireup',    // 9
    'wallpass',  // 10
  ]
  const defaultPool = ['extrabomb', 'fireup', 'speedup', 'remote', 'bombpass', 'wallpass', 'fullfire', 'kick']
  const powerupType = sequence[level - 1] || defaultPool[(level - 1) % defaultPool.length]

  // Hide powerup under a DIFFERENT random soft block
  const pwCandidates = softTiles.filter(t => t[0] !== hiddenGateTile[0] || t[1] !== hiddenGateTile[1])
  const hiddenPowerupTile = pwCandidates[Math.floor(Math.random() * pwCandidates.length)] || [mapCols - 3, mapRows - 2]

  // Place enemies (far from player spawn)
  const enemySpawns = getEnemySpawnPoints(grid)
  const spawnedEnemies = []
  for (let i = 0; i < config.enemies.length; i++) {
    const cfg = config.enemies[i]
    const pos = enemySpawns[i % enemySpawns.length]
    if (!pos) continue
    spawnedEnemies.push({
      id: `enemy-${level}-${i}`,
      type: cfg.type,
      x: pos[0],
      y: pos[1],
      px: pos[0] * 48,
      py: pos[1] * 48,
      alive: true,
      hp: cfg.hp || 1,
      dir: 'right',
      moveTimer: 0,
      frame: 0,
      frameTimer: 0,
      ...getEnemyDefaults(cfg.type),
    })
  }

  return {
    grid,
    hiddenGateTile,
    hiddenPowerupTile,
    powerupType,
    enemies: spawnedEnemies,
    playerSpawn: { x: 1, y: 1 },
    config,
  }
}

function getEnemySpawnPoints(grid) {
  // Far from top-left corner
  const points = []
  const minDist = 6
  const rows = grid.length
  const cols = grid[0].length
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === TILE.EMPTY) {
        const dist = Math.abs(x - 1) + Math.abs(y - 1)
        if (dist >= minDist) points.push([x, y])
      }
    }
  }
  // Shuffle
  return points.sort(() => Math.random() - 0.5)
}

function getEnemyDefaults(type) {
  const defaults = {
    Ballom:   { speed: 1, ai: 'random', points: 100, passWalls: false, passAll: false },
    Oneal:    { speed: 2, ai: 'chase_loose', points: 200, passWalls: false, passAll: false },
    Dahl:     { speed: 2, ai: 'turn_toward', points: 400, passWalls: false, passAll: false },
    Minvo:    { speed: 3, ai: 'astar', points: 800, passWalls: false, passAll: false },
    Doria:    { speed: 2, ai: 'random', points: 1000, passWalls: false, passAll: false },
    Ovapi:    { speed: 1, ai: 'random', points: 2000, passWalls: false, passAll: false },
    Pass:     { speed: 4, ai: 'random', points: 4000, passWalls: false, passAll: false },
    Pontan:   { speed: 3, ai: 'random', points: 8000, passWalls: true, passAll: true },
    Nail:     { speed: 2, ai: 'wall_follower', points: 1600, passWalls: false, passAll: false },
    Zael:     { speed: 2, ai: 'wall_hugger', points: 3200, passWalls: false, passAll: false },
    Coin:     { speed: 1, ai: 'random', points: 6400, passWalls: false, passAll: false, dropsPowerup: true },
    Hurry:    { speed: 1, ai: 'random', points: 500, passWalls: false, passAll: false, speedsUp: true },
    Rocky:    { speed: 2, ai: 'chase_loose', points: 1200, passWalls: false, passAll: false, immuneFirst: true, hp: 1 },
    Smoky:    { speed: 2, ai: 'random', points: 900, passWalls: false, passAll: false, leavesFire: true },
    Ghost:    { speed: 2, ai: 'chase_loose', points: 1400, passWalls: false, passAll: false, invisible: true, invisTimer: 0, invisCycle: 100 },
    Blaze:    { speed: 3, ai: 'target_bombs', points: 1600, passWalls: false, passAll: false },
    Titan:    { speed: 1, ai: 'chase_loose', points: 2400, passWalls: false, passAll: false, hp: 2 },
    Mimic:    { speed: 2, ai: 'mimic', points: 2000, passWalls: false, passAll: false },
    Skuller:  { speed: 4, ai: 'chase_loose', points: 5000, passWalls: true, passAll: true },
    BossBomb: { speed: 2, ai: 'boss', points: 10000, passWalls: false, passAll: false, hp: 5, plantsBombs: true },
  }
  return defaults[type] || defaults.Ballom
}

// ─── MULTIPLAYER ZONES (each player gets their own solo-style zone) ───────────
export function generateMultiplayerZones(playerCount) {
  const zoneW = SP_COLS  // 30 columns per zone
  const zoneH = SP_ROWS  // 11 rows
  const dividerW = 1     // 1 column of solid walls between zones
  const totalCols = zoneW * playerCount + dividerW * (playerCount - 1)
  const totalRows = zoneH

  // Create full grid (all EMPTY)
  const grid = Array.from({ length: totalRows }, () => Array(totalCols).fill(TILE.EMPTY))

  const allEnemies = []
  const portals = []
  const spawnPoints = []
  const hiddenGateTiles = []  // one per zone

  for (let z = 0; z < playerCount; z++) {
    const offX = z * (zoneW + dividerW)  // column offset for this zone

    // ── Build zone borders ──
    for (let y = 0; y < zoneH; y++) {
      grid[y][offX] = TILE.SOLID                   // left wall
      grid[y][offX + zoneW - 1] = TILE.SOLID       // right wall
    }
    for (let x = offX; x < offX + zoneW; x++) {
      grid[0][x] = TILE.SOLID                       // top wall
      grid[zoneH - 1][x] = TILE.SOLID               // bottom wall
    }

    // ── Checkerboard pillars ──
    for (let y = 2; y < zoneH - 1; y += 2) {
      for (let x = offX + 2; x < offX + zoneW - 1; x += 2) {
        grid[y][x] = TILE.SOLID
      }
    }

    // ── Soft blocks ──
    const spawnClear = new Set()
    const spawnX = offX + 1, spawnY = 1
    // Clear spawn area (top-left of zone)
    const clears = [[spawnX, spawnY], [spawnX+1, spawnY], [spawnX, spawnY+1], [spawnX+1, spawnY+1], [spawnX+2, spawnY], [spawnX, spawnY+2]]
    for (const [cx, cy] of clears) spawnClear.add(`${cx},${cy}`)

    const zoneEmpty = []
    for (let y = 1; y < zoneH - 1; y++) {
      for (let x = offX + 1; x < offX + zoneW - 1; x++) {
        if (grid[y][x] === TILE.EMPTY && !spawnClear.has(`${x},${y}`)) {
          zoneEmpty.push([x, y])
        }
      }
    }
    // Shuffle
    for (let i = zoneEmpty.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [zoneEmpty[i], zoneEmpty[j]] = [zoneEmpty[j], zoneEmpty[i]]
    }
    const softCount = Math.floor(zoneEmpty.length * 0.30)  // 30% density for MP
    const softTiles = []
    for (let i = 0; i < zoneEmpty.length && i < softCount; i++) {
      const [sx, sy] = zoneEmpty[i]
      grid[sy][sx] = TILE.SOFT
      softTiles.push([sx, sy])
    }

    // ── Exit gate (hidden under random soft block) ──
    const gateTile = softTiles[Math.floor(Math.random() * softTiles.length)] || [offX + zoneW - 2, zoneH - 2]
    hiddenGateTiles.push(gateTile)

    // ── Portal tile (hidden under a DIFFERENT soft block) ──
    const portalCandidates = softTiles.filter(t => t[0] !== gateTile[0] || t[1] !== gateTile[1])
    const portalTile = portalCandidates[Math.floor(Math.random() * portalCandidates.length)] || [offX + Math.floor(zoneW / 2), Math.floor(zoneH / 2)]
    // Mark portal info (will be stored in state, not in grid yet)
    portals.push({ zone: z, x: portalTile[0], y: portalTile[1], revealed: false })

    // ── Enemies ──
    const enemyPoints = []
    for (let y = 1; y < zoneH - 1; y++) {
      for (let x = offX + 1; x < offX + zoneW - 1; x++) {
        if (grid[y][x] === TILE.EMPTY) {
          const dist = Math.abs(x - spawnX) + Math.abs(y - spawnY)
          if (dist >= 6) enemyPoints.push([x, y])
        }
      }
    }
    enemyPoints.sort(() => Math.random() - 0.5)
    const enemyCount = 8
    const enemyPool = ['Ballom', 'Oneal', 'Dahl']
    for (let i = 0; i < enemyCount && i < enemyPoints.length; i++) {
      const pos = enemyPoints[i]
      const type = enemyPool[Math.floor(Math.random() * enemyPool.length)]
      allEnemies.push({
        id: `enemy-z${z}-${i}`,
        type,
        x: pos[0], y: pos[1],
        px: pos[0] * 48, py: pos[1] * 48,
        alive: true, hp: 1,
        dir: 'right', moveTimer: 0, frame: 0, frameTimer: 0,
        zone: z,
        ...getEnemyDefaults(type),
      })
    }

    // ── Spawn point ──
    spawnPoints.push({ x: spawnX, y: spawnY })
  }

  // ── Fill divider columns with SOLID walls ──
  for (let z = 1; z < playerCount; z++) {
    const divCol = z * zoneW + (z - 1)
    for (let y = 0; y < totalRows; y++) {
      grid[y][divCol] = TILE.SOLID
    }
  }

  // ── Connect portals: zone i portal → zone (i+1) % N ──
  for (let i = 0; i < portals.length; i++) {
    const target = portals[(i + 1) % portals.length]
    portals[i].targetX = target.x
    portals[i].targetY = target.y
    portals[i].targetZone = target.zone
  }

  return {
    grid,
    enemies: allEnemies,
    spawnPoints,
    portals,
    hiddenGateTiles,
    zoneWidth: zoneW,
    dividerWidth: dividerW,
  }
}

// ─── MULTIPLAYER MAPS (15×13) ─────────────────────────────────────────────────
export function generateMultiplayerMap(mapId, playerCount) {
  switch (mapId) {
    case 2: return generateLabyrinthMap()
    case 3: return generateOpenFieldMap()
    case 4: return generateSplitMap()
    case 5: return generateChaosMap()
    default: return generateClassicMultiplayerMap(playerCount)
  }
}

function emptyGrid() {
  return Array.from({ length: MP_ROWS }, (_, y) =>
    Array.from({ length: MP_COLS }, (_, x) =>
      (x === 0 || x === MP_COLS - 1 || y === 0 || y === MP_ROWS - 1) ? TILE.SOLID : TILE.EMPTY
    )
  )
}

function addCheckerboard(grid) {
  for (let y = 2; y < MP_ROWS - 1; y += 2) {
    for (let x = 2; x < MP_COLS - 1; x += 2) {
      grid[y][x] = TILE.SOLID
    }
  }
}

function fillSoft(grid, density, clearZones) {
  const clearSet = new Set(clearZones.map(([x, y]) => `${x},${y}`))
  const rows = grid.length
  const cols = grid[0].length
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === TILE.EMPTY && !clearSet.has(`${x},${y}`)) {
        if (Math.random() < density) grid[y][x] = TILE.SOFT
      }
    }
  }
}

// Spawn points for up to 6 players
const SPAWN_POINTS = [
  { x: 1, y: 1 },
  { x: MP_COLS - 2, y: MP_ROWS - 2 },
  { x: 1, y: MP_ROWS - 2 },
  { x: MP_COLS - 2, y: 1 },
  { x: Math.floor(MP_COLS / 2), y: 1 },
  { x: Math.floor(MP_COLS / 2), y: MP_ROWS - 2 },
]

function clearAroundSpawn(grid, sx, sy) {
  const rows = grid.length
  const cols = grid[0].length
  const clears = [[sx,sy],[sx+1,sy],[sx,sy+1],[sx-1,sy],[sx,sy-1]]
  for (const [x,y] of clears) {
    if (y >= 0 && y < rows && x >= 0 && x < cols && grid[y][x] !== TILE.SOLID) {
      grid[y][x] = TILE.EMPTY
    }
  }
}

export function generateClassicMultiplayerMap(playerCount) {
  const grid = emptyGrid()
  addCheckerboard(grid)
  const clears = SPAWN_POINTS.slice(0, playerCount).flatMap(({ x, y }) => {
    clearAroundSpawn(grid, x, y)
    return [[x,y],[x+1,y],[x,y+1],[x-1,y],[x,y-1]]
  })
  fillSoft(grid, 0.55, clears)
  return { grid, spawnPoints: SPAWN_POINTS.slice(0, playerCount), gates: makeGates(SPAWN_POINTS, playerCount) }
}

function generateLabyrinthMap() {
  const grid = emptyGrid()
  // Dense walls + corridors
  for (let y = 1; y < MP_ROWS - 1; y++) {
    for (let x = 1; x < MP_COLS - 1; x++) {
      if (x % 2 === 0 || y % 2 === 0) grid[y][x] = TILE.SOLID
    }
  }
  // Carve random corridors
  for (let i = 0; i < 30; i++) {
    const x = 2 + Math.floor(Math.random() * (COLS - 3))
    const y = 2 + Math.floor(Math.random() * (ROWS - 3))
    if (grid[y][x] === TILE.SOLID) grid[y][x] = TILE.EMPTY
  }
  for (const sp of SPAWN_POINTS) clearAroundSpawn(grid, sp.x, sp.y)
  return { grid, spawnPoints: SPAWN_POINTS, gates: makeGates(SPAWN_POINTS, 6) }
}

function generateOpenFieldMap() {
  const grid = emptyGrid()
  // Very few walls
  for (let y = 2; y < MP_ROWS - 1; y += 4) {
    for (let x = 2; x < MP_COLS - 1; x += 4) {
      grid[y][x] = TILE.SOLID
    }
  }
  fillSoft(grid, 0.3, SPAWN_POINTS.flatMap(({ x, y }) => [[x,y],[x+1,y],[x,y+1]]))
  return { grid, spawnPoints: SPAWN_POINTS, gates: makeGates(SPAWN_POINTS, 6) }
}

function generateSplitMap() {
  const grid = emptyGrid()
  addCheckerboard(grid)
  // Center wall
  const midX = Math.floor(MP_COLS / 2)
  for (let y = 1; y < MP_ROWS - 1; y++) {
    grid[y][midX] = TILE.SOLID
  }
  // Blastable gate in center
  grid[Math.floor(MP_ROWS / 2)][midX] = TILE.SOFT
  fillSoft(grid, 0.50, SPAWN_POINTS.flatMap(({ x, y }) => [[x,y],[x+1,y],[x,y+1]]))
  return { grid, spawnPoints: SPAWN_POINTS, gates: makeGates(SPAWN_POINTS, 6) }
}

function generateChaosMap() {
  const grid = emptyGrid()
  // Random walls
  for (let y = 1; y < MP_ROWS - 1; y++) {
    for (let x = 1; x < MP_COLS - 1; x++) {
      if (Math.random() < 0.25) grid[y][x] = TILE.SOLID
    }
  }
  for (const sp of SPAWN_POINTS) clearAroundSpawn(grid, sp.x, sp.y)
  fillSoft(grid, 0.50, SPAWN_POINTS.flatMap(({ x, y }) => [[x,y],[x+1,y],[x,y+1]]))
  return { grid, spawnPoints: SPAWN_POINTS, gates: makeGates(SPAWN_POINTS, 6) }
}

function makeGates(spawnPoints, playerCount) {
  const gates = []
  const active = spawnPoints.slice(0, playerCount)
  for (let i = 0; i < active.length; i++) {
    const sp = active[i]
    const nextSp = active[(i + 1) % active.length]
    gates.push({
      id: `gate-${i}`,
      x: Math.min(sp.x + 2, MP_COLS - 2),
      y: sp.y,
      open: false,
      openTimer: 0,
      connectsTo: `gate-${(i + 1) % active.length}`,
      exitX: nextSp.x,
      exitY: nextSp.y,
      zone: i + 1,
    })
  }
  return gates
}

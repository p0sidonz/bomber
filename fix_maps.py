import re

with open("src/game/levels/generator.js", "r") as f:
    content = f.read()

start_idx = content.find("// ─── MULTIPLAYER MAPS")
if start_idx != -1:
    new_code = """// ─── MULTIPLAYER MAPS ─────────────────────────────────────────────────
export function generateMultiplayerMap(mapId, playerCount, config = {}) {
  switch (mapId) {
    case 2: return generateLabyrinthMap(playerCount)
    case 3: return generateOpenFieldMap(playerCount)
    case 4: return generateSplitMap(playerCount)
    case 5: return generateChaosMap(playerCount)
    case 6: return generateBattleArenaMap(playerCount, config.enemyCount || 0)
    default: return generateClassicMultiplayerMap(playerCount)
  }
}

function getDims(playerCount) {
  if (playerCount > 4) return { cols: 19, rows: 15 }
  return { cols: 15, rows: 13 }
}

function emptyGrid(cols, rows) {
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) =>
      (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) ? TILE.SOLID : TILE.EMPTY
    )
  )
}

function addCheckerboard(grid) {
  const rows = grid.length
  const cols = grid[0].length
  for (let y = 2; y < rows - 1; y += 2) {
    for (let x = 2; x < cols - 1; x += 2) {
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

function getSpawnPoints(cols, rows) {
  return [
    { x: 1, y: 1 },
    { x: cols - 2, y: rows - 2 },
    { x: 1, y: rows - 2 },
    { x: cols - 2, y: 1 },
    { x: Math.floor(cols / 2), y: 1 },
    { x: Math.floor(cols / 2), y: rows - 2 },
  ]
}

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
  const { cols, rows } = getDims(playerCount)
  const grid = emptyGrid(cols, rows)
  addCheckerboard(grid)
  const spawns = getSpawnPoints(cols, rows)
  const clears = spawns.slice(0, playerCount).flatMap(({ x, y }) => {
    clearAroundSpawn(grid, x, y)
    return [[x,y],[x+1,y],[x,y+1],[x-1,y],[x,y-1]]
  })
  fillSoft(grid, 0.55, clears)
  return { grid, spawnPoints: spawns.slice(0, playerCount), gates: makeGates(spawns, playerCount, cols) }
}

function generateLabyrinthMap(playerCount) {
  const { cols, rows } = getDims(playerCount)
  const grid = emptyGrid(cols, rows)
  // Dense walls + corridors
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (x % 2 === 0 || y % 2 === 0) grid[y][x] = TILE.SOLID
    }
  }
  // Carve random corridors
  for (let i = 0; i < 30; i++) {
    const x = 2 + Math.floor(Math.random() * (cols - 4))
    const y = 2 + Math.floor(Math.random() * (rows - 4))
    if (grid[y][x] === TILE.SOLID) grid[y][x] = TILE.EMPTY
  }
  const spawns = getSpawnPoints(cols, rows)
  for (const sp of spawns) clearAroundSpawn(grid, sp.x, sp.y)
  return { grid, spawnPoints: spawns, gates: makeGates(spawns, 6, cols) }
}

function generateOpenFieldMap(playerCount) {
  const { cols, rows } = getDims(playerCount)
  const grid = emptyGrid(cols, rows)
  // Very few walls
  for (let y = 2; y < rows - 1; y += 4) {
    for (let x = 2; x < cols - 1; x += 4) {
      grid[y][x] = TILE.SOLID
    }
  }
  const spawns = getSpawnPoints(cols, rows)
  fillSoft(grid, 0.3, spawns.flatMap(({ x, y }) => [[x,y],[x+1,y],[x,y+1]]))
  return { grid, spawnPoints: spawns, gates: makeGates(spawns, 6, cols) }
}

function generateSplitMap(playerCount) {
  const { cols, rows } = getDims(playerCount)
  const grid = emptyGrid(cols, rows)
  addCheckerboard(grid)
  // Center wall
  const midX = Math.floor(cols / 2)
  for (let y = 1; y < rows - 1; y++) {
    grid[y][midX] = TILE.SOLID
  }
  // Blastable gate in center
  grid[Math.floor(rows / 2)][midX] = TILE.SOFT
  const spawns = getSpawnPoints(cols, rows)
  fillSoft(grid, 0.50, spawns.flatMap(({ x, y }) => [[x,y],[x+1,y],[x,y+1]]))
  return { grid, spawnPoints: spawns, gates: makeGates(spawns, 6, cols) }
}

function generateChaosMap(playerCount) {
  const { cols, rows } = getDims(playerCount)
  const grid = emptyGrid(cols, rows)
  // Random walls
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (Math.random() < 0.25) grid[y][x] = TILE.SOLID
    }
  }
  const spawns = getSpawnPoints(cols, rows)
  for (const sp of spawns) clearAroundSpawn(grid, sp.x, sp.y)
  fillSoft(grid, 0.50, spawns.flatMap(({ x, y }) => [[x,y],[x+1,y],[x,y+1]]))
  return { grid, spawnPoints: spawns, gates: makeGates(spawns, 6, cols) }
}

export function generateBattleArenaMap(playerCount, enemyCount) {
  const { cols, rows } = getDims(playerCount)
  const grid = emptyGrid(cols, rows)
  
  // Checkerboard for structure, but skip some to make it more open for battle
  for (let y = 2; y < rows - 1; y += 2) {
    for (let x = 2; x < cols - 1; x += 2) {
      if (Math.random() > 0.2) grid[y][x] = TILE.SOLID
    }
  }
  
  const spawns = getSpawnPoints(cols, rows)
  const activeSpawns = spawns.slice(0, playerCount)
  const clears = activeSpawns.flatMap(({ x, y }) => {
    clearAroundSpawn(grid, x, y)
    return [[x,y],[x+1,y],[x,y+1],[x-1,y],[x,y-1]]
  })
  
  // High density of soft blocks for powerups
  fillSoft(grid, 0.70, clears)
  
  const allEnemies = []
  
  // Place enemies in the center
  const enemyPoints = []
  for (let y = 3; y < rows - 3; y++) {
    for (let x = 3; x < cols - 3; x++) {
      if (grid[y][x] === TILE.EMPTY || grid[y][x] === TILE.SOFT) {
        enemyPoints.push([x, y])
      }
    }
  }
  enemyPoints.sort(() => Math.random() - 0.5)
  
  const enemyPool = ['Ballom', 'Oneal', 'Dahl', 'Minvo', 'Doria']
  for (let i = 0; i < enemyCount && i < enemyPoints.length; i++) {
    const pos = enemyPoints[i]
    const type = enemyPool[Math.floor(Math.random() * enemyPool.length)]
    // Clear soft block if spawning an enemy there
    grid[pos[1]][pos[0]] = TILE.EMPTY
    
    // We import getEnemyDefaults from higher up in the file
    // Since getEnemyDefaults is declared earlier in generator.js, we can just call it
    // Wait, getEnemyDefaults is not exported, but it's in the same file.
    
    // I need to paste the defaults manually or just use a dummy since getEnemyDefaults is available
    const hp = type === 'Oneal' ? 1 : 1
    const speed = type === 'Ballom' ? 1 : 2
    
    allEnemies.push({
      id: `arena-enemy-${i}`,
      type,
      x: pos[0], y: pos[1],
      px: pos[0] * 48, py: pos[1] * 48,
      alive: true, hp: hp, speed: speed,
      dir: 'right', moveTimer: 0, frame: 0, frameTimer: 0,
      ai: 'random' // fall back ai
    })
  }

  // Gates not used in Arena mode but added for structure compatibility
  return { 
    grid, 
    spawnPoints: activeSpawns, 
    gates: makeGates(spawns, playerCount, cols),
    enemies: allEnemies
  }
}

function makeGates(spawnPoints, playerCount, cols) {
  const gates = []
  const active = spawnPoints.slice(0, playerCount)
  for (let i = 0; i < active.length; i++) {
    const sp = active[i]
    const nextSp = active[(i + 1) % active.length]
    gates.push({
      id: `gate-${i}`,
      x: Math.min(sp.x + 2, cols - 2),
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
"""
    updated = content[:start_idx] + new_code
    with open("src/game/levels/generator.js", "w") as f:
        f.write(updated)

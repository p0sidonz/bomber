import { TILE, SPEED_VALUES } from './state.js'

export const TILE_SIZE = 48

// ─── TILE QUERY ──────────────────────────────────────────────────────────────
export function getTile(grid, x, y) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return TILE.SOLID
  return grid[y][x]
}

export function isWalkable(grid, x, y, player, bombs) {
  const tile = getTile(grid, x, y)
  if (tile === TILE.SOLID) return false
  if (tile === TILE.SOFT && !player.powerups?.includes('wallpass') && (player.wallPassTimer || 0) <= 0) return false
  // Bombs block movement — but NOT if the bomb is still 'passable' (i.e. the owner just placed it
  // and hasn't walked off yet). This prevents the player from instantly getting stuck on their own bomb.
  if (!player.powerups?.includes('bombpass')) {
    const hasBomb = bombs.some(b => b.x === x && b.y === y && !b.passable)
    if (hasBomb) return false
  }
  return true
}

// ─── PIXEL-TO-TILE ────────────────────────────────────────────────────────────
export function pixelToTile(px) {
  return Math.floor(px / TILE_SIZE)
}

export function tileCenter(t) {
  return t * TILE_SIZE + TILE_SIZE / 2
}

// ─── SMOOTH MOVEMENT ─────────────────────────────────────────────────────────
const DIRS = {
  up:    { dx: 0, dy: -1 },
  down:  { dx: 0, dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

export function movePlayer(player, keys, grid, bombs, skullReverse = false) {
  let dirKey = null
  if (keys.up)    dirKey = skullReverse ? 'down'  : 'up'
  if (keys.down)  dirKey = skullReverse ? 'up'    : 'down'
  if (keys.left)  dirKey = skullReverse ? 'right' : 'left'
  if (keys.right) dirKey = skullReverse ? 'left'  : 'right'

  if (!dirKey) {
    player.moving = false
    // Snap to grid center when stopped
    snapToGrid(player)
    return
  }

  player.dir = dirKey
  player.moving = true

  const speedNotch = player.skullEffect === 'slow' ? Math.max(1, player.speed - 2) : player.speed
  const pixelSpeed = SPEED_VALUES[speedNotch] || 2
  const { dx, dy } = DIRS[dirKey]

  const newPx = player.px + dx * pixelSpeed
  const newPy = player.py + dy * pixelSpeed

  // Calculate which tiles the player occupies (use a slightly smaller hitbox)
  const margin = 6
  const left   = newPx + margin
  const right  = newPx + TILE_SIZE - margin
  const top    = newPy + margin
  const bottom = newPy + TILE_SIZE - margin

  const tileLeft   = Math.floor(left / TILE_SIZE)
  const tileRight  = Math.floor(right / TILE_SIZE)
  const tileTop    = Math.floor(top / TILE_SIZE)
  const tileBottom = Math.floor(bottom / TILE_SIZE)

  const blocked =
    !isWalkable(grid, tileLeft,  tileTop,    player, bombs) ||
    !isWalkable(grid, tileRight, tileTop,    player, bombs) ||
    !isWalkable(grid, tileLeft,  tileBottom, player, bombs) ||
    !isWalkable(grid, tileRight, tileBottom, player, bombs)

  if (!blocked) {
    player.px = newPx
    player.py = newPy
    player.x = Math.floor((newPx + TILE_SIZE / 2) / TILE_SIZE)
    player.y = Math.floor((newPy + TILE_SIZE / 2) / TILE_SIZE)
  } else {
    // Slide along wall
    if (dx !== 0) {
      // Moving horizontally, try to slide vertically
      const centerY = player.py + TILE_SIZE / 2
      const tileY = Math.floor(centerY / TILE_SIZE)
      const offset = centerY - (tileY * TILE_SIZE + TILE_SIZE / 2)
      if (Math.abs(offset) > 0 && Math.abs(offset) < TILE_SIZE * 0.4) {
        player.py -= Math.sign(offset) * Math.min(pixelSpeed, Math.abs(offset))
      }
    }
    if (dy !== 0) {
      const centerX = player.px + TILE_SIZE / 2
      const tileX = Math.floor(centerX / TILE_SIZE)
      const offset = centerX - (tileX * TILE_SIZE + TILE_SIZE / 2)
      if (Math.abs(offset) > 0 && Math.abs(offset) < TILE_SIZE * 0.4) {
        player.px -= Math.sign(offset) * Math.min(pixelSpeed, Math.abs(offset))
      }
    }
  }

  // Animation frame
  player.frameTimer = (player.frameTimer || 0) + 1
  if (player.frameTimer >= 8) {
    player.frame = (player.frame + 1) % 2
    player.frameTimer = 0
  }
}

function snapToGrid(player) {
  const tx = Math.round(player.px / TILE_SIZE)
  const ty = Math.round(player.py / TILE_SIZE)
  const targetPx = tx * TILE_SIZE
  const targetPy = ty * TILE_SIZE
  player.px += (targetPx - player.px) * 0.3
  player.py += (targetPy - player.py) * 0.3
  if (Math.abs(player.px - targetPx) < 1) player.px = targetPx
  if (Math.abs(player.py - targetPy) < 1) player.py = targetPy
  player.x = tx
  player.y = ty
}

// ─── KICK BOMB ────────────────────────────────────────────────────────────────
export function kickBomb(bomb, direction, grid) {
  bomb.sliding = true
  bomb.slideDir = direction
  bomb.slideSpeed = 3
}

export function updateSlidingBombs(bombs, grid, players) {
  for (const bomb of bombs) {
    if (!bomb.sliding) continue
    const { dx, dy } = DIRS[bomb.slideDir]
    const newX = bomb.x + dx
    const newY = bomb.y + dy
    const tile = getTile(grid, newX, newY)
    if (tile === TILE.SOLID || tile === TILE.SOFT) {
      bomb.sliding = false
    } else if (bombs.some(b => b !== bomb && b.x === newX && b.y === newY)) {
      bomb.sliding = false
    } else {
      bomb.x = newX
      bomb.y = newY
      bomb.px = newX * TILE_SIZE
      bomb.py = newY * TILE_SIZE
    }
  }
}

// ─── PORTAL GATE TELEPORT ─────────────────────────────────────────────────────
export function checkPortalGates(player, gates) {
  for (const gate of gates) {
    if (!gate.open) continue
    if (player.x === gate.x && player.y === gate.y) {
      const target = gates.find(g => g.id === gate.connectsTo)
      if (target) {
        player.x = target.exitX || target.x
        player.y = target.exitY || target.y
        player.px = player.x * TILE_SIZE
        player.py = player.y * TILE_SIZE
        return true
      }
    }
  }
  return false
}

// ─── INTERPOLATION (client-side) ──────────────────────────────────────────────
export function interpolateStates(prevState, nextState, alpha) {
  if (!prevState || !nextState) return nextState
  const result = JSON.parse(JSON.stringify(nextState))
  for (const userId of Object.keys(result.players || {})) {
    const prev = prevState.players?.[userId]
    const next = nextState.players?.[userId]
    if (prev && next && next.alive) {
      result.players[userId].px = prev.px + (next.px - prev.px) * alpha
      result.players[userId].py = prev.py + (next.py - prev.py) * alpha
    }
  }
  return result
}

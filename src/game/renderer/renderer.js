// ============================================================
// NES-style Bomberman Renderer
// Canvas: 960 × 564
// Layout: [180px left panel] [600px game] [180px right panel]
//         HUD: top 44px
// Performance: NO shadows, NO gradients — pure fillRect pixel art
// ============================================================

const LOGIC_TS = 48            // physics space tile size (don't change — matches physics.js)
const TS = 40                  // visual tile size

export const PANEL_W = 180     // side panel width (each)
export const HUD_H = 44        // top HUD height
export const GAME_COLS = 15
export const GAME_ROWS = 13
export const GAME_W = GAME_COLS * TS    // 600
export const GAME_H = GAME_ROWS * TS   // 520
export const CANVAS_W = PANEL_W + GAME_W + PANEL_W  // 960
export const CANVAS_H = HUD_H + GAME_H              // 564

// Scale physics px (48-space) → canvas px (40-space)
const SCALE = TS / LOGIC_TS  // 40/48 ≈ 0.8333

function px2cx(physX) { return PANEL_W + physX * SCALE }
function py2cy(physY) { return HUD_H + physY * SCALE }
function tx2cx(col)   { return PANEL_W + col * TS }
function ty2cy(row)   { return HUD_H + row * TS }

// ─── NES COLOR PALETTE ───────────────────────────────────────────────────────
const C = {
  // Floor (alternating green tiles)
  FLOOR_A:     '#48a800',
  FLOOR_B:     '#3c9400',
  // Solid wall (stone)
  STONE_BASE:  '#c0c0c0',
  STONE_HI:    '#ececec',
  STONE_SH:    '#848484',
  STONE_MT:    '#a8a8a8',
  // Soft block (destructible brick)
  BRICK_BASE:  '#a09080',
  BRICK_HI:    '#c4b4a4',
  BRICK_SH:    '#5c4c3c',
  BRICK_MT:    '#6e5e4e',
  // Explosion (NES cross)
  EXPL_BASE:   '#cc5500',
  EXPL_BAR:    '#ff9900',
  EXPL_LINE:   '#ffffff',
  // HUD / panels
  HUD_BG:      '#000000',
  HUD_TEXT:    '#ffffff',
  HUD_ACCENT:  '#f0c040',
  HUD_DIM:     '#909090',
  PANEL_BG:    '#101018',
  PANEL_EDGE:  '#282840',
  // Bomb
  BOMB_DARK:   '#111111',
  BOMB_MID:    '#333333',
  BOMB_SHINE:  '#555555',
  BOMB_FUSE:   '#8a5a1a',
  BOMB_SPARK:  '#ffff00',
}

const PLAYER_COLORS = {
  red: '#e03040', blue: '#3060e0', green: '#30c060',
  yellow: '#f0c040', purple: '#9040c0', orange: '#e08030',
  white: '#e8e8e8',
}

const ENEMY_COLORS = {
  Ballom: '#e87060', Oneal: '#e09030', Dahl: '#30b050',
  Minvo: '#d0b020', Doria: '#9050c0', Ovapi: '#4070d0',
  Pass: '#40c0c0', Pontan: '#d040c0', Nail: '#c06030',
  Zael: '#80a030', Coin: '#f0c030', Hurry: '#d03030',
  Rocky: '#707080', Smoky: '#b0b0b0', Ghost: '#c0d0f0',
  Blaze: '#ff5500', Titan: '#604090', Mimic: '#40a080',
  Skuller: '#4020a0', BossBomb: '#aa0020',
}

const PW_COLORS = {
  extrabomb:'#f0c040', fireup:'#ff4400', speedup:'#40ff40',
  kick:'#ff8800', remote:'#8888ff', bombpass:'#cccccc',
  wallpass:'#aaffaa', fullfire:'#ff2200', skull:'#aa0000',
  clock:'#00ccff', mystery:'#ff00ff', gatebomb:'#ffaa00',
  shield:'#4488ff', decoy:'#ff88ff', blockitem:'#888888', swap:'#00ffcc',
}

const PW_ICONS = {
  extrabomb:'B', fireup:'F', speedup:'S', kick:'K', remote:'R',
  bombpass:'P', wallpass:'W', fullfire:'X', skull:'!', clock:'T',
  mystery:'?', gatebomb:'G', shield:'[', decoy:'D', blockitem:'#', swap:'@',
}

// ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────
export function renderFrame(ctx, state, mode = 'singleplayer') {
  if (!state) return

  // Background fill
  ctx.fillStyle = C.PANEL_BG
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Game area base (green floor fills everything)
  ctx.fillStyle = C.FLOOR_A
  ctx.fillRect(PANEL_W, HUD_H, GAME_W, GAME_H)

  if (state.grid) {
    _drawGrid(ctx, state.grid)
    _drawPowerups(ctx, state.powerupsOnMap || [])
    _drawGates(ctx, state.gates || [], state.tick)
    _drawBombs(ctx, state.bombs || [], state.tick)
    _drawExplosions(ctx, state.explosions || [])
    _drawEnemies(ctx, state.enemies || [], state.tick)
    _drawPlayers(ctx, state.players || {}, state.tick)
    _drawFloatLabels(ctx, state.floatLabels || [])
  }

  _drawHUD(ctx, state, mode)
  _drawLeftPanel(ctx, state, mode)
  _drawRightPanel(ctx, state, mode)
}

// ─── TILES ───────────────────────────────────────────────────────────────────
function _drawGrid(ctx, grid) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const tile = grid[row][col]
      const px = tx2cx(col)
      const py = ty2cy(row)
      _drawFloor(ctx, col, row, px, py)
      if (tile === 1) _drawSolidWall(ctx, px, py)
      else if (tile === 2) _drawSoftBlock(ctx, px, py)
      else if (tile === 3) _drawExitGate(ctx, px, py)
      else if (tile === 4) _drawPortalGate(ctx, px, py, false)
      else if (tile === 5) _drawPortalGate(ctx, px, py, true)
    }
  }
}

function _drawFloor(ctx, col, row, px, py) {
  ctx.fillStyle = (col + row) % 2 === 0 ? C.FLOOR_A : C.FLOOR_B
  ctx.fillRect(px, py, TS, TS)
}

function _drawSolidWall(ctx, px, py) {
  // Base
  ctx.fillStyle = C.STONE_BASE
  ctx.fillRect(px, py, TS, TS)
  // Top-left highlight
  ctx.fillStyle = C.STONE_HI
  ctx.fillRect(px, py, TS, 3)
  ctx.fillRect(px, py, 3, TS)
  // Bottom-right shadow
  ctx.fillStyle = C.STONE_SH
  ctx.fillRect(px, py + TS - 3, TS, 3)
  ctx.fillRect(px + TS - 3, py, 3, TS)
  // Stone mortar cross (makes it look like stone blocks)
  const mid = Math.floor(TS / 2)
  ctx.fillStyle = C.STONE_MT
  ctx.fillRect(px + 3, py + mid - 1, TS - 6, 2)
  ctx.fillRect(px + mid - 1, py + 3, 2, TS - 6)
}

function _drawSoftBlock(ctx, px, py) {
  // Base warm brown-gray
  ctx.fillStyle = C.BRICK_BASE
  ctx.fillRect(px, py, TS, TS)
  // Top-left highlight
  ctx.fillStyle = C.BRICK_HI
  ctx.fillRect(px, py, TS, 3)
  ctx.fillRect(px, py, 3, TS)
  // Bottom-right shadow
  ctx.fillStyle = C.BRICK_SH
  ctx.fillRect(px, py + TS - 3, TS, 3)
  ctx.fillRect(px + TS - 3, py, 3, TS)
  // Horizontal mortar
  const mid = Math.floor(TS / 2)
  ctx.fillStyle = C.BRICK_MT
  ctx.fillRect(px + 3, py + mid - 1, TS - 6, 2)
  // Vertical mortars (brick offset pattern)
  ctx.fillRect(px + Math.floor(TS / 4) - 1, py + 3, 2, mid - 4)
  ctx.fillRect(px + Math.floor(3 * TS / 4) - 1, py + 3, 2, mid - 4)
  ctx.fillRect(px + mid - 1, py + mid + 1, 2, mid - 4)
}

function _drawExitGate(ctx, px, py) {
  // Glowing concentric squares (no Date.now for perf)
  ctx.fillStyle = '#111122'
  ctx.fillRect(px, py, TS, TS)
  ctx.fillStyle = '#ffffa0'
  ctx.fillRect(px + 3, py + 3, TS - 6, TS - 6)
  ctx.fillStyle = '#ffff60'
  ctx.fillRect(px + 6, py + 6, TS - 12, TS - 12)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(px + 9, py + 9, TS - 18, TS - 18)
  // Star cross
  const cx = px + Math.floor(TS / 2)
  const cy = py + Math.floor(TS / 2)
  ctx.fillStyle = '#ffffc0'
  ctx.fillRect(cx - 1, cy - 6, 2, 12)
  ctx.fillRect(cx - 6, cy - 1, 12, 2)
}

function _drawPortalGate(ctx, px, py, open) {
  const color = open ? '#30ff60' : '#f0c040'
  ctx.fillStyle = open ? '#10601040' : '#60600040'
  ctx.fillRect(px, py, TS, TS)
  ctx.fillStyle = color
  ctx.fillRect(px, py, TS, 3)
  ctx.fillRect(px, py + TS - 3, TS, 3)
  ctx.fillRect(px, py, 3, TS)
  ctx.fillRect(px + TS - 3, py, 3, TS)
  const mid = Math.floor(TS / 2)
  ctx.fillRect(px + 3, py + mid - 1, TS - 6, 2)
  ctx.fillRect(px + mid - 1, py + 3, 2, TS - 6)
}

// ─── POWERUPS ON MAP ─────────────────────────────────────────────────────────
function _drawPowerups(ctx, powerups) {
  for (const pw of powerups) {
    const px = tx2cx(pw.x) + 3
    const py = ty2cy(pw.y) + 3
    const sz = TS - 6
    const color = PW_COLORS[pw.type] || '#ffffff'
    ctx.fillStyle = color
    ctx.fillRect(px, py, sz, sz)
    ctx.fillStyle = '#00000088'
    ctx.fillRect(px + sz - 2, py + 1, 2, sz - 1)
    ctx.fillRect(px + 1, py + sz - 2, sz - 1, 2)
    // Letter icon
    ctx.fillStyle = '#111111'
    ctx.font = `bold ${Math.floor(sz * 0.6)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(PW_ICONS[pw.type] || '?', px + sz / 2, py + sz / 2)
  }
}

// ─── GATES (timer overlay only — tiles drawn in grid) ────────────────────────
function _drawGates(ctx, gates, tick) {
  for (const gate of gates) {
    if (gate.open && gate.openTimer !== undefined) {
      const px = tx2cx(gate.x)
      const py = ty2cy(gate.y)
      const secs = Math.ceil(gate.openTimer / 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = '6px "Press Start 2P"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${secs}s`, px + TS / 2, py - 2)
    }
  }
}

// ─── BOMBS ───────────────────────────────────────────────────────────────────
function _drawBombs(ctx, bombs, tick) {
  for (const bomb of bombs) {
    const bx = bomb.px !== undefined ? px2cx(bomb.px) : tx2cx(bomb.x)
    const by = bomb.py !== undefined ? py2cy(bomb.py) : ty2cy(bomb.y)
    const cx = bx + Math.floor(TS / 2)
    const cy = by + Math.floor(TS / 2)

    // Pulse: faster near explosion
    const fuseRatio = (bomb.fuseTicks || 60) / 60
    const beatPeriod = Math.max(4, Math.floor(15 * fuseRatio))
    const pulse = (tick % beatPeriod) < Math.floor(beatPeriod / 2) ? 1 : 0
    const r = Math.floor(TS * 0.34) + pulse

    // Body (octagon approximated with 2 rects)
    ctx.fillStyle = C.BOMB_DARK
    ctx.fillRect(cx - r, cy - Math.floor(r * 0.7), r * 2, Math.floor(r * 1.4))
    ctx.fillRect(cx - Math.floor(r * 0.7), cy - r, Math.floor(r * 1.4), r * 2)

    // Shine (top-left highlight)
    ctx.fillStyle = C.BOMB_SHINE
    ctx.fillRect(cx - Math.floor(r * 0.5), cy - Math.floor(r * 0.6), Math.floor(r * 0.45), Math.floor(r * 0.35))

    // Fuse rope
    ctx.fillStyle = C.BOMB_FUSE
    ctx.fillRect(cx + Math.floor(r * 0.45), cy - r - Math.floor(r * 0.6), 2, Math.floor(r * 0.7))

    // Spark at fuse tip
    ctx.fillStyle = C.BOMB_SPARK
    ctx.fillRect(cx + Math.floor(r * 0.3), cy - r - Math.floor(r * 0.8) - 3, 5, 4)
    ctx.fillStyle = '#ff8800'
    ctx.fillRect(cx + Math.floor(r * 0.2), cy - r - Math.floor(r * 0.8) - 6, 7, 4)
  }
}

// ─── EXPLOSIONS (NES cross pattern) ──────────────────────────────────────────
function _drawExplosions(ctx, explosions) {
  for (const exp of explosions) {
    const fade = Math.min(1, (exp.frame || 0) / 10)
    ctx.globalAlpha = Math.max(0, 1 - fade * 0.6)

    const barSz   = Math.floor(TS * 0.32)
    const barOff  = Math.floor((TS - barSz) / 2)
    const lineSz  = Math.floor(TS * 0.1)
    const lineOff = Math.floor((TS - lineSz) / 2)

    for (const tile of exp.tiles) {
      const [col, row] = tile
      const px = tx2cx(col)
      const py = ty2cy(row)

      const isCenter = col === exp.centerX && row === exp.centerY
      const isH = row === exp.centerY   // horizontal arm (same row)
      const isV = col === exp.centerX   // vertical arm (same col)

      // Orange base
      ctx.fillStyle = C.EXPL_BASE
      ctx.fillRect(px, py, TS, TS)

      if (isCenter || isH) {
        ctx.fillStyle = C.EXPL_BAR
        ctx.fillRect(px, py + barOff, TS, barSz)
        ctx.fillStyle = C.EXPL_LINE
        ctx.fillRect(px, py + lineOff, TS, lineSz)
      }
      if (isCenter || isV) {
        ctx.fillStyle = C.EXPL_BAR
        ctx.fillRect(px + barOff, py, barSz, TS)
        ctx.fillStyle = C.EXPL_LINE
        ctx.fillRect(px + lineOff, py, lineSz, TS)
      }
      // Bright center dot
      if (isCenter) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(px + lineOff, py + lineOff, lineSz, lineSz)
      }
    }
    ctx.globalAlpha = 1
  }
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
function _drawPlayers(ctx, players, tick) {
  for (const player of Object.values(players)) {
    if (!player.alive && (player.deathFrame || 0) > 18) continue

    const cpx = px2cx(player.px)
    const cpy = py2cy(player.py)
    const cx  = cpx + Math.floor(TS / 2)
    const cy  = cpy + Math.floor(TS / 2)

    if (!player.alive) {
      // Death spin + shrink
      const df = player.deathFrame || 0
      const scale = 1 - df / 18
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((df / 18) * Math.PI * 2)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
      _bombermanSprite(ctx, cpx, cpy, player)
      ctx.restore()
      player.deathFrame = df + 1
      continue
    }

    if (player.wallPassTimer > 0) ctx.globalAlpha = 0.55
    _bombermanSprite(ctx, cpx, cpy, player)
    ctx.globalAlpha = 1

    // Name tag
    ctx.fillStyle = '#000000'
    ctx.font = '5px "Press Start 2P"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText((player.name || '').substring(0, 7), cx, cpy - 2)
  }
}

function _bombermanSprite(ctx, cpx, cpy, player) {
  const cx = cpx + Math.floor(TS / 2)
  const cy = cpy + Math.floor(TS / 2)
  const color = PLAYER_COLORS[player.color] || '#e8e8e8'
  const frame = player.frame || 0
  const bob   = frame === 0 ? 0 : 1
  const legA  = frame === 0 ? 4 : 2
  const legB  = frame === 0 ? 2 : 4

  // Head
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(cx - 7, cy - 15 + bob, 14, 11)
  ctx.fillRect(cx - 5, cy - 17 + bob, 10, 2)   // rounded top
  ctx.fillRect(cx - 9, cy - 13 + bob, 2, 7)    // round L
  ctx.fillRect(cx + 7, cy - 13 + bob, 2, 7)    // round R

  // Eyes (direction-based)
  ctx.fillStyle = '#111'
  if (player.dir === 'up') {
    ctx.fillRect(cx - 5, cy - 13 + bob, 3, 3)
    ctx.fillRect(cx + 2, cy - 13 + bob, 3, 3)
  } else if (player.dir === 'left') {
    ctx.fillRect(cx - 8, cy - 11 + bob, 3, 3)
  } else if (player.dir === 'right') {
    ctx.fillRect(cx + 5, cy - 11 + bob, 3, 3)
  } else {
    ctx.fillRect(cx - 5, cy - 11 + bob, 3, 3)
    ctx.fillRect(cx + 2, cy - 11 + bob, 3, 3)
  }

  // Body
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(cx - 9, cy - 4 + bob, 18, 14)
  // Colored shirt
  ctx.fillStyle = color
  ctx.fillRect(cx - 7, cy - 2 + bob, 14, 9)

  // Legs
  ctx.fillStyle = '#222222'
  ctx.fillRect(cx - 7, cy + 10 + bob, 5, legA)
  ctx.fillRect(cx + 2, cy + 10 + bob, 5, legB)

  // Skull curse overlay
  if (player.skullEffect) {
    ctx.fillStyle = '#ff000022'
    ctx.fillRect(cpx, cpy, TS, TS)
  }

  // Shield border
  if (player.shieldTimer > 0) {
    ctx.fillStyle = '#4488ffaa'
    ctx.fillRect(cpx, cpy, TS, 2)
    ctx.fillRect(cpx, cpy + TS - 2, TS, 2)
    ctx.fillRect(cpx, cpy, 2, TS)
    ctx.fillRect(cpx + TS - 2, cpy, 2, TS)
  }
}

// ─── ENEMIES ─────────────────────────────────────────────────────────────────
function _drawEnemies(ctx, enemies, tick) {
  for (const enemy of enemies) {
    if (!enemy.alive && (enemy.deathFrame || 0) > 14) continue

    const epx = enemy.px !== undefined ? px2cx(enemy.px) : tx2cx(enemy.x)
    const epy = enemy.py !== undefined ? py2cy(enemy.py) : ty2cy(enemy.y)
    const ecx = epx + Math.floor(TS / 2)
    const ecy = epy + Math.floor(TS / 2)

    if (!enemy.alive) {
      const df = enemy.deathFrame || 0
      const scale = 1 - df / 14
      ctx.save()
      ctx.translate(ecx, ecy)
      ctx.scale(scale, scale)
      ctx.translate(-ecx, -ecy)
      _enemySprite(ctx, enemy, epx, epy)
      ctx.restore()
      enemy.deathFrame = df + 1
      continue
    }

    if (enemy.isInvisible) ctx.globalAlpha = 0.18
    if ((enemy.hitFlash || 0) > 0) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.sin(enemy.hitFlash)
    }
    _enemySprite(ctx, enemy, epx, epy)
    ctx.globalAlpha = 1
  }
}

function _enemySprite(ctx, enemy, epx, epy) {
  const ecx = epx + Math.floor(TS / 2)
  const ecy = epy + Math.floor(TS / 2)
  const bob = (enemy.frame || 0) === 0 ? 0 : 2
  const color = ENEMY_COLORS[enemy.type] || '#e87060'

  if (enemy.type === 'BossBomb') {
    // Large 3-tile boss sprite
    ctx.fillStyle = color
    ctx.fillRect(ecx - 14, ecy - 12 + bob, 28, 22)
    ctx.fillRect(ecx - 10, ecy - 16 + bob, 20, 5)
    ctx.fillRect(ecx - 16, ecy - 8 + bob, 3, 16)
    ctx.fillRect(ecx + 13, ecy - 8 + bob, 3, 16)
    ctx.fillRect(ecx - 10, ecy + 10 + bob, 20, 4)
    // Crown spikes
    ctx.fillStyle = '#f0c040'
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(ecx + i * 8 - 2, ecy - 19 + bob, 4, 5)
    }
    // Eyes
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ecx - 9, ecy - 5 + bob, 7, 6)
    ctx.fillRect(ecx + 2, ecy - 5 + bob, 7, 6)
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(ecx - 7, ecy - 3 + bob, 3, 3)
    ctx.fillRect(ecx + 4, ecy - 3 + bob, 3, 3)
    // HP bar
    const maxHp = 5
    ctx.fillStyle = '#440000'
    ctx.fillRect(epx + 2, epy - 8, TS - 4, 5)
    ctx.fillStyle = '#ee0000'
    ctx.fillRect(epx + 2, epy - 8, Math.floor((TS - 4) * (enemy.hp / maxHp)), 5)
    return
  }

  // Generic round enemy body (Ballom-style)
  const r = enemy.type === 'Titan' ? 12 : 9
  ctx.fillStyle = color
  ctx.fillRect(ecx - r, ecy - r + bob, r * 2, r * 2)
  // Round corners
  ctx.fillRect(ecx - r + 2, ecy - r - 2 + bob, r * 2 - 4, 3)
  ctx.fillRect(ecx - r - 2, ecy - r + 2 + bob, 3, r * 2 - 4)
  ctx.fillRect(ecx + r - 1, ecy - r + 2 + bob, 3, r * 2 - 4)
  ctx.fillRect(ecx - r + 2, ecy + r - 1 + bob, r * 2 - 4, 3)

  // Eyes
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ecx - 7, ecy - 4 + bob, 5, 5)
  ctx.fillRect(ecx + 2, ecy - 4 + bob, 5, 5)
  ctx.fillStyle = '#111111'
  ctx.fillRect(ecx - 6, ecy - 3 + bob, 3, 3)
  ctx.fillRect(ecx + 3, ecy - 3 + bob, 3, 3)

  // Feet
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(ecx - 7, ecy + r - 1 + bob, 5, 4)
  ctx.fillRect(ecx + 2, ecy + r - 1 + bob, 5, 4)

  // Multi-HP bar (Titan)
  if (enemy.hp > 1 && enemy.type !== 'BossBomb') {
    const maxHp = 2
    ctx.fillStyle = '#440000'
    ctx.fillRect(epx + 2, epy - 6, TS - 4, 4)
    ctx.fillStyle = '#ee0000'
    ctx.fillRect(epx + 2, epy - 6, Math.floor((TS - 4) * (enemy.hp / maxHp)), 4)
  }
}

// ─── FLOATING LABELS ─────────────────────────────────────────────────────────
function _drawFloatLabels(ctx, labels) {
  ctx.font = '7px "Press Start 2P"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (const label of labels) {
    const progress = 1 - (label.timer || 0) / 40
    const lx = tx2cx(label.x) + Math.floor(TS / 2)
    const ly = ty2cy(label.y) - progress * 30
    ctx.globalAlpha = Math.max(0, 1 - progress)
    ctx.fillStyle = label.color || '#30ff60'
    ctx.fillText(label.text, lx, ly)
  }
  ctx.globalAlpha = 1
}

// ─── HUD (TOP BAR, FULL WIDTH) ───────────────────────────────────────────────
function _drawHUD(ctx, state, mode) {
  ctx.fillStyle = C.HUD_BG
  ctx.fillRect(0, 0, CANVAS_W, HUD_H)
  // Gold bottom line
  ctx.fillStyle = C.HUD_ACCENT
  ctx.fillRect(0, HUD_H - 2, CANVAS_W, 2)

  const midY = Math.floor(HUD_H / 2)
  ctx.textBaseline = 'middle'

  if (mode === 'singleplayer') {
    const player = Object.values(state.players || {})[0]
    const ticks = state.timer || 0
    const secs  = Math.floor(ticks / 20)
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')

    ctx.font = '9px "Press Start 2P"'
    // TIME (left)
    ctx.fillStyle = C.HUD_DIM
    ctx.textAlign = 'left'
    ctx.fillText('TIME', 14, midY)
    ctx.fillStyle = ticks < 600 ? '#ff4040' : C.HUD_TEXT
    ctx.fillText(`${m}:${s}`, 70, midY)

    // LEVEL (center)
    ctx.fillStyle = C.HUD_TEXT
    ctx.textAlign = 'center'
    ctx.fillText(`LEVEL ${String(state.level || 1).padStart(2, '0')}`, CANVAS_W / 2, midY)

    // LEFT (right)
    ctx.fillStyle = C.HUD_DIM
    ctx.textAlign = 'right'
    ctx.fillText('LEFT', CANVAS_W - 60, midY)
    ctx.fillStyle = C.HUD_TEXT
    ctx.fillText(String(player?.lives ?? 0), CANVAS_W - 14, midY)

  } else {
    // Multiplayer: player dots
    const players = Object.values(state.players || {})
    const slotW = CANVAS_W / (players.length + 1)
    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      const dotX = (i + 0.5) * slotW
      ctx.fillStyle = PLAYER_COLORS[p.color] || '#fff'
      ctx.fillRect(dotX - 6, midY - 6, 12, 12)
      if (!p.alive) {
        ctx.fillStyle = '#00000088'
        ctx.fillRect(dotX - 6, midY - 6, 12, 12)
      }
      ctx.font = '5px "Press Start 2P"'
      ctx.fillStyle = p.alive ? '#fff' : '#555'
      ctx.textAlign = 'center'
      ctx.fillText((p.name || '').substring(0, 6), dotX, midY - 9)
      ctx.fillText(`x${p.kills || 0}`, dotX, midY + 9)
    }
    // Timer center
    const ticks = state.timer || 0
    const secs  = Math.floor(ticks / 20)
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    ctx.font = '10px "Press Start 2P"'
    ctx.fillStyle = ticks < 400 ? '#ff4040' : C.HUD_ACCENT
    ctx.textAlign = 'center'
    ctx.fillText(`${m}:${s}`, CANVAS_W / 2, midY)
  }
}

// ─── LEFT PANEL ──────────────────────────────────────────────────────────────
function _drawLeftPanel(ctx, state, mode) {
  ctx.fillStyle = C.PANEL_BG
  ctx.fillRect(0, HUD_H, PANEL_W, GAME_H)
  ctx.fillStyle = C.PANEL_EDGE
  ctx.fillRect(PANEL_W - 2, HUD_H, 2, GAME_H)

  const PAD = 12
  let y = HUD_H + 18

  function label(text, color = C.HUD_DIM, size = 6) {
    ctx.font = `${size}px "Press Start 2P"`
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(text, PAD, y)
    y += size + 4
  }

  function gap(n = 8) { y += n }

  if (mode === 'singleplayer') {
    const p = Object.values(state.players || {})[0]
    if (!p) return

    label((p.name || 'PLAYER').substring(0, 8), C.HUD_ACCENT, 7)
    gap(6)
    label('LIVES', C.HUD_DIM)
    label('♥ '.repeat(Math.max(0, p.lives || 0)).trim() || '—', '#ff4040', 10)
    gap(10)
    label('SCORE', C.HUD_DIM)
    label(String(p.score || 0).padStart(6, '0'), C.HUD_ACCENT, 9)
    gap(10)
    label('ENEMIES', C.HUD_DIM)
    const alive = (state.enemies || []).filter(e => e.alive).length
    label(`${alive} LEFT`, '#ff8040', 9)
    gap(10)
    label('BOMB x' + (p.maxBombs || 1), '#f0c040')
    label('FIRE x' + (p.fireRange || 1), '#ff6020')
    label('SPD  x' + (p.speed || 1), '#40c040')

    if ((p.powerups || []).length > 0) {
      gap(8)
      label('POWERUPS', C.HUD_DIM)
      for (const pw of (p.powerups || []).slice(0, 5)) {
        const col = PW_COLORS[pw] || '#fff'
        ctx.fillStyle = col
        ctx.fillRect(PAD, y, 8, 8)
        ctx.fillStyle = '#ccc'
        ctx.font = '5px "Press Start 2P"'
        ctx.fillText(pw.substring(0, 9).toUpperCase(), PAD + 11, y + 1)
        y += 12
      }
    }

    if (p.skullEffect) {
      gap(8)
      label('⚠ CURSED!', '#ff2020')
      label(p.skullEffect.toUpperCase(), '#ff6060')
    }

    if (state.gateVisible) {
      gap(8)
      label('★ EXIT OPEN', '#ffffa0', 6)
    }

  } else {
    // Multiplayer: player list
    label('PLAYERS', C.HUD_ACCENT, 7)
    gap(6)
    for (const p of Object.values(state.players || {})) {
      const col = PLAYER_COLORS[p.color] || '#fff'
      ctx.fillStyle = col
      ctx.fillRect(PAD, y, 8, 8)
      ctx.fillStyle = p.alive ? '#fff' : '#555'
      ctx.font = '6px "Press Start 2P"'
      ctx.textBaseline = 'top'
      ctx.fillText((p.name || '').substring(0, 6), PAD + 11, y)
      ctx.fillStyle = C.HUD_ACCENT
      ctx.fillText(`${p.kills || 0} kills`, PAD + 11, y + 10)
      y += 26
    }
  }
}

// ─── RIGHT PANEL ─────────────────────────────────────────────────────────────
function _drawRightPanel(ctx, state, mode) {
  const rx = PANEL_W + GAME_W
  ctx.fillStyle = C.PANEL_BG
  ctx.fillRect(rx, HUD_H, PANEL_W, GAME_H)
  ctx.fillStyle = C.PANEL_EDGE
  ctx.fillRect(rx, HUD_H, 2, GAME_H)

  const PAD = 10
  let y = HUD_H + 18

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  function label(text, color = C.HUD_DIM, size = 6) {
    ctx.font = `${size}px "Press Start 2P"`
    ctx.fillStyle = color
    ctx.fillText(text, rx + PAD, y)
    y += size + 4
  }
  function gap(n = 8) { y += n }

  if (mode === 'multiplayer') {
    label('MINIMAP', C.HUD_ACCENT, 7)
    gap(4)
    const mmH = Math.floor((PANEL_W - 20) * GAME_ROWS / GAME_COLS)
    renderMinimap(ctx, state, rx + PAD, y, PANEL_W - 20, mmH)
    y += mmH + 14

    const mt = state.matchType || 'last_standing'
    label('MODE', C.HUD_DIM)
    label(mt.replace('_', ' ').toUpperCase().substring(0, 10), C.HUD_ACCENT)
    gap(6)
  }

  label('CONTROLS', C.HUD_DIM, 6)
  gap(2)
  const hints = [
    'ARROWS', '  MOVE',
    'SPACE', '  BOMB',
    'KICK', '  WALK INTO',
  ]
  for (const h of hints) {
    ctx.font = '5px "Press Start 2P"'
    ctx.fillStyle = '#606070'
    ctx.fillText(h, rx + PAD, y)
    y += 9
  }
}

// ─── MINI-MAP (used in right panel + standalone) ─────────────────────────────
export function renderMinimap(ctx, state, x, y, w, h) {
  const { grid, players, gates } = state
  if (!grid) return
  const rows = grid.length, cols = grid[0].length
  const tw = w / cols, th = h / rows

  ctx.fillStyle = '#0a180a'
  ctx.fillRect(x, y, w, h)

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const t = grid[gy][gx]
      if      (t === 1) ctx.fillStyle = '#888888'
      else if (t === 2) ctx.fillStyle = '#6e5040'
      else if (t === 3) ctx.fillStyle = '#ffffa0'
      else continue
      ctx.fillRect(x + gx * tw, y + gy * th, Math.max(1, tw - 0.5), Math.max(1, th - 0.5))
    }
  }

  for (const p of Object.values(players || {})) {
    if (!p.alive) continue
    ctx.fillStyle = PLAYER_COLORS[p.color] || '#fff'
    ctx.fillRect(x + p.x * tw - 1, y + p.y * th - 1, Math.max(2, tw + 1), Math.max(2, th + 1))
  }

  for (const gate of (gates || [])) {
    ctx.fillStyle = gate.open ? '#30ff60' : '#ff3060'
    ctx.fillRect(x + gate.x * tw, y + gate.y * th, Math.max(2, tw), Math.max(2, th))
  }

  ctx.strokeStyle = '#f0c04060'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
}

// ─── BACKWARDS-COMPATIBLE EXPORTS ────────────────────────────────────────────
export function renderGame(ctx, state) {
  if (!state?.grid) return
  _drawGrid(ctx, state.grid)
  _drawPowerups(ctx, state.powerupsOnMap || [])
  _drawGates(ctx, state.gates || [], state.tick)
  _drawBombs(ctx, state.bombs || [], state.tick)
  _drawExplosions(ctx, state.explosions || [])
  _drawEnemies(ctx, state.enemies || [], state.tick)
  _drawPlayers(ctx, state.players || {}, state.tick)
  _drawFloatLabels(ctx, state.floatLabels || [])
}

export function renderHUD(ctx, state, _width, mode) {
  _drawHUD(ctx, state, mode)
}

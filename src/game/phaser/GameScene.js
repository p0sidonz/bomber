// ============================================================
// Phaser 3 GameScene — Replaces Canvas 2D renderer
// WebGL-accelerated, camera-follow, smooth interpolation
// ============================================================
import Phaser from 'phaser'

const TS = 48 // tile size (matches physics space)

// ─── NES BOMBERMAN PALETTE (hex numbers for Phaser) ──────────────────────────
const C = {
  FLOOR_A:    0x48a800,
  FLOOR_B:    0x3c9400,
  STONE_BASE: 0xc0c0c0,
  STONE_HI:   0xececec,
  STONE_SH:   0x848484,
  STONE_MT:   0xa8a8a8,
  BRICK_BASE: 0xa09080,
  BRICK_HI:   0xc4b4a4,
  BRICK_SH:   0x5c4c3c,
  BRICK_MT:   0x6e5e4e,
  EXPL_CORE:  0xcc5500,
  EXPL_BAR:   0xff9900,
  EXPL_LINE:  0xffffff,
  BOMB_BODY:  0x111111,
  BOMB_SHINE: 0x555555,
  BOMB_FUSE:  0x8a5a1a,
  BOMB_SPARK: 0xffff00,
}

const PLAYER_HEX = {
  red: 0xe03040, blue: 0x3060e0, green: 0x30c060,
  yellow: 0xf0c040, purple: 0x9040c0, orange: 0xe08030,
  white: 0xe8e8e8,
}

const ENEMY_HEX = {
  Ballom: 0xe87060, Oneal: 0xe09030, Dahl: 0x30b050,
  Minvo: 0xd0b020, Doria: 0x9050c0, Ovapi: 0x4070d0,
  Pass: 0x40c0c0, Pontan: 0xd040c0, Nail: 0xc06030,
  Zael: 0x80a030, Coin: 0xf0c030, Hurry: 0xd03030,
  Rocky: 0x707080, Smoky: 0xb0b0b0, Ghost: 0xc0d0f0,
  Blaze: 0xff5500, Titan: 0x604090, Mimic: 0x40a080,
  Skuller: 0x4020a0, BossBomb: 0xaa0020,
}

const PW_HEX = {
  extrabomb: 0xf0c040, fireup: 0xff4400, speedup: 0x40ff40,
  kick: 0xff8800, remote: 0x8888ff, bombpass: 0xcccccc,
  wallpass: 0xaaffaa, fullfire: 0xff2200, skull: 0xaa0000,
  clock: 0x00ccff, mystery: 0xff00ff, gatebomb: 0xffaa00,
  shield: 0x4488ff, decoy: 0xff88ff, blockitem: 0x888888, swap: 0x00ffcc,
}

const PW_ICONS = {
  extrabomb: 'B', fireup: 'F', speedup: 'S', kick: 'K', remote: 'R',
  bombpass: 'P', wallpass: 'W', fullfire: 'X', skull: '!', clock: 'T',
  mystery: '?', gatebomb: 'G', shield: '[', decoy: 'D', blockitem: '#', swap: '@',
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
  }

  init(data) {
    this.stateRef = data.stateRef
    this.mode = data.mode || 'singleplayer'
    this.userId = data.userId
  }

  create() {
    this.genTextures()

    // Sprite tracking
    this.tileData = []       // [row][col] = { floor, wall, type }
    this.playerGfx = {}      // userId → { gfx, nameText }
    this.enemyGfx = {}       // enemyId → { gfx }
    this.bombGfx = {}        // bombId → { gfx }
    this.explGfx = []        // [{ gfx, id }]
    this.pwSprites = {}      // "x,y" → sprite
    this.labelTexts = []
    this.gateGfx = {}        // "x,y" → sprite

    // Build initial map
    this.buildGrid()

    // Camera target (invisible object the camera follows)
    this.camTarget = this.add.rectangle(0, 0, 1, 1, 0x000000, 0)
    this.camTarget.setDepth(-1)

    this.setupCamera()
  }

  // ─── TEXTURE GENERATION ─────────────────────────────────────────────────
  genTextures() {
    this._tex('floor_a', (g) => {
      g.fillStyle(C.FLOOR_A); g.fillRect(0, 0, TS, TS)
    })
    this._tex('floor_b', (g) => {
      g.fillStyle(C.FLOOR_A); g.fillRect(0, 0, TS, TS)
    })
    this._tex('wall_solid', (g) => {
      g.fillStyle(C.STONE_BASE); g.fillRect(0, 0, TS, TS)
      g.fillStyle(C.STONE_HI); g.fillRect(0, 0, TS, 3); g.fillRect(0, 0, 3, TS)
      g.fillStyle(C.STONE_SH); g.fillRect(0, TS - 3, TS, 3); g.fillRect(TS - 3, 0, 3, TS)
    })
    this._tex('wall_soft', (g) => {
      const mid = Math.floor(TS / 2)
      g.fillStyle(C.BRICK_BASE); g.fillRect(0, 0, TS, TS)
      g.fillStyle(C.BRICK_HI); g.fillRect(0, 0, TS, 3); g.fillRect(0, 0, 3, TS)
      g.fillStyle(C.BRICK_SH); g.fillRect(0, TS - 3, TS, 3); g.fillRect(TS - 3, 0, 3, TS)
      g.fillStyle(C.BRICK_MT)
      g.fillRect(3, mid - 1, TS - 6, 2)
      g.fillRect(Math.floor(TS / 4) - 1, 3, 2, mid - 4)
      g.fillRect(Math.floor(3 * TS / 4) - 1, 3, 2, mid - 4)
      g.fillRect(mid - 1, mid + 1, 2, mid - 4)
    })
    this._tex('gate_exit', (g) => {
      const cx = Math.floor(TS / 2), cy = Math.floor(TS / 2)
      g.fillStyle(0x111122); g.fillRect(0, 0, TS, TS)
      g.fillStyle(0xffffa0); g.fillRect(3, 3, TS - 6, TS - 6)
      g.fillStyle(0xffff60); g.fillRect(6, 6, TS - 12, TS - 12)
      g.fillStyle(0xffffff); g.fillRect(9, 9, TS - 18, TS - 18)
      g.fillStyle(0xffffc0); g.fillRect(cx - 1, cy - 6, 2, 12); g.fillRect(cx - 6, cy - 1, 12, 2)
    })
    this._tex('portal_closed', (g) => {
      g.fillStyle(0x606000, 0.25); g.fillRect(0, 0, TS, TS)
      g.fillStyle(0xf0c040)
      g.fillRect(0, 0, TS, 3); g.fillRect(0, TS - 3, TS, 3)
      g.fillRect(0, 0, 3, TS); g.fillRect(TS - 3, 0, 3, TS)
      const mid = Math.floor(TS / 2)
      g.fillRect(3, mid - 1, TS - 6, 2); g.fillRect(mid - 1, 3, 2, TS - 6)
    })
    this._tex('portal_open', (g) => {
      g.fillStyle(0x106010, 0.25); g.fillRect(0, 0, TS, TS)
      g.fillStyle(0x30ff60)
      g.fillRect(0, 0, TS, 3); g.fillRect(0, TS - 3, TS, 3)
      g.fillRect(0, 0, 3, TS); g.fillRect(TS - 3, 0, 3, TS)
      const mid = Math.floor(TS / 2)
      g.fillRect(3, mid - 1, TS - 6, 2); g.fillRect(mid - 1, 3, 2, TS - 6)
    })
  }

  _tex(key, drawFn) {
    const g = this.make.graphics({ add: false })
    drawFn(g)
    g.generateTexture(key, TS, TS)
    g.destroy()
  }

  // ─── BUILD INITIAL GRID ────────────────────────────────────────────────
  buildGrid() {
    const state = this.stateRef?.current
    if (!state?.grid) return
    const { grid } = state
    const rows = grid.length
    const cols = grid[0].length

    this.tileData = []
    for (let row = 0; row < rows; row++) {
      this.tileData[row] = []
      for (let col = 0; col < cols; col++) {
        const x = col * TS + TS / 2
        const y = row * TS + TS / 2
        const floorKey = 'floor_a'
        const floor = this.add.image(x, y, floorKey).setDepth(0)

        let wall = null
        const tile = grid[row][col]
        if (tile === 1) wall = this.add.image(x, y, 'wall_solid').setDepth(1)
        else if (tile === 2) wall = this.add.image(x, y, 'wall_soft').setDepth(1)
        else if (tile === 3) wall = this.add.image(x, y, 'gate_exit').setDepth(1)
        else if (tile === 4) wall = this.add.image(x, y, 'portal_open').setDepth(1)

        this.tileData[row][col] = { floor, wall, type: tile }
      }
    }
  }

  // ─── CAMERA SETUP ──────────────────────────────────────────────────────
  setupCamera() {
    const state = this.stateRef?.current
    if (!state?.grid) return

    const cols = state.grid[0].length
    const rows = state.grid.length
    const mapW = cols * TS
    const mapH = rows * TS

    const cam = this.cameras.main
    cam.setBounds(0, 0, mapW, mapH)

    // Zoom to always show ALL rows, scroll horizontally
    if (this.mode === 'singleplayer' || this.mode === 'multiplayer') {
      // Fit full height so all rows are visible, camera scrolls horizontally
      const zoom = cam.height / mapH
      cam.setZoom(zoom)
    } else {
      const zoomX = cam.width / mapW
      const zoomY = cam.height / mapH
      cam.setZoom(Math.min(zoomX, zoomY) * 0.92)
    }

    cam.startFollow(this.camTarget, true, 0.1, 0.1)
  }

  // ─── MAIN UPDATE LOOP (60fps) ──────────────────────────────────────────
  update(time, delta) {
    const state = this.stateRef?.current
    if (!state || !state.grid) return

    this.syncGrid(state)
    this.syncBombs(state, time)
    this.syncExplosions(state)
    this.syncPowerups(state)
    this.syncGates(state)
    this.syncEnemies(state, delta)
    this.syncPlayers(state, delta)
    this.syncLabels(state)
    this.updateCamera(state)
  }

  // ─── SYNC GRID (only update changed tiles) ─────────────────────────────
  syncGrid(state) {
    const { grid } = state
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const tile = grid[row][col]
        const entry = this.tileData[row]?.[col]
        if (!entry || entry.type === tile) continue

        // Tile changed
        if (entry.wall) { entry.wall.destroy(); entry.wall = null }
        const x = col * TS + TS / 2
        const y = row * TS + TS / 2
        if (tile === 1) entry.wall = this.add.image(x, y, 'wall_solid').setDepth(1)
        else if (tile === 2) entry.wall = this.add.image(x, y, 'wall_soft').setDepth(1)
        else if (tile === 3) entry.wall = this.add.image(x, y, 'gate_exit').setDepth(1)
        else if (tile === 4) entry.wall = this.add.image(x, y, 'portal_open').setDepth(1)
        entry.type = tile
      }
    }
  }

  // ─── SYNC BOMBS ────────────────────────────────────────────────────────
  syncBombs(state, time) {
    const activeBombIds = new Set()
    for (const bomb of state.bombs) {
      activeBombIds.add(bomb.id)
      let entry = this.bombGfx[bomb.id]
      if (!entry) {
        const gfx = this.add.graphics().setDepth(3)
        entry = { gfx }
        this.bombGfx[bomb.id] = entry
      }
      // Position
      const bx = bomb.px !== undefined ? bomb.px : bomb.x * TS
      const by = bomb.py !== undefined ? bomb.py : bomb.y * TS
      entry.gfx.setPosition(bx + TS / 2, by + TS / 2)

      // Draw with pulse
      const fuseRatio = (bomb.fuseTicks || 60) / 60
      const beatPeriod = Math.max(100, 400 * fuseRatio) // ms
      const pulse = Math.sin(time / beatPeriod * Math.PI * 2) * 0.08
      const scale = 1 + pulse

      entry.gfx.clear()
      const r = Math.floor(TS * 0.34 * scale)

      // Body (smooth circle)
      entry.gfx.fillStyle(C.BOMB_BODY)
      entry.gfx.fillCircle(0, 0, r)
      
      // Shine (smooth small circle)
      entry.gfx.fillStyle(C.BOMB_SHINE)
      entry.gfx.fillCircle(-r * 0.3, -r * 0.3, r * 0.3)
      
      // Fuse
      entry.gfx.fillStyle(C.BOMB_FUSE)
      entry.gfx.fillRect(-2, -r - 10, 4, 10)
      
      // Spark
      if (time % 200 < 100) {
        entry.gfx.fillStyle(C.BOMB_SPARK1)
        entry.gfx.fillCircle(0, -r - 12, 6)
      } else {
        entry.gfx.fillStyle(C.BOMB_SPARK2)
        entry.gfx.fillCircle(0, -r - 12, 4)
      }
    }

    // Remove bombs that no longer exist
    for (const id of Object.keys(this.bombGfx)) {
      if (!activeBombIds.has(id)) {
        this.bombGfx[id].gfx.destroy()
        delete this.bombGfx[id]
      }
    }
  }

  // ─── SYNC EXPLOSIONS (clean orange flame fill) ────────────────────────
  syncExplosions(state) {
    for (const entry of this.explGfx) entry.gfx.destroy()
    this.explGfx = []

    for (const exp of state.explosions) {
      const fade = Math.min(1, (exp.frame || 0) / 10)
      const alpha = Math.max(0.1, 1 - fade * 0.8)
      const gfx = this.add.graphics().setDepth(4).setAlpha(alpha)

      // Separate tiles into horizontal and vertical arms
      let minX = exp.centerX, maxX = exp.centerX
      let minY = exp.centerY, maxY = exp.centerY

      for (const [col, row] of exp.tiles) {
        if (row === exp.centerY) {
          if (col < minX) minX = col
          if (col > maxX) maxX = col
        }
        if (col === exp.centerX) {
          if (row < minY) minY = row
          if (row > maxY) maxY = row
        }
      }

      const pad = 4
      const drawBeam = (x1, y1, x2, y2) => {
        const px = x1 * TS + pad
        const py = y1 * TS + pad
        const w = (x2 - x1 + 1) * TS - pad * 2
        const h = (y2 - y1 + 1) * TS - pad * 2
        
        // Outer orange (flat rects merge perfectly into a + shape)
        gfx.fillStyle(0xe85000)
        gfx.fillRect(px, py, w, h)
        // Inner yellow
        gfx.fillStyle(0xff8800)
        gfx.fillRect(px + 4, py + 4, Math.max(0, w - 8), Math.max(0, h - 8))
        // Bright core line
        gfx.fillStyle(0xffcc44)
        gfx.fillRect(px + 10, py + 10, Math.max(0, w - 20), Math.max(0, h - 20))
      }

      // Draw vertical beam
      if (maxY >= minY) {
        drawBeam(exp.centerX, minY, exp.centerX, maxY)
      }
      
      // Draw horizontal beam
      if (maxX >= minX) {
        drawBeam(minX, exp.centerY, maxX, exp.centerY)
      }

      // Bright center blast core to cover the intersection and make it look like an eruption
      const cx = exp.centerX * TS + TS / 2
      const cy = exp.centerY * TS + TS / 2
      
      gfx.fillStyle(0xffffff)
      gfx.fillCircle(cx, cy, TS * 0.4)
      gfx.fillStyle(0xffffee)
      gfx.fillCircle(cx, cy, TS * 0.25)

      this.explGfx.push({ gfx, id: exp.id })
    }
  }

  // ─── SYNC POWERUPS ────────────────────────────────────────────────────
  syncPowerups(state) {
    const activePwKeys = new Set()
    for (const pw of state.powerupsOnMap || []) {
      const key = `${pw.x},${pw.y}`
      activePwKeys.add(key)
      if (!this.pwSprites[key]) {
        const x = pw.x * TS + TS / 2
        const y = pw.y * TS + TS / 2
        const gfx = this.add.graphics().setDepth(2).setPosition(x, y)
        const sz = TS - 8
        const half = sz / 2
        const color = PW_HEX[pw.type] || 0xffffff
        // Shadow base
        gfx.fillStyle(0x000000, 0.4)
        gfx.fillRoundedRect(-half + 2, -half + 2, sz, sz, 8)
        // Main pill shape
        gfx.fillStyle(color)
        gfx.fillRoundedRect(-half, -half, sz, sz, 8)
        // Inner detail ring
        gfx.lineStyle(2, 0xffffff, 0.6)
        gfx.strokeRoundedRect(-half + 4, -half + 4, sz - 8, sz - 8, 4)

        const txt = this.add.text(x, y, PW_ICONS[pw.type] || '?', {
          fontSize: `${Math.floor(sz * 0.5)}px`,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          color: '#111111',
        }).setOrigin(0.5).setDepth(2.5)

        this.pwSprites[key] = { gfx, txt }
      }
    }

    // Remove picked-up powerups
    for (const key of Object.keys(this.pwSprites)) {
      if (!activePwKeys.has(key)) {
        this.pwSprites[key].gfx.destroy()
        this.pwSprites[key].txt.destroy()
        delete this.pwSprites[key]
      }
    }
  }

  // ─── SYNC GATES ───────────────────────────────────────────────────────
  syncGates(state) {
    const activeGateKeys = new Set()
    for (const gate of state.gates || []) {
      const key = `${gate.x},${gate.y}`
      activeGateKeys.add(key)
      const x = gate.x * TS + TS / 2
      const y = gate.y * TS + TS / 2
      const texKey = gate.open ? 'portal_open' : 'portal_closed'

      if (!this.gateGfx[key]) {
        this.gateGfx[key] = { sprite: this.add.image(x, y, texKey).setDepth(1.5), open: gate.open }
      } else if (this.gateGfx[key].open !== gate.open) {
        this.gateGfx[key].sprite.setTexture(texKey)
        this.gateGfx[key].open = gate.open
      }
    }

    for (const key of Object.keys(this.gateGfx)) {
      if (!activeGateKeys.has(key)) {
        this.gateGfx[key].sprite.destroy()
        delete this.gateGfx[key]
      }
    }
  }

  // ─── SYNC ENEMIES ─────────────────────────────────────────────────────
  syncEnemies(state, delta) {
    const aliveIds = new Set()

    for (const enemy of state.enemies || []) {
      if (!enemy.alive && (enemy.deathFrame || 0) > 14) continue
      aliveIds.add(enemy.id)

      let entry = this.enemyGfx[enemy.id]
      if (!entry) {
        const gfx = this.add.graphics().setDepth(5)
        entry = { gfx, prevPx: enemy.px, prevPy: enemy.py }
        this.enemyGfx[enemy.id] = entry
      }

      // Track enemy px/py directly (game logic now handles smooth movement)
      const tx = enemy.px + TS / 2
      const ty = enemy.py + TS / 2
      const lerpAmt = Math.min(1, delta * 0.04)
      const ex = entry.gfx.x + (tx - entry.gfx.x) * lerpAmt
      const ey = entry.gfx.y + (ty - entry.gfx.y) * lerpAmt
      entry.gfx.setPosition(ex, ey)

      // Death animation
      if (!enemy.alive) {
        const df = enemy.deathFrame || 0
        const scale = Math.max(0, 1 - df / 14)
        entry.gfx.setScale(scale).setAlpha(scale)
      } else {
        entry.gfx.setScale(1)
        let alpha = 1
        if (enemy.isInvisible) alpha = 0.18
        if ((enemy.hitFlash || 0) > 0) alpha = 0.4 + 0.6 * Math.sin(enemy.hitFlash)
        entry.gfx.setAlpha(alpha)
      }

      this._drawEnemy(entry.gfx, enemy)
    }

    // Remove destroyed enemies
    for (const id of Object.keys(this.enemyGfx)) {
      if (!aliveIds.has(id)) {
        this.enemyGfx[id].gfx.destroy()
        delete this.enemyGfx[id]
      }
    }
  }

  _drawEnemy(gfx, enemy) {
    gfx.clear()
    const color = ENEMY_HEX[enemy.type] || 0xe87060
    const bob = (enemy.frame || 0) === 0 ? 0 : 2

    if (enemy.type === 'BossBomb') {
      // Large boss
      gfx.fillStyle(color)
      gfx.fillCircle(0, bob, 16)
      gfx.fillRoundedRect(-12, -18 + bob, 24, 8, 4)
      // Crown
      gfx.fillStyle(0xf0c040)
      for (let i = -1; i <= 1; i++) gfx.fillCircle(i * 8, -20 + bob, 4)
      // Eyes
      gfx.fillStyle(0xffffff)
      gfx.fillCircle(-6, -2 + bob, 5); gfx.fillCircle(6, -2 + bob, 5)
      gfx.fillStyle(0xff0000)
      gfx.fillCircle(-6, -2 + bob, 2); gfx.fillCircle(6, -2 + bob, 2)
      // HP bar
      gfx.fillStyle(0x440000)
      gfx.fillRoundedRect(-TS / 2 + 2, -TS / 2 - 4, TS - 4, 5, 2)
      gfx.fillStyle(0xee0000)
      gfx.fillRoundedRect(-TS / 2 + 2, -TS / 2 - 4, Math.floor((TS - 4) * (enemy.hp / 5)), 5, 2)
      return
    }

    // Generic smooth round body
    const r = enemy.type === 'Titan' ? 14 : 11
    gfx.fillStyle(color)
    gfx.fillCircle(0, bob, r)

    // Eyes
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(-5, -2 + bob, 4); gfx.fillCircle(5, -2 + bob, 4)
    gfx.fillStyle(0x111111)
    gfx.fillCircle(-5, -2 + bob, 2); gfx.fillCircle(5, -2 + bob, 2)

    // Feet
    gfx.fillStyle(0x1a1a1a)
    gfx.fillRoundedRect(-8, r - 2 + bob, 6, 5, 2)
    gfx.fillRoundedRect(2, r - 2 + bob, 6, 5, 2)

    // Multi-HP bar
    if (enemy.hp > 1 && enemy.type !== 'BossBomb') {
      gfx.fillStyle(0x440000)
      gfx.fillRect(-TS / 2 + 2, -TS / 2 - 2, TS - 4, 4)
      gfx.fillStyle(0xee0000)
      gfx.fillRect(-TS / 2 + 2, -TS / 2 - 2, Math.floor((TS - 4) * (enemy.hp / 2)), 4)
    }
  }

  // ─── SYNC PLAYERS ─────────────────────────────────────────────────────
  syncPlayers(state, delta) {
    const activeIds = new Set()

    for (const player of Object.values(state.players || {})) {
      if (!player.alive && (player.deathFrame || 0) > 18) continue
      activeIds.add(player.userId)

      let entry = this.playerGfx[player.userId]
      if (!entry) {
        const gfx = this.add.graphics().setDepth(6)
        const nameText = this.add.text(0, 0, (player.name || '').substring(0, 7), {
          fontSize: '9px',
          fontFamily: '"Press Start 2P", monospace',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(6.5)
        entry = { gfx, nameText, prevPx: player.px, prevPy: player.py }
        this.playerGfx[player.userId] = entry
      }

      // Smooth interpolation toward target
      const tx = player.px + TS / 2
      const ty = player.py + TS / 2
      const lerpAmt = Math.min(1, delta * 0.015)
      const px = entry.gfx.x + (tx - entry.gfx.x) * lerpAmt
      const py = entry.gfx.y + (ty - entry.gfx.y) * lerpAmt
      entry.gfx.setPosition(px, py)
      entry.nameText.setPosition(px, py - TS / 2 - 2)

      // Death animation
      if (!player.alive) {
        const df = player.deathFrame || 0
        const scale = Math.max(0, 1 - df / 18)
        entry.gfx.setScale(scale).setAlpha(scale).setRotation((df / 18) * Math.PI * 2)
      } else {
        entry.gfx.setScale(1).setAlpha(player.wallPassTimer > 0 ? 0.55 : 1).setRotation(0)
      }

      this._drawPlayer(entry.gfx, player)
    }

    // Remove disconnected players
    for (const id of Object.keys(this.playerGfx)) {
      if (!activeIds.has(id)) {
        this.playerGfx[id].gfx.destroy()
        this.playerGfx[id].nameText.destroy()
        delete this.playerGfx[id]
      }
    }
  }

  _drawPlayer(gfx, player) {
    gfx.clear()
    const color = PLAYER_HEX[player.color] || 0xe8e8e8
    const frame = player.frame || 0
    const bob = frame === 0 ? 0 : 1
    const legA = frame === 0 ? 4 : 2
    const legB = frame === 0 ? 2 : 4

    // Head (smooth)
    gfx.fillStyle(0xf0f0f0)
    gfx.fillRoundedRect(-9, -17 + bob, 18, 14, 5)

    // Eyes (direction)
    gfx.fillStyle(0x111111)
    if (player.dir === 'up') {
      gfx.fillCircle(-3, -12 + bob, 2); gfx.fillCircle(3, -12 + bob, 2)
    } else if (player.dir === 'left') {
      gfx.fillCircle(-6, -10 + bob, 2)
    } else if (player.dir === 'right') {
      gfx.fillCircle(6, -10 + bob, 2)
    } else {
      gfx.fillCircle(-3, -10 + bob, 2); gfx.fillCircle(3, -10 + bob, 2)
    }

    // Body
    gfx.fillStyle(0xf0f0f0)
    gfx.fillRoundedRect(-10, -4 + bob, 20, 15, 4)
    gfx.fillStyle(color)
    gfx.fillRoundedRect(-8, -2 + bob, 16, 11, 3)

    // Legs
    gfx.fillStyle(0x222222)
    gfx.fillRoundedRect(-8, 10 + bob, 6, legA, 2)
    gfx.fillRoundedRect(2, 10 + bob, 6, legB, 2)

    // Skull curse overlay
    if (player.skullEffect) {
      gfx.fillStyle(0xff0000, 0.13)
      gfx.fillRect(-TS / 2, -TS / 2, TS, TS)
    }

    // Shield border
    if (player.shieldTimer > 0) {
      gfx.fillStyle(0x4488ff, 0.67)
      gfx.fillRect(-TS / 2, -TS / 2, TS, 2)
      gfx.fillRect(-TS / 2, TS / 2 - 2, TS, 2)
      gfx.fillRect(-TS / 2, -TS / 2, 2, TS)
      gfx.fillRect(TS / 2 - 2, -TS / 2, 2, TS)
    }
  }

  // ─── SYNC FLOAT LABELS ────────────────────────────────────────────────
  syncLabels(state) {
    // Clean old
    for (const t of this.labelTexts) t.destroy()
    this.labelTexts = []

    for (const label of state.floatLabels || []) {
      const progress = 1 - (label.timer || 0) / 40
      const lx = label.x * TS + TS / 2
      const ly = label.y * TS - progress * 30
      const txt = this.add.text(lx, ly, label.text, {
        fontSize: '10px',
        fontFamily: '"Press Start 2P", monospace',
        color: label.color || '#30c060',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(7).setAlpha(Math.max(0, 1 - progress))
      this.labelTexts.push(txt)
    }
  }

  // ─── CAMERA ───────────────────────────────────────────────────────────
  updateCamera(state) {
    // Follow the current player (or first player)
    const myPlayer = this.userId
      ? state.players[this.userId]
      : Object.values(state.players)[0]

    if (myPlayer && myPlayer.alive) {
      this.camTarget.x = myPlayer.px + TS / 2
      this.camTarget.y = myPlayer.py + TS / 2
      
      // Bound the camera strictly to the current player's zone
      if (this.mode === 'multiplayer' && state.zoneWidth) {
        const zoneStartX = myPlayer.zone * (state.zoneWidth + state.dividerWidth) * TS
        const totalHeight = state.grid.length * TS
        const totalWidth = state.zoneWidth * TS
        this.cameras.main.setBounds(zoneStartX, 0, totalWidth, totalHeight)
      }
    }
  }
}

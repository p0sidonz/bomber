// ============================================================
// Phaser 3 GameScene — Premium 3D-style renderer
// WebGL-accelerated, camera-follow, smooth interpolation
// ============================================================
import Phaser from 'phaser'

const TS = 48 // tile size (matches physics space)
const H = TS / 2

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
  Charger: 0xcc2222, Slime: 0x30cc60, MiniSlime: 0x66ff99, Hopper: 0x20aa50,
  Dragon: 0xff6600,
}

const PW_HEX = {
  extrabomb: 0xf0c040, fireup: 0xff4400, speedup: 0x40ff40,
  kick: 0xff8800, remote: 0x8888ff, bombpass: 0xcccccc,
  wallpass: 0xaaffaa, fullfire: 0xff2200, skull: 0xaa0000,
  clock: 0x00ccff, mystery: 0xff00ff, gatebomb: 0xffaa00,
  shield: 0x4488ff, decoy: 0xff88ff, blockitem: 0x888888, swap: 0x00ffcc,
  egg: 0xffddaa,
}

const PW_ICONS = {
  extrabomb: 'B', fireup: 'F', speedup: 'S', kick: 'K', remote: 'R',
  bombpass: 'P', wallpass: 'W', fullfire: 'X', skull: '!', clock: 'T',
  mystery: '?', gatebomb: 'G', shield: '[', decoy: 'D', blockitem: '#', swap: '@',
  egg: 'O',
}

// Helper: darken a hex color by factor (0-1)
function darken(hex, factor) {
  const r = ((hex >> 16) & 0xff) * (1 - factor)
  const g = ((hex >> 8) & 0xff) * (1 - factor)
  const b = (hex & 0xff) * (1 - factor)
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b)
}

// Helper: lighten a hex color by factor (0-1)
function lighten(hex, factor) {
  const r = Math.min(255, ((hex >> 16) & 0xff) + 255 * factor)
  const g = Math.min(255, ((hex >> 8) & 0xff) + 255 * factor)
  const b = Math.min(255, (hex & 0xff) + 255 * factor)
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b)
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

    // Generate player-colored portal texture
    this._genPortalTexture()

    // Sprite tracking
    this.tileData = []
    this.playerGfx = {}
    this.enemyGfx = {}
    this.bombGfx = {}
    this.explGfx = []
    this.pwSprites = {}
    this.labelTexts = []
    this.gateGfx = {}

    this.buildGrid()

    this.camTarget = this.add.rectangle(0, 0, 1, 1, 0x000000, 0)
    this.camTarget.setDepth(-1)

    this.setupCamera()
  }

  _genPortalTexture() {
    // Get the player's color from state
    const state = this.stateRef?.current
    const myPlayer = this.userId && state?.players
      ? state.players[this.userId]
      : (state?.players ? Object.values(state.players)[0] : null)
    const colorName = myPlayer?.color || 'white'
    const pColor = PLAYER_HEX[colorName] || 0xe8e8e8

    this._tex('portal_tile', (g) => {
      // Dark background
      g.fillStyle(0x0a0a14); g.fillRect(0, 0, TS, TS)
      // Outer glow ring in player color
      g.fillStyle(pColor, 0.2); g.fillCircle(H, H, 20)
      g.fillStyle(pColor, 0.4); g.fillCircle(H, H, 15)
      g.fillStyle(lighten(pColor, 0.4), 0.6); g.fillCircle(H, H, 10)
      g.fillStyle(0xffffff, 0.7); g.fillCircle(H, H, 5)
      // Border frame in player color
      g.fillStyle(pColor)
      g.fillRect(0, 0, TS, 3); g.fillRect(0, TS - 3, TS, 3)
      g.fillRect(0, 0, 3, TS); g.fillRect(TS - 3, 0, 3, TS)
    })
  }

  // ─── TEXTURE GENERATION (3D-style tiles) ─────────────────────────────
  genTextures() {
    // ── FLOOR ──
    this._tex('floor_a', (g) => {
      // Base green
      g.fillStyle(0x5ab832); g.fillRect(0, 0, TS, TS)
      // Subtle checker pattern for depth
      g.fillStyle(0x4da828, 0.5); g.fillRect(0, 0, H, H); g.fillRect(H, H, H, H)
      // Very subtle noise dots for texture
      g.fillStyle(0x66cc38, 0.3)
      for (let i = 0; i < 6; i++) {
        const dx = 4 + (i * 7) % (TS - 8)
        const dy = 3 + (i * 11) % (TS - 6)
        g.fillRect(dx, dy, 2, 2)
      }
    })

    // ── SOLID WALL (3D stone block) ──
    this._tex('wall_solid', (g) => {
      const base = 0x808890
      // Main face
      g.fillStyle(base); g.fillRect(0, 0, TS, TS)
      // Top edge highlight (bright)
      g.fillStyle(lighten(base, 0.35)); g.fillRect(0, 0, TS, 4)
      // Left edge highlight
      g.fillStyle(lighten(base, 0.25)); g.fillRect(0, 0, 4, TS)
      // Bottom shadow
      g.fillStyle(darken(base, 0.4)); g.fillRect(0, TS - 5, TS, 5)
      // Right shadow
      g.fillStyle(darken(base, 0.3)); g.fillRect(TS - 5, 0, 5, TS)
      // Inner bevel
      g.fillStyle(lighten(base, 0.12)); g.fillRect(5, 5, TS - 10, TS - 10)
      // Center cross detail
      g.fillStyle(darken(base, 0.15))
      g.fillRect(H - 1, 8, 2, TS - 16)
      g.fillRect(8, H - 1, TS - 16, 2)
      // Corner rivets
      g.fillStyle(darken(base, 0.5))
      g.fillCircle(8, 8, 3); g.fillCircle(TS - 8, 8, 3)
      g.fillCircle(8, TS - 8, 3); g.fillCircle(TS - 8, TS - 8, 3)
      g.fillStyle(lighten(base, 0.4))
      g.fillCircle(7, 7, 1.5); g.fillCircle(TS - 9, 7, 1.5)
    })

    // ── SOFT WALL (3D brick) ──
    this._tex('wall_soft', (g) => {
      const base = 0xc08050
      g.fillStyle(base); g.fillRect(0, 0, TS, TS)
      // Top highlight
      g.fillStyle(lighten(base, 0.3)); g.fillRect(0, 0, TS, 3)
      // Left highlight
      g.fillStyle(lighten(base, 0.2)); g.fillRect(0, 0, 3, TS)
      // Bottom shadow
      g.fillStyle(darken(base, 0.35)); g.fillRect(0, TS - 4, TS, 4)
      // Right shadow
      g.fillStyle(darken(base, 0.25)); g.fillRect(TS - 4, 0, 4, TS)
      // Brick lines (mortar)
      g.fillStyle(darken(base, 0.3))
      g.fillRect(3, H - 1, TS - 6, 2)
      g.fillRect(H / 2, 3, 2, H - 4)
      g.fillRect(H + H / 2, 3, 2, H - 4)
      g.fillRect(H - 1, H + 1, 2, H - 5)
      // Brick face highlights
      g.fillStyle(lighten(base, 0.15))
      g.fillRect(5, 5, H / 2 - 4, H - 8)
      g.fillRect(H / 2 + 4, 5, H - 4, H - 8)
    })

    // ── EXIT GATE (brown wooden door) ──
    this._tex('gate_exit', (g) => {
      const base = 0x6b4226
      // Dark pit background
      g.fillStyle(0x1a0e04); g.fillRect(0, 0, TS, TS)
      // Wooden door frame
      g.fillStyle(0x8b5a2b); g.fillRect(2, 2, TS - 4, TS - 4)
      // Main wood face
      g.fillStyle(base); g.fillRect(4, 4, TS - 8, TS - 8)
      // Wood grain lines
      g.fillStyle(darken(base, 0.15))
      g.fillRect(8, 4, 2, TS - 8)
      g.fillRect(18, 4, 2, TS - 8)
      g.fillRect(28, 4, 2, TS - 8)
      g.fillRect(38, 4, 2, TS - 8)
      // Top highlight
      g.fillStyle(lighten(base, 0.25)); g.fillRect(4, 4, TS - 8, 3)
      // Bottom shadow
      g.fillStyle(darken(base, 0.35)); g.fillRect(4, TS - 7, TS - 8, 3)
      // Door handle (golden knob)
      g.fillStyle(0xc8a030)
      g.fillCircle(TS - 14, H, 4)
      g.fillStyle(0xf0d060)
      g.fillCircle(TS - 15, H - 1, 2)
      // Arch detail at top
      g.fillStyle(0x8b5a2b)
      g.fillRect(2, 2, TS - 4, 4)
      g.fillStyle(lighten(base, 0.3))
      g.fillRect(4, 2, TS - 8, 2)
    })

    // Portal textures are drawn dynamically in syncGates based on player color
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
        const x = col * TS + H
        const y = row * TS + H
        const floor = this.add.image(x, y, 'floor_a').setDepth(0)

        let wall = null
        const tile = grid[row][col]
        if (tile === 1) wall = this.add.image(x, y, 'wall_solid').setDepth(1)
        else if (tile === 2) wall = this.add.image(x, y, 'wall_soft').setDepth(1)
        else if (tile === 3) wall = this.add.image(x, y, 'gate_exit').setDepth(1)
        else if (tile === 4) wall = this.add.image(x, y, 'portal_tile').setDepth(1)

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

    if (this.mode === 'singleplayer' || this.mode === 'multiplayer') {
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
    this.syncExplosions(state, time)
    this.syncPowerups(state)
    this.syncGates(state)
    this.syncEnemies(state, delta)
    this.syncPlayers(state, delta)
    this.syncLabels(state)
    this.updateCamera(state)
  }

  // ─── SYNC GRID ─────────────────────────────────────────────────────────
  syncGrid(state) {
    const { grid } = state
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const tile = grid[row][col]
        const entry = this.tileData[row]?.[col]
        if (!entry || entry.type === tile) continue

        if (entry.wall) { entry.wall.destroy(); entry.wall = null }
        const x = col * TS + H
        const y = row * TS + H
        if (tile === 1) entry.wall = this.add.image(x, y, 'wall_solid').setDepth(1)
        else if (tile === 2) entry.wall = this.add.image(x, y, 'wall_soft').setDepth(1)
        else if (tile === 3) entry.wall = this.add.image(x, y, 'gate_exit').setDepth(1)
        else if (tile === 4) entry.wall = this.add.image(x, y, 'portal_tile').setDepth(1)
        entry.type = tile
      }
    }
  }

  // ─── SYNC BOMBS (3D sphere with fuse and spark) ────────────────────────
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

      const bx = bomb.px !== undefined ? bomb.px : bomb.x * TS
      const by = bomb.py !== undefined ? bomb.py : bomb.y * TS
      entry.gfx.setPosition(bx + H, by + H)

      // Pulse animation
      const fuseRatio = (bomb.fuseTicks || 60) / 60
      const beatPeriod = Math.max(80, 350 * fuseRatio)
      const pulse = Math.sin(time / beatPeriod * Math.PI * 2) * 0.1
      const scale = 1 + pulse

      entry.gfx.clear()
      const r = Math.floor(15 * scale)

      // Drop shadow
      entry.gfx.fillStyle(0x000000, 0.3)
      entry.gfx.fillEllipse(0, r + 2, r * 1.6, 6)

      // Main bomb body (dark sphere)
      entry.gfx.fillStyle(0x1a1a2e)
      entry.gfx.fillCircle(0, 0, r)

      // 3D shading — bottom half darker
      entry.gfx.fillStyle(0x000000, 0.3)
      entry.gfx.beginPath()
      entry.gfx.arc(0, 0, r, 0, Math.PI)
      entry.gfx.fillPath()

      // 3D highlight — top-left specular
      entry.gfx.fillStyle(0xffffff, 0.35)
      entry.gfx.fillCircle(-r * 0.3, -r * 0.35, r * 0.35)
      entry.gfx.fillStyle(0xffffff, 0.6)
      entry.gfx.fillCircle(-r * 0.25, -r * 0.4, r * 0.15)

      // Metal band around middle
      entry.gfx.fillStyle(0x555566)
      entry.gfx.fillRect(-r, -2, r * 2, 4)
      entry.gfx.fillStyle(0x888899)
      entry.gfx.fillRect(-r, -2, r * 2, 2)

      // Fuse tube
      entry.gfx.fillStyle(0x8a6a3a)
      entry.gfx.fillRect(-2, -r - 8, 4, 10)
      // Fuse rope texture
      entry.gfx.fillStyle(0x6a4a2a)
      entry.gfx.fillRect(-1, -r - 7, 2, 2)
      entry.gfx.fillRect(-1, -r - 3, 2, 2)

      // Spark glow (pulsing)
      const sparkPhase = (time % 300) / 300
      const sparkSize = 4 + Math.sin(sparkPhase * Math.PI * 2) * 3

      // Outer glow
      entry.gfx.fillStyle(0xff6600, 0.3)
      entry.gfx.fillCircle(0, -r - 10, sparkSize + 6)
      // Mid glow
      entry.gfx.fillStyle(0xffaa00, 0.6)
      entry.gfx.fillCircle(0, -r - 10, sparkSize + 2)
      // Core spark
      entry.gfx.fillStyle(0xffff88)
      entry.gfx.fillCircle(0, -r - 10, sparkSize)
      // White hot center
      entry.gfx.fillStyle(0xffffff)
      entry.gfx.fillCircle(0, -r - 10, sparkSize * 0.4)
    }

    for (const id of Object.keys(this.bombGfx)) {
      if (!activeBombIds.has(id)) {
        this.bombGfx[id].gfx.destroy()
        delete this.bombGfx[id]
      }
    }
  }

  // ─── SYNC EXPLOSIONS (smooth fiery blast) ──────────────────────────────
  syncExplosions(state, time) {
    for (const entry of this.explGfx) {
      entry.gfx.destroy()
      if (entry.glow) entry.glow.destroy()
    }
    this.explGfx = []

    for (const exp of state.explosions) {
      const progress = Math.min(1, (exp.frame || 0) / 12)
      const alpha = Math.max(0, 1 - progress * progress) // ease-out fade

      // Main blast layer
      const gfx = this.add.graphics().setDepth(4).setAlpha(alpha)
      // Additive glow layer
      const glow = this.add.graphics().setDepth(4.5).setAlpha(alpha * 0.6).setBlendMode(Phaser.BlendModes.ADD)

      // Draw smooth fire on each explosion tile
      for (const [col, row] of exp.tiles) {
        const cx = col * TS + H
        const cy = row * TS + H
        const isCenter = col === exp.centerX && row === exp.centerY
        const s = isCenter ? 1.25 : 1.0
        const expansion = 1 + progress * 0.2 // slight expansion as it fades

        // Outer red-orange fire
        gfx.fillStyle(0xcc2200, 0.6)
        gfx.fillCircle(cx, cy, 20 * s * expansion)

        // Mid orange fire
        gfx.fillStyle(0xff6600, 0.8)
        gfx.fillCircle(cx, cy, 15 * s * expansion)

        // Inner bright yellow
        gfx.fillStyle(0xffaa22, 0.9)
        gfx.fillCircle(cx, cy, 10 * s * expansion)

        // White-hot core
        gfx.fillStyle(0xffffcc)
        gfx.fillCircle(cx, cy, 5 * s)

        // Additive glow halo
        glow.fillStyle(0xff4400, 0.4)
        glow.fillCircle(cx, cy, 22 * s * expansion)
        glow.fillStyle(0xffcc00, 0.3)
        glow.fillCircle(cx, cy, 12 * s)
      }

      // Connect tiles with beams for the cross shape
      let minX = exp.centerX, maxX = exp.centerX
      let minY = exp.centerY, maxY = exp.centerY
      for (const [col, row] of exp.tiles) {
        if (row === exp.centerY) { minX = Math.min(minX, col); maxX = Math.max(maxX, col) }
        if (col === exp.centerX) { minY = Math.min(minY, row); maxY = Math.max(maxY, row) }
      }

      // Horizontal beam connector
      if (maxX > minX) {
        const y = exp.centerY * TS + H
        const x1 = minX * TS + H
        const x2 = maxX * TS + H
        gfx.fillStyle(0xff6600, 0.5)
        gfx.fillRect(x1, y - 10, x2 - x1, 20)
        gfx.fillStyle(0xffaa33, 0.7)
        gfx.fillRect(x1, y - 6, x2 - x1, 12)
        gfx.fillStyle(0xffffcc, 0.6)
        gfx.fillRect(x1, y - 3, x2 - x1, 6)
      }

      // Vertical beam connector
      if (maxY > minY) {
        const x = exp.centerX * TS + H
        const y1 = minY * TS + H
        const y2 = maxY * TS + H
        gfx.fillStyle(0xff6600, 0.5)
        gfx.fillRect(x - 10, y1, 20, y2 - y1)
        gfx.fillStyle(0xffaa33, 0.7)
        gfx.fillRect(x - 6, y1, 12, y2 - y1)
        gfx.fillStyle(0xffffcc, 0.6)
        gfx.fillRect(x - 3, y1, 6, y2 - y1)
      }

      this.explGfx.push({ gfx, glow, id: exp.id })
    }
  }

  // ─── SYNC POWERUPS ────────────────────────────────────────────────────
  syncPowerups(state) {
    const activePwKeys = new Set()
    for (const pw of state.powerupsOnMap || []) {
      const key = `${pw.x},${pw.y}`
      activePwKeys.add(key)
      if (!this.pwSprites[key]) {
        const x = pw.x * TS + H
        const y = pw.y * TS + H
        const gfx = this.add.graphics().setDepth(2).setPosition(x, y)
        const sz = TS - 10
        const half = sz / 2
        const color = PW_HEX[pw.type] || 0xffffff

        // Shadow
        gfx.fillStyle(0x000000, 0.3)
        gfx.fillRoundedRect(-half + 2, -half + 3, sz, sz, 10)
        // Background
        gfx.fillStyle(darken(color, 0.3))
        gfx.fillRoundedRect(-half, -half, sz, sz, 10)
        // Main face
        gfx.fillStyle(color)
        gfx.fillRoundedRect(-half + 2, -half + 2, sz - 4, sz - 4, 8)
        // Highlight
        gfx.fillStyle(0xffffff, 0.4)
        gfx.fillRoundedRect(-half + 4, -half + 4, sz - 8, 8, 4)
        // Inner ring
        gfx.lineStyle(1.5, 0xffffff, 0.5)
        gfx.strokeRoundedRect(-half + 6, -half + 6, sz - 12, sz - 12, 6)

        const txt = this.add.text(x, y + 1, PW_ICONS[pw.type] || '?', {
          fontSize: `${Math.floor(sz * 0.45)}px`,
          fontFamily: '"Press Start 2P", monospace',
          fontStyle: 'bold',
          color: '#111111',
        }).setOrigin(0.5).setDepth(2.5)

        this.pwSprites[key] = { gfx, txt }
      }
    }

    for (const key of Object.keys(this.pwSprites)) {
      if (!activePwKeys.has(key)) {
        this.pwSprites[key].gfx.destroy()
        this.pwSprites[key].txt.destroy()
        delete this.pwSprites[key]
      }
    }
  }

  // ─── SYNC GATES (teleport portals use player color) ────────────────────
  syncGates(state) {
    const activeGateKeys = new Set()
    // Get the current player's color
    const myPlayer = this.userId ? state.players[this.userId] : Object.values(state.players)[0]
    const playerColorName = myPlayer?.color || 'white'
    const playerColor = PLAYER_HEX[playerColorName] || 0xe8e8e8

    for (const gate of state.gates || []) {
      const key = `${gate.x},${gate.y}`
      activeGateKeys.add(key)
      const x = gate.x * TS + H
      const y = gate.y * TS + H

      // Destroy and redraw every frame for color accuracy (gates are few, cheap to redraw)
      if (this.gateGfx[key]) {
        this.gateGfx[key].gfx.destroy()
      }

      const gfx = this.add.graphics().setDepth(1.5).setPosition(x, y)
      const halfTS = H

      if (gate.open) {
        // Open portal — glowing with player color
        gfx.fillStyle(0x0a0a14); gfx.fillRect(-halfTS, -halfTS, TS, TS)
        gfx.fillStyle(playerColor, 0.2); gfx.fillCircle(0, 0, 20)
        gfx.fillStyle(playerColor, 0.4); gfx.fillCircle(0, 0, 15)
        gfx.fillStyle(lighten(playerColor, 0.4), 0.6); gfx.fillCircle(0, 0, 10)
        gfx.fillStyle(0xffffff, 0.7); gfx.fillCircle(0, 0, 5)
        // Border frame in player color
        gfx.fillStyle(playerColor)
        gfx.fillRect(-halfTS, -halfTS, TS, 3)
        gfx.fillRect(-halfTS, halfTS - 3, TS, 3)
        gfx.fillRect(-halfTS, -halfTS, 3, TS)
        gfx.fillRect(halfTS - 3, -halfTS, 3, TS)
      } else {
        // Closed portal — dimmed player color
        gfx.fillStyle(0x0a0a14); gfx.fillRect(-halfTS, -halfTS, TS, TS)
        gfx.fillStyle(darken(playerColor, 0.6), 0.3); gfx.fillCircle(0, 0, 16)
        gfx.fillStyle(darken(playerColor, 0.4), 0.4); gfx.fillCircle(0, 0, 10)
        // X mark
        gfx.fillStyle(darken(playerColor, 0.2))
        gfx.fillRect(-8, -1, 16, 2)
        gfx.fillRect(-1, -8, 2, 16)
        // Border frame dimmed
        gfx.fillStyle(darken(playerColor, 0.3))
        gfx.fillRect(-halfTS, -halfTS, TS, 3)
        gfx.fillRect(-halfTS, halfTS - 3, TS, 3)
        gfx.fillRect(-halfTS, -halfTS, 3, TS)
        gfx.fillRect(halfTS - 3, -halfTS, 3, TS)
      }

      this.gateGfx[key] = { gfx, open: gate.open }
    }

    for (const key of Object.keys(this.gateGfx)) {
      if (!activeGateKeys.has(key)) {
        this.gateGfx[key].gfx.destroy()
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

      const tx = enemy.px + H
      const ty = enemy.py + H
      const lerpAmt = Math.min(1, delta * 0.04)
      const ex = entry.gfx.x + (tx - entry.gfx.x) * lerpAmt
      const ey = entry.gfx.y + (ty - entry.gfx.y) * lerpAmt
      entry.gfx.setPosition(ex, ey)

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

    // Ground shadow
    gfx.fillStyle(0x000000, 0.25)
    gfx.fillEllipse(0, 18, 22, 7)

    if (enemy.type === 'BossBomb') {
      this._drawBoss(gfx, enemy, color, bob)
      return
    }

    // Draw unique persona based on enemy type
    switch (enemy.type) {
      case 'Ballom':
        this._drawBallom(gfx, color, bob, enemy)
        break
      case 'Oneal':
        this._drawOneal(gfx, color, bob, enemy)
        break
      case 'Dahl':
        this._drawDahl(gfx, color, bob, enemy)
        break
      case 'Minvo':
        this._drawMinvo(gfx, color, bob, enemy)
        break
      case 'Doria':
        this._drawDoria(gfx, color, bob, enemy)
        break
      case 'Ghost':
        this._drawGhost(gfx, color, bob, enemy)
        break
      case 'Rocky':
        this._drawRocky(gfx, color, bob, enemy)
        break
      case 'Blaze':
        this._drawBlaze(gfx, color, bob, enemy)
        break
      case 'Charger':
        this._drawCharger(gfx, color, bob, enemy)
        break
      case 'Slime':
      case 'MiniSlime':
        this._drawSlime(gfx, color, bob, enemy)
        break
      case 'Hopper':
        this._drawHopper(gfx, color, bob, enemy)
        break
      case 'Dragon':
        this._drawDragon(gfx, color, bob, enemy)
        break
      default:
        this._drawDefaultEnemy(gfx, color, bob, enemy)
        break
    }

    // HP bar (for multi-hp enemies)
    if (enemy.hp > 1) {
      gfx.fillStyle(0x330000, 0.8)
      gfx.fillRoundedRect(-H + 4, -H - 4, TS - 8, 5, 2)
      gfx.fillStyle(0xee2222)
      gfx.fillRoundedRect(-H + 4, -H - 4, Math.floor((TS - 8) * (enemy.hp / 2)), 5, 2)
    }
  }

  // ── CHARGER: Bull-like horns, glows when charging ──
  _drawCharger(gfx, color, bob, enemy) {
    const isCharging = enemy.isCharging
    const bodyColor = isCharging ? 0xff4444 : color
    
    // Bulky body
    gfx.fillStyle(bodyColor)
    gfx.fillRoundedRect(-14, -14 - bob, 28, 28, 6)
    
    // Horns
    gfx.fillStyle(0xddddcc)
    // Left horn
    gfx.fillTriangle(-12, -10 - bob, -20, -18 - bob, -8, -14 - bob)
    // Right horn
    gfx.fillTriangle(12, -10 - bob, 20, -18 - bob, 8, -14 - bob)

    // Angry eyes
    gfx.fillStyle(isCharging ? 0xffff00 : 0x222222)
    gfx.fillEllipse(-5, -2 - bob, 6, 4)
    gfx.fillEllipse(5, -2 - bob, 6, 4)
    gfx.fillStyle(0x000000)
    gfx.fillCircle(-5, -2 - bob, 1)
    gfx.fillCircle(5, -2 - bob, 1)
  }

  // ── SLIME & MINISLIME: Gooey blob shape ──
  _drawSlime(gfx, color, bob, enemy) {
    const scale = enemy.type === 'MiniSlime' ? 0.6 : 1
    
    gfx.fillStyle(color)
    // Bottom wide base
    gfx.fillEllipse(0, 10 - bob, 24 * scale, 12 * scale)
    // Top blob
    gfx.fillEllipse(0, 2 - bob, 18 * scale, 16 * scale)

    // Droopy eyes
    gfx.fillStyle(0x000000)
    gfx.fillCircle(-4 * scale, 2 - bob, 3 * scale)
    gfx.fillCircle(4 * scale, 2 - bob, 3 * scale)
  }

  // ── HOPPER: Frog-like legs ──
  _drawHopper(gfx, color, bob, enemy) {
    // Legs (jump up if bobbing)
    gfx.fillStyle(0x118833)
    const legY = bob === 0 ? 12 : 6
    gfx.fillEllipse(-12, legY, 8, 12)
    gfx.fillEllipse(12, legY, 8, 12)

    // Round body
    gfx.fillStyle(color)
    gfx.fillCircle(0, 0 - bob * 2, 14)

    // Big eyes on top
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(-8, -10 - bob * 2, 6)
    gfx.fillCircle(8, -10 - bob * 2, 6)
    gfx.fillStyle(0x000000)
    gfx.fillCircle(-8, -10 - bob * 2, 2)
    gfx.fillCircle(8, -10 - bob * 2, 2)
  }

  // ── DRAGON: Long snout and scales ──
  _drawDragon(gfx, color, bob, enemy) {
    const isFiring = enemy.moveTimer < 0
    const bodyColor = isFiring ? 0xffff00 : color // flashes yellow when firing

    // Body
    gfx.fillStyle(bodyColor)
    gfx.fillRoundedRect(-14, -10 - bob, 28, 24, 8)
    
    // Snout
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillRoundedRect(-8, -4 - bob, 16, 14, 4)
    
    // Nostrils
    gfx.fillStyle(0x220000)
    gfx.fillCircle(-4, 4 - bob, 2)
    gfx.fillCircle(4, 4 - bob, 2)

    // Eyes
    gfx.fillStyle(0xffffaa)
    gfx.fillEllipse(-8, -8 - bob, 6, 8)
    gfx.fillEllipse(8, -8 - bob, 6, 8)
    gfx.fillStyle(0x000000)
    gfx.fillCircle(-8, -8 - bob, 2)
    gfx.fillCircle(8, -8 - bob, 2)
    
    // Scales/Spikes on back
    gfx.fillStyle(0xffaa00)
    gfx.fillTriangle(-4, -10 - bob, 4, -10 - bob, 0, -16 - bob)
  }

  // ── BALLOM: Cute bouncing slime blob ──
  _drawBallom(gfx, color, bob, enemy) {
    const squish = bob > 0 ? 0.85 : 1.0
    // Jiggly body
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillEllipse(0, bob + 2, 14, 12 * squish)
    gfx.fillStyle(color)
    gfx.fillEllipse(0, bob, 13, 11 * squish)
    // Shine blob
    gfx.fillStyle(lighten(color, 0.5), 0.5)
    gfx.fillEllipse(-4, bob - 4, 5, 4)
    gfx.fillStyle(0xffffff, 0.4)
    gfx.fillCircle(-3, bob - 5, 2)
    // Cute dot eyes
    gfx.fillStyle(0x111122)
    gfx.fillCircle(-4, bob, 2.5)
    gfx.fillCircle(4, bob, 2.5)
    gfx.fillStyle(0xffffff, 0.8)
    gfx.fillCircle(-5, bob - 1, 1)
    gfx.fillCircle(3, bob - 1, 1)
    // Happy mouth
    gfx.lineStyle(1.5, darken(color, 0.5))
    gfx.beginPath()
    gfx.arc(0, bob + 3, 3, 0.2, Math.PI - 0.2)
    gfx.strokePath()
    // Feet bumps
    gfx.fillStyle(darken(color, 0.3))
    gfx.fillEllipse(-5, 14 + bob, 4, 3)
    gfx.fillEllipse(5, 14 + bob, 4, 3)
  }

  // ── ONEAL: Aggressive with horns ──
  _drawOneal(gfx, color, bob, enemy) {
    // Body
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillCircle(0, bob + 1, 13)
    gfx.fillStyle(color)
    gfx.fillCircle(0, bob, 12)
    gfx.fillStyle(lighten(color, 0.3), 0.4)
    gfx.fillCircle(-3, bob - 4, 5)
    // Horns
    gfx.fillStyle(darken(color, 0.4))
    gfx.fillTriangle(-8, bob - 10, -12, bob - 18, -4, bob - 12)
    gfx.fillTriangle(8, bob - 10, 12, bob - 18, 4, bob - 12)
    gfx.fillStyle(lighten(color, 0.2))
    gfx.fillTriangle(-7, bob - 10, -11, bob - 16, -5, bob - 12)
    gfx.fillTriangle(7, bob - 10, 11, bob - 16, 5, bob - 12)
    // Angry eyes
    this._drawEnemyEyes(gfx, bob, enemy, 0xffcc00, true)
    // Fanged mouth
    gfx.fillStyle(0x220000)
    gfx.fillRoundedRect(-5, bob + 4, 10, 4, 2)
    gfx.fillStyle(0xffffff)
    gfx.fillTriangle(-3, bob + 4, -1, bob + 7, -5, bob + 7)
    gfx.fillTriangle(3, bob + 4, 1, bob + 7, 5, bob + 7)
    // Feet
    gfx.fillStyle(darken(color, 0.35))
    gfx.fillEllipse(-5, 14 + bob, 5, 4)
    gfx.fillEllipse(5, 14 + bob, 5, 4)
  }

  // ── DAHL: Spiky ball ──
  _drawDahl(gfx, color, bob, enemy) {
    // Spikes around body
    const spikeCount = 8
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 + (bob > 0 ? 0.1 : 0)
      const sx = Math.cos(angle) * 16
      const sy = Math.sin(angle) * 16 + bob
      gfx.fillStyle(darken(color, 0.3))
      gfx.fillTriangle(
        Math.cos(angle) * 8, Math.sin(angle) * 8 + bob,
        sx + Math.cos(angle + 0.3) * 3, sy + Math.sin(angle + 0.3) * 3,
        sx + Math.cos(angle - 0.3) * 3, sy + Math.sin(angle - 0.3) * 3
      )
    }
    // Round body
    gfx.fillStyle(darken(color, 0.15))
    gfx.fillCircle(0, bob + 1, 11)
    gfx.fillStyle(color)
    gfx.fillCircle(0, bob, 10)
    gfx.fillStyle(lighten(color, 0.4), 0.5)
    gfx.fillCircle(-3, bob - 3, 4)
    // Beady eyes
    gfx.fillStyle(0xffffff)
    gfx.fillCircle(-4, bob - 1, 3)
    gfx.fillCircle(4, bob - 1, 3)
    gfx.fillStyle(0x111122)
    gfx.fillCircle(-4, bob, 2)
    gfx.fillCircle(4, bob, 2)
  }

  // ── MINVO: Ninja with bandana ──
  _drawMinvo(gfx, color, bob, enemy) {
    // Body
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillCircle(0, bob + 1, 12)
    gfx.fillStyle(color)
    gfx.fillCircle(0, bob, 11)
    gfx.fillStyle(lighten(color, 0.3), 0.3)
    gfx.fillCircle(-3, bob - 4, 4)
    // Bandana
    gfx.fillStyle(0xcc2020)
    gfx.fillRoundedRect(-13, bob - 6, 26, 5, 2)
    // Bandana tails
    gfx.fillStyle(0xaa1818)
    gfx.fillTriangle(11, bob - 4, 16, bob - 8, 14, bob - 2)
    gfx.fillTriangle(13, bob - 4, 18, bob - 6, 16, bob - 1)
    // Narrow determined eyes
    gfx.fillStyle(0xffffff)
    gfx.fillRoundedRect(-7, bob - 2, 5, 3, 1)
    gfx.fillRoundedRect(2, bob - 2, 5, 3, 1)
    gfx.fillStyle(0x111122)
    gfx.fillCircle(-4, bob - 1, 1.5)
    gfx.fillCircle(5, bob - 1, 1.5)
    // Feet
    gfx.fillStyle(darken(color, 0.4))
    gfx.fillEllipse(-4, 13 + bob, 4, 3)
    gfx.fillEllipse(4, 13 + bob, 4, 3)
  }

  // ── DORIA: Jellyfish with tentacles ──
  _drawDoria(gfx, color, bob, enemy) {
    // Dome body
    gfx.fillStyle(darken(color, 0.15))
    gfx.fillEllipse(0, bob - 2, 14, 10)
    gfx.fillStyle(color, 0.85)
    gfx.fillEllipse(0, bob - 2, 13, 9)
    gfx.fillStyle(lighten(color, 0.5), 0.4)
    gfx.fillEllipse(-3, bob - 5, 5, 3)
    // Tentacles (wavy)
    const wave = bob > 0 ? 2 : -2
    gfx.fillStyle(darken(color, 0.1), 0.7)
    for (let i = -2; i <= 2; i++) {
      const tx = i * 5
      gfx.fillRoundedRect(tx - 1, bob + 6, 2, 10, 1)
      gfx.fillCircle(tx + (i % 2 === 0 ? wave : -wave), bob + 15, 2)
    }
    // Eyes
    gfx.fillStyle(0xffffff, 0.9)
    gfx.fillCircle(-4, bob - 2, 3)
    gfx.fillCircle(4, bob - 2, 3)
    gfx.fillStyle(0x220044)
    gfx.fillCircle(-4, bob - 1, 2)
    gfx.fillCircle(4, bob - 1, 2)
  }

  // ── GHOST: Translucent floating spirit ──
  _drawGhost(gfx, color, bob, enemy) {
    const floatBob = bob - 3
    // Ghost body (tall, wispy)
    gfx.fillStyle(color, 0.4)
    gfx.fillEllipse(0, floatBob, 13, 14)
    gfx.fillStyle(lighten(color, 0.3), 0.5)
    gfx.fillEllipse(0, floatBob - 2, 11, 11)
    gfx.fillStyle(0xffffff, 0.3)
    gfx.fillCircle(-3, floatBob - 5, 4)
    // Wispy tail
    gfx.fillStyle(color, 0.25)
    gfx.fillTriangle(-8, floatBob + 10, 0, floatBob + 18, 8, floatBob + 10)
    gfx.fillTriangle(-5, floatBob + 12, -2, floatBob + 20, 1, floatBob + 12)
    gfx.fillTriangle(2, floatBob + 12, 5, floatBob + 20, 8, floatBob + 12)
    // Hollow eyes
    gfx.fillStyle(0x111133, 0.8)
    gfx.fillEllipse(-4, floatBob - 1, 4, 5)
    gfx.fillEllipse(4, floatBob - 1, 4, 5)
    // Eerie glow pupils
    gfx.fillStyle(0x88aaff, 0.8)
    gfx.fillCircle(-4, floatBob, 1.5)
    gfx.fillCircle(4, floatBob, 1.5)
    // Open mouth
    gfx.fillStyle(0x111133, 0.6)
    gfx.fillEllipse(0, floatBob + 5, 3, 4)
  }

  // ── ROCKY: Stone golem, blocky shape ──
  _drawRocky(gfx, color, bob, enemy) {
    // Blocky body
    gfx.fillStyle(darken(color, 0.3))
    gfx.fillRoundedRect(-12, bob - 10, 24, 22, 4)
    gfx.fillStyle(color)
    gfx.fillRoundedRect(-11, bob - 9, 22, 20, 3)
    // Cracks
    gfx.lineStyle(1, darken(color, 0.4), 0.5)
    gfx.beginPath()
    gfx.moveTo(-5, bob - 8); gfx.lineTo(-2, bob - 2); gfx.lineTo(-6, bob + 4)
    gfx.strokePath()
    gfx.beginPath()
    gfx.moveTo(4, bob - 6); gfx.lineTo(7, bob + 1); gfx.lineTo(3, bob + 6)
    gfx.strokePath()
    // Highlight
    gfx.fillStyle(lighten(color, 0.25), 0.4)
    gfx.fillRoundedRect(-9, bob - 8, 8, 6, 2)
    // Small determined eyes
    gfx.fillStyle(0xffffff)
    gfx.fillRoundedRect(-7, bob - 3, 5, 4, 1)
    gfx.fillRoundedRect(2, bob - 3, 5, 4, 1)
    gfx.fillStyle(0x111122)
    gfx.fillCircle(-5, bob - 1, 2)
    gfx.fillCircle(4, bob - 1, 2)
    // Thick feet
    gfx.fillStyle(darken(color, 0.4))
    gfx.fillRoundedRect(-10, bob + 10, 8, 6, 2)
    gfx.fillRoundedRect(2, bob + 10, 8, 6, 2)
  }

  // ── BLAZE: Fire elemental ──
  _drawBlaze(gfx, color, bob, enemy) {
    // Flame body
    const flicker = bob > 0 ? 1 : -1
    gfx.fillStyle(0xff2200, 0.3)
    gfx.fillCircle(flicker, bob - 2, 16)
    gfx.fillStyle(color, 0.7)
    gfx.fillCircle(0, bob, 12)
    gfx.fillStyle(0xffaa00, 0.6)
    gfx.fillCircle(0, bob + 1, 9)
    gfx.fillStyle(0xffdd44, 0.5)
    gfx.fillCircle(0, bob + 2, 5)
    // Flame tips
    gfx.fillStyle(0xff4400, 0.5)
    gfx.fillTriangle(-6, bob - 8, -2 + flicker, bob - 18, 2, bob - 8)
    gfx.fillTriangle(3, bob - 6, 6 + flicker, bob - 15, 9, bob - 6)
    gfx.fillTriangle(-9, bob - 4, -7 + flicker, bob - 13, -4, bob - 4)
    gfx.fillStyle(0xffaa00, 0.4)
    gfx.fillTriangle(-4, bob - 8, 0 + flicker, bob - 16, 4, bob - 8)
    // Eyes (white hot)
    gfx.fillStyle(0xffffff, 0.9)
    gfx.fillCircle(-4, bob - 1, 3)
    gfx.fillCircle(4, bob - 1, 3)
    gfx.fillStyle(0xff0000)
    gfx.fillCircle(-4, bob, 1.5)
    gfx.fillCircle(4, bob, 1.5)
  }

  // ── DEFAULT: Generic enemy (for types without unique art) ──
  _drawDefaultEnemy(gfx, color, bob, enemy) {
    const r = enemy.type === 'Titan' ? 16 : 13
    // Body
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillCircle(0, bob + 1, r)
    gfx.fillStyle(color)
    gfx.fillCircle(0, bob, r)
    gfx.fillStyle(darken(color, 0.35), 0.5)
    gfx.beginPath(); gfx.arc(0, bob, r, 0.2, Math.PI - 0.2); gfx.fillPath()
    gfx.fillStyle(lighten(color, 0.4), 0.5)
    gfx.fillCircle(-r * 0.25, bob - r * 0.35, r * 0.4)
    // Eyes
    this._drawEnemyEyes(gfx, bob, enemy)
    // Mouth
    gfx.fillStyle(darken(color, 0.5))
    gfx.fillRoundedRect(-4, bob + 5, 8, 3, 1.5)
    // Feet
    gfx.fillStyle(darken(color, 0.35))
    gfx.fillEllipse(-5, r + bob, 5, 4)
    gfx.fillEllipse(5, r + bob, 5, 4)
  }

  // Helper: draw enemy eyes with directional tracking
  _drawEnemyEyes(gfx, bob, enemy, pupilColor = 0x111122, angry = false) {
    let epx = 0, epy = -2
    if (enemy.dir === 'left') epx = -2
    else if (enemy.dir === 'right') epx = 2
    else if (enemy.dir === 'up') epy = -4
    else if (enemy.dir === 'down') epy = 0

    gfx.fillStyle(0xfafafa)
    gfx.fillEllipse(epx - 5, epy + bob, 5, angry ? 5 : 6)
    gfx.fillEllipse(epx + 5, epy + bob, 5, angry ? 5 : 6)
    if (angry) {
      // Angry eyebrow slashes
      gfx.fillStyle(0x111122, 0.7)
      gfx.fillRect(epx - 8, epy + bob - 5, 7, 2)
      gfx.fillRect(epx + 1, epy + bob - 5, 7, 2)
    }
    gfx.fillStyle(pupilColor)
    gfx.fillCircle(epx - 5 + (epx > 0 ? 1 : epx < 0 ? -1 : 0), epy + bob + 1, 2.5)
    gfx.fillCircle(epx + 5 + (epx > 0 ? 1 : epx < 0 ? -1 : 0), epy + bob + 1, 2.5)
    gfx.fillStyle(0xffffff, 0.8)
    gfx.fillCircle(epx - 6, epy + bob - 1, 1)
    gfx.fillCircle(epx + 4, epy + bob - 1, 1)
  }

  _drawBoss(gfx, enemy, color, bob) {
    // Boss body
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillCircle(0, bob + 1, 18)
    gfx.fillStyle(color)
    gfx.fillCircle(0, bob, 17)
    gfx.fillStyle(lighten(color, 0.3), 0.4)
    gfx.fillCircle(-5, bob - 6, 7)
    gfx.fillStyle(0x000000, 0.2)
    gfx.beginPath(); gfx.arc(0, bob, 17, 0, Math.PI); gfx.fillPath()

    // Crown
    gfx.fillStyle(0xf0c040)
    gfx.fillRect(-10, -20 + bob, 20, 6)
    gfx.fillStyle(0xffdd66)
    for (let i = -1; i <= 1; i++) gfx.fillCircle(i * 7, -22 + bob, 4)
    gfx.fillStyle(0xff4444)
    gfx.fillCircle(0, -18 + bob, 2.5)

    // Eyes
    gfx.fillStyle(0xffffff)
    gfx.fillEllipse(-7, -2 + bob, 6, 7)
    gfx.fillEllipse(7, -2 + bob, 6, 7)
    gfx.fillStyle(0xcc0000)
    gfx.fillCircle(-7, -1 + bob, 3)
    gfx.fillCircle(7, -1 + bob, 3)
    gfx.fillStyle(0xffffff, 0.7)
    gfx.fillCircle(-8, -3 + bob, 1.5)
    gfx.fillCircle(6, -3 + bob, 1.5)

    // HP bar
    gfx.fillStyle(0x330000, 0.8)
    gfx.fillRoundedRect(-H + 2, -H - 6, TS - 4, 6, 3)
    gfx.fillStyle(0xee0000)
    gfx.fillRoundedRect(-H + 2, -H - 6, Math.floor((TS - 4) * (enemy.hp / 5)), 6, 3)
    gfx.fillStyle(0xff6666, 0.5)
    gfx.fillRoundedRect(-H + 2, -H - 6, Math.floor((TS - 4) * (enemy.hp / 5)), 3, 3)
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

      const tx = player.px + H
      const ty = player.py + H
      const lerpAmt = Math.min(1, delta * 0.015)
      const px = entry.gfx.x + (tx - entry.gfx.x) * lerpAmt
      const py = entry.gfx.y + (ty - entry.gfx.y) * lerpAmt
      entry.gfx.setPosition(px, py)
      entry.nameText.setPosition(px, py - H - 4)

      if (!player.alive) {
        const df = player.deathFrame || 0
        const scale = Math.max(0, 1 - df / 18)
        entry.gfx.setScale(scale).setAlpha(scale).setRotation((df / 18) * Math.PI * 2)
      } else {
        entry.gfx.setScale(1).setRotation(0)
        let alpha = 1
        if (player.wallPassTimer > 0) alpha = 0.55
        // Blink rapidly when shield is active (invincibility after respawn)
        if (player.shieldTimer > 0) {
          const blink = Math.sin(Date.now() / 80 * Math.PI) > 0 ? 1.0 : 0.25
          alpha = blink
        }
        entry.gfx.setAlpha(alpha)
      }

      this._drawPlayer(entry.gfx, player)
    }

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
    const bob = frame === 0 ? 0 : 2
    const legOff = frame === 0 ? 0 : 2

    // ── GROUND SHADOW ──
    gfx.fillStyle(0x000000, 0.25)
    gfx.fillEllipse(0, 18, 22, 7)

    // ── LEGS (behind body) ──
    const legColor = darken(color, 0.35)
    gfx.fillStyle(legColor)
    gfx.fillRoundedRect(-8, 10 + bob, 7, 6 + (frame === 0 ? 0 : -legOff), 3)
    gfx.fillRoundedRect(1, 10 + bob, 7, 6 + (frame === 0 ? 0 : legOff), 3)
    // Shoes
    gfx.fillStyle(darken(color, 0.5))
    gfx.fillRoundedRect(-9, 14 + bob + (frame === 0 ? 0 : -legOff), 8, 4, 2)
    gfx.fillRoundedRect(1, 14 + bob + (frame === 0 ? 0 : legOff), 8, 4, 2)

    // ── BODY (3D torso) ──
    // Body shadow
    gfx.fillStyle(darken(color, 0.3))
    gfx.fillRoundedRect(-10, -1 + bob, 20, 14, 5)
    // Main body
    gfx.fillStyle(color)
    gfx.fillRoundedRect(-9, -2 + bob, 18, 13, 5)
    // Body highlight (top)
    gfx.fillStyle(lighten(color, 0.25), 0.5)
    gfx.fillRoundedRect(-7, -1 + bob, 14, 5, 3)
    // Body shading (bottom)
    gfx.fillStyle(darken(color, 0.15), 0.4)
    gfx.fillRect(-9, 6 + bob, 18, 5)

    // Belt buckle
    gfx.fillStyle(0xf0c040)
    gfx.fillRoundedRect(-3, 5 + bob, 6, 4, 2)
    gfx.fillStyle(0xffdd66)
    gfx.fillRect(-2, 6 + bob, 4, 2)

    // ── ARMS ──
    const armColor = lighten(color, 0.05)
    if (player.dir === 'left') {
      gfx.fillStyle(armColor)
      gfx.fillRoundedRect(-13, 0 + bob, 6, 10, 3)
      gfx.fillRoundedRect(4, 1 + bob, 6, 9, 3)
    } else if (player.dir === 'right') {
      gfx.fillStyle(armColor)
      gfx.fillRoundedRect(-10, 1 + bob, 6, 9, 3)
      gfx.fillRoundedRect(7, 0 + bob, 6, 10, 3)
    } else {
      gfx.fillStyle(armColor)
      gfx.fillRoundedRect(-13, 0 + bob, 6, 10, 3)
      gfx.fillRoundedRect(7, 0 + bob, 6, 10, 3)
    }
    // Gloves
    gfx.fillStyle(0xeeeeee)
    if (player.dir === 'left') {
      gfx.fillCircle(-10, 10 + bob, 3.5)
      gfx.fillCircle(7, 10 + bob, 3.5)
    } else if (player.dir === 'right') {
      gfx.fillCircle(-7, 10 + bob, 3.5)
      gfx.fillCircle(10, 10 + bob, 3.5)
    } else {
      gfx.fillCircle(-10, 10 + bob, 3.5)
      gfx.fillCircle(10, 10 + bob, 3.5)
    }

    // ── HEAD (3D helmet) ──
    // Helmet shadow
    gfx.fillStyle(0xcccccc)
    gfx.fillRoundedRect(-11, -19 + bob, 22, 18, 9)
    // Helmet main
    gfx.fillStyle(0xf0f0f0)
    gfx.fillRoundedRect(-10, -20 + bob, 20, 17, 8)
    // Helmet highlight (3D gloss)
    gfx.fillStyle(0xffffff, 0.7)
    gfx.fillRoundedRect(-8, -19 + bob, 12, 6, 4)
    gfx.fillStyle(0xffffff, 0.9)
    gfx.fillCircle(-4, -16 + bob, 2.5)

    // Color stripe on helmet
    gfx.fillStyle(color)
    gfx.fillRoundedRect(-8, -9 + bob, 16, 4, 2)

    // ── VISOR (dark screen) ──
    gfx.fillStyle(0x0a0a1a)
    gfx.fillRoundedRect(-7, -16 + bob, 14, 9, 4)
    // Visor glass sheen
    gfx.fillStyle(0x334455, 0.3)
    gfx.fillRoundedRect(-6, -15 + bob, 12, 4, 2)

    // ── EYES (in visor) ──
    const eyeColor = lighten(color, 0.5)
    if (player.dir === 'up') {
      // Facing away — show helmet back
      gfx.fillStyle(0xdddddd)
      gfx.fillRoundedRect(-6, -15 + bob, 12, 8, 3)
    } else if (player.dir === 'left') {
      gfx.fillStyle(eyeColor)
      gfx.fillCircle(-4, -11 + bob, 2.5)
      gfx.fillCircle(-1, -12 + bob, 2)
      gfx.fillStyle(0xffffff, 0.8)
      gfx.fillCircle(-5, -12 + bob, 1)
    } else if (player.dir === 'right') {
      gfx.fillStyle(eyeColor)
      gfx.fillCircle(4, -11 + bob, 2.5)
      gfx.fillCircle(1, -12 + bob, 2)
      gfx.fillStyle(0xffffff, 0.8)
      gfx.fillCircle(3, -12 + bob, 1)
    } else {
      gfx.fillStyle(eyeColor)
      gfx.fillCircle(-3, -11 + bob, 2.5)
      gfx.fillCircle(3, -11 + bob, 2.5)
      gfx.fillStyle(0xffffff, 0.8)
      gfx.fillCircle(-4, -12 + bob, 1)
      gfx.fillCircle(2, -12 + bob, 1)
    }

    // ── ANTENNA ──
    gfx.fillStyle(0x888888)
    gfx.fillRect(-1, -23 + bob, 2, 5)
    gfx.fillStyle(color)
    gfx.fillCircle(0, -24 + bob, 3)
    gfx.fillStyle(lighten(color, 0.4))
    gfx.fillCircle(-1, -25 + bob, 1.5)

    // ── EFFECTS ──
    if (player.skullEffect) {
      gfx.fillStyle(0xff0000, 0.2)
      gfx.fillCircle(0, bob - 2, 20)
      gfx.lineStyle(1.5, 0xff0000, 0.4)
      gfx.strokeCircle(0, bob - 2, 20)
    }

    if (player.shieldTimer > 0) {
      gfx.lineStyle(2, 0x44aaff, 0.7)
      gfx.strokeCircle(0, bob - 2, 22)
      gfx.fillStyle(0x4488ff, 0.12)
      gfx.fillCircle(0, bob - 2, 22)
      // Shield sparkle
      gfx.fillStyle(0xffffff, 0.5)
      gfx.fillCircle(-14, bob - 10, 2)
      gfx.fillCircle(12, bob + 4, 1.5)
    }
  }

  // ─── SYNC FLOAT LABELS ────────────────────────────────────────────────
  syncLabels(state) {
    for (const t of this.labelTexts) t.destroy()
    this.labelTexts = []

    for (const label of state.floatLabels || []) {
      const progress = 1 - (label.timer || 0) / 40
      const lx = label.x * TS + H
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
    const myPlayer = this.userId
      ? state.players[this.userId]
      : Object.values(state.players)[0]

    if (myPlayer && myPlayer.alive) {
      this.camTarget.x = myPlayer.px + H
      this.camTarget.y = myPlayer.py + H

      if (this.mode === 'multiplayer' && state.zoneWidth) {
        const zoneStartX = myPlayer.zone * (state.zoneWidth + state.dividerWidth) * TS
        const totalHeight = state.grid.length * TS
        const totalWidth = state.zoneWidth * TS
        this.cameras.main.setBounds(zoneStartX, 0, totalWidth, totalHeight)
      }
    }
  }
}

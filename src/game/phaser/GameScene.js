// ============================================================
// Phaser 3 GameScene — Premium 3D-style renderer
// WebGL-accelerated, camera-follow, smooth interpolation
// ============================================================
import Phaser from 'phaser'

const TS = 48 // tile size (matches physics space)
const H = TS / 2

// Player drone color variants
const PLAYER_HEX = {
  red: 0xff2244, blue: 0x2288ff, green: 0x00e87a,
  yellow: 0xffcc00, purple: 0xcc44ff, orange: 0xff7720,
  white: 0xdde8ff,
}

// Alien entity color palette
const ENEMY_HEX = {
  Ballom: 0xff3366, Oneal: 0xff8800, Dahl: 0x00cc66,
  Minvo: 0xffcc00, Doria: 0xcc44ff, Ovapi: 0x44aaff,
  Pass: 0x00ffee, Pontan: 0xff44dd, Nail: 0xff6644,
  Zael: 0x88ff44, Coin: 0xffdd44, Hurry: 0xff2244,
  Rocky: 0x8899aa, Smoky: 0xaabbcc, Ghost: 0x88aaff,
  Blaze: 0xff4400, Titan: 0x8844ee, Mimic: 0x44ddaa,
  Skuller: 0x6622cc, BossBomb: 0xff0044,
  Charger: 0xff2233, Slime: 0x44ff88, MiniSlime: 0x88ffaa, Hopper: 0x22dd66,
  Dragon: 0xff5500,
}

// Powerup neon palette
const PW_HEX = {
  extrabomb: 0xffcc00, fireup: 0xff4400, speedup: 0x00ff88,
  kick: 0xff8800, remote: 0x8888ff, bombpass: 0xaabbcc,
  wallpass: 0x88ffbb, fullfire: 0xff2200, skull: 0xcc0044,
  clock: 0x00ccff, mystery: 0xff44ff, gatebomb: 0xffaa00,
  shield: 0x44aaff, decoy: 0xff88ff, blockitem: 0x8899aa, swap: 0x00ffcc,
  egg: 0xffddaa,
}

// Powerup icons (sci-fi themed labels)
const PW_ICONS = {
  extrabomb: '+B', fireup: '+F', speedup: '+S', kick: 'KK', remote: 'RD',
  bombpass: 'BP', wallpass: 'WP', fullfire: 'MAX', skull: '☠', clock: '+T',
  mystery: '?!', gatebomb: 'GB', shield: '◈', decoy: 'DC', blockitem: '■', swap: '⇄',
  egg: '◉',
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

  // ─── TEXTURE GENERATION (NOVA STRIKE — Sci-Fi Cyberpunk Arena) ─────────────
  genTextures() {
    // ── FLOOR ── Deep space energy grid
    this._tex('floor_a', (g) => {
      // Base — deep void
      g.fillStyle(0x07071a); g.fillRect(0, 0, TS, TS)
      // Hexagonal grid pattern (alternating cells)
      g.fillStyle(0x0d0d28); g.fillRect(0, 0, TS, TS)
      // Grid crosshairs
      g.fillStyle(0x1a2060, 0.7)
      g.fillRect(0, H-1, TS, 1)
      g.fillRect(H-1, 0, 1, TS)
      // Energy node at center intersection
      g.fillStyle(0x2030aa, 0.4); g.fillCircle(H, H, 3)
      g.fillStyle(0x4060ff, 0.2); g.fillCircle(H, H, 6)
      // Corner accent dots
      g.fillStyle(0x2040cc, 0.35)
      g.fillRect(0, 0, 2, 2); g.fillRect(TS-2, 0, 2, 2)
      g.fillRect(0, TS-2, 2, 2); g.fillRect(TS-2, TS-2, 2, 2)
    })

    // ── SOLID WALL ── Crystalline energy barrier
    this._tex('wall_solid', (g) => {
      // Dark base
      g.fillStyle(0x060616); g.fillRect(0, 0, TS, TS)
      // Crystal body — teal/cyan
      g.fillStyle(0x0d2a3a); g.fillRect(2, 2, TS-4, TS-4)
      // Crystal faces (lighter planes)
      g.fillStyle(0x1a4858); g.fillRect(4, 4, TS-8, TS-8)
      // Top crystal face (bright)
      g.fillStyle(0x2a7090); g.fillRect(5, 5, TS-10, 10)
      // Diagonal crystal edge
      g.fillStyle(0x3090b0); g.fillRect(5, 5, 8, TS-10)
      // Glow core
      g.fillStyle(0x00d4ff, 0.08); g.fillRect(8, 8, TS-16, TS-16)
      g.fillStyle(0x00d4ff, 0.15); g.fillRect(10, 10, TS-20, TS-20)
      // Neon outline
      g.lineStyle(1, 0x00aaff, 0.5)
      g.strokeRect(2, 2, TS-4, TS-4)
      // Corner energy sparks
      g.fillStyle(0x00ffff, 0.5)
      g.fillRect(2, 2, 4, 2); g.fillRect(2, 2, 2, 4)
      g.fillRect(TS-6, 2, 4, 2); g.fillRect(TS-4, 2, 2, 4)
      g.fillRect(2, TS-4, 4, 2); g.fillRect(2, TS-6, 2, 4)
      g.fillRect(TS-6, TS-4, 4, 2); g.fillRect(TS-4, TS-6, 2, 4)
      // Top neon edge
      g.fillStyle(0x00d4ff, 0.3); g.fillRect(2, 2, TS-4, 1)
      g.fillStyle(0x00d4ff, 0.15); g.fillRect(2, TS-3, TS-4, 1)
    })

    // ── SOFT WALL ── Destructible alien bio-crystal
    this._tex('wall_soft', (g) => {
      // Dark base
      g.fillStyle(0x100618); g.fillRect(0, 0, TS, TS)
      // Bio-organic body
      g.fillStyle(0x25103a); g.fillRect(2, 2, TS-4, TS-4)
      // Inner panels
      g.fillStyle(0x38185a); g.fillRect(4, 4, TS-8, TS-8)
      // Top lighter face
      g.fillStyle(0x50228a); g.fillRect(5, 5, TS-10, 9)
      // Side crystal
      g.fillStyle(0x3d1870); g.fillRect(5, 14, 8, TS-18)
      // Glowing core (magenta/violet)
      g.fillStyle(0xcc44ff, 0.12); g.fillRect(9, 9, TS-18, TS-18)
      g.fillStyle(0xaa22dd, 0.2); g.fillRect(12, 12, TS-24, TS-24)
      // Neon magenta border
      g.lineStyle(1, 0xcc00ff, 0.5)
      g.strokeRect(2, 2, TS-4, TS-4)
      // Corner energy sparks
      g.fillStyle(0xff44ff, 0.6)
      g.fillRect(2, 2, 4, 2); g.fillRect(2, 2, 2, 4)
      g.fillRect(TS-6, 2, 4, 2); g.fillRect(TS-4, 2, 2, 4)
      g.fillRect(2, TS-4, 4, 2); g.fillRect(2, TS-6, 2, 4)
      g.fillRect(TS-6, TS-4, 4, 2); g.fillRect(TS-4, TS-6, 2, 4)
      // Top edge glow
      g.fillStyle(0xcc00ff, 0.35); g.fillRect(2, 2, TS-4, 1)
    })

    // ── EXIT GATE ── Warp portal
    this._tex('gate_exit', (g) => {
      g.fillStyle(0x030310); g.fillRect(0, 0, TS, TS)
      // Outer rings — gold
      g.fillStyle(0x1a1400); g.fillRect(3, 3, TS-6, TS-6)
      g.fillStyle(0xf0c040, 0.1); g.fillCircle(H, H, 22)
      g.fillStyle(0xf0c040, 0.2); g.fillCircle(H, H, 18)
      g.fillStyle(0xffd700, 0.35); g.fillCircle(H, H, 13)
      g.fillStyle(0xffe566, 0.6); g.fillCircle(H, H, 8)
      g.fillStyle(0xfff5aa, 0.9); g.fillCircle(H, H, 4)
      g.fillStyle(0xffffff); g.fillCircle(H, H, 2)
      // Border
      g.fillStyle(0xf0c040, 0.5)
      g.fillRect(0, 0, TS, 2); g.fillRect(0, TS-2, TS, 2)
      g.fillRect(0, 0, 2, TS); g.fillRect(TS-2, 0, 2, TS)
    })

    // Portal textures are drawn dynamically in syncGates
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

  // ─── SYNC BOMBS (Plasma Charge Orb) ──────────────────────────────────────────────
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

      // Plasma pulse — faster as it charges to detonate
      const fuseRatio = Math.max(0, Math.min(1, (bomb.fuseTicks || 60) / 60))
      const pulseSpeed = 1 + (1 - fuseRatio) * 4
      const pulse = Math.sin(time / 160 * pulseSpeed * Math.PI) * 0.12
      const scale = 1 + pulse

      entry.gfx.clear()
      const r = Math.floor(13 * scale)

      // Soft ground shadow
      entry.gfx.fillStyle(0x0000ff, 0.12)
      entry.gfx.fillEllipse(1, r + 5, r * 2.2, 8)

      // Danger glow rings (cyan → red as fuse burns)
      const danger = 1 - fuseRatio // 0=safe, 1=about to blow
      const glowR = Math.floor(0x00 + 0xff * danger)
      const glowB = Math.floor(0xff * (1 - danger * 0.6))
      const glowColor = (glowR << 16) | 0x0000 | glowB

      // Outer plasma aura
      entry.gfx.fillStyle(glowColor, 0.06)
      entry.gfx.fillCircle(0, 0, r + 12)
      entry.gfx.fillStyle(glowColor, 0.12)
      entry.gfx.fillCircle(0, 0, r + 7)
      entry.gfx.fillStyle(glowColor, 0.22)
      entry.gfx.fillCircle(0, 0, r + 3)

      // Outer energy shell
      entry.gfx.lineStyle(1.5, glowColor, 0.8)
      entry.gfx.strokeCircle(0, 0, r + 2)

      // Core plasma sphere (dark center with luminous center)
      entry.gfx.fillStyle(0x080820)
      entry.gfx.fillCircle(0, 0, r)

      // Inner energy swirl (blue → purple gradient effect)
      entry.gfx.fillStyle(0x1020aa, 0.6)
      entry.gfx.fillCircle(0, 0, r - 2)
      entry.gfx.fillStyle(0x2040ee, 0.5)
      entry.gfx.fillCircle(-1, -1, r - 4)
      entry.gfx.fillStyle(0x6688ff, 0.4)
      entry.gfx.fillCircle(-2, -2, r - 6)

      // Hot plasma core
      entry.gfx.fillStyle(glowColor, 0.8)
      entry.gfx.fillCircle(0, 0, 4 * scale)
      entry.gfx.fillStyle(0xffffff, 0.9)
      entry.gfx.fillCircle(0, 0, 2 * scale)

      // Specular gloss
      entry.gfx.fillStyle(0xffffff, 0.4)
      entry.gfx.fillCircle(-r * 0.3, -r * 0.3, r * 0.22)
      entry.gfx.fillStyle(0xffffff, 0.7)
      entry.gfx.fillCircle(-r * 0.25, -r * 0.35, r * 0.1)

      // Energy arcs (3 small sparks orbiting)
      const arcT = time / 500
      for (let i = 0; i < 3; i++) {
        const angle = arcT * Math.PI * 2 + (i * Math.PI * 2 / 3)
        const ax = Math.cos(angle) * (r + 4)
        const ay = Math.sin(angle) * (r + 4)
        entry.gfx.fillStyle(glowColor, 0.9)
        entry.gfx.fillCircle(ax, ay, 2)
        entry.gfx.fillStyle(0xffffff)
        entry.gfx.fillCircle(ax, ay, 0.8)
      }
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

      // Draw electric plasma on each tile
      for (const [col, row] of exp.tiles) {
        const cx = col * TS + H
        const cy = row * TS + H
        const isCenter = col === exp.centerX && row === exp.centerY
        const s = isCenter ? 1.4 : 1.0
        const expand = 1 + progress * 0.4

        // Floor scorch
        gfx.fillStyle(0x000000, 0.5)
        gfx.fillCircle(cx, cy, 22 * s)

        // Outer discharge ring (deep purple)
        gfx.fillStyle(0x330066, 0.5)
        gfx.fillCircle(cx, cy, 22 * s * expand)

        // Mid plasma (electric violet)
        gfx.fillStyle(0x6600cc, 0.7)
        gfx.fillCircle(cx, cy, 15 * s * expand)

        // Inner core (bright blue-white)
        gfx.fillStyle(0x8844ff, 0.9)
        gfx.fillCircle(cx, cy, 10 * s * expand)

        // Hot center
        gfx.fillStyle(0xcc88ff, 0.95)
        gfx.fillCircle(cx, cy, isCenter ? 7 : 5)

        // White flash core
        gfx.fillStyle(0xffffff, 1)
        gfx.fillCircle(cx, cy, isCenter ? 4 : 2.5)

        // Additive electric bloom
        glow.fillStyle(0x4400ff, 0.4)
        glow.fillCircle(cx, cy, 26 * s * expand)
        glow.fillStyle(0x8800ff, 0.5)
        glow.fillCircle(cx, cy, 16 * s * expand)
        glow.fillStyle(0xaa66ff, 0.6)
        glow.fillCircle(cx, cy, 8 * s)
      }

      // Connect tiles with electric plasma beams
      let minX = exp.centerX, maxX = exp.centerX
      let minY = exp.centerY, maxY = exp.centerY
      for (const [col, row] of exp.tiles) {
        if (row === exp.centerY) { minX = Math.min(minX, col); maxX = Math.max(maxX, col) }
        if (col === exp.centerX) { minY = Math.min(minY, row); maxY = Math.max(maxY, row) }
      }

      // Horizontal plasma beam
      if (maxX > minX) {
        const y = exp.centerY * TS + H
        const x1 = minX * TS + H
        const x2 = maxX * TS + H
        // Wide outer discharge
        gfx.fillStyle(0x2200aa, 0.3)
        gfx.fillRect(x1, y - 14, x2 - x1, 28)
        // Main beam
        gfx.fillStyle(0x4400ff, 0.55)
        gfx.fillRect(x1, y - 9, x2 - x1, 18)
        // Bright core
        gfx.fillStyle(0x8844ff, 0.8)
        gfx.fillRect(x1, y - 5, x2 - x1, 10)
        // White-hot center
        gfx.fillStyle(0xbbaaff, 0.9)
        gfx.fillRect(x1, y - 2, x2 - x1, 4)
        gfx.fillStyle(0xffffff, 0.8)
        gfx.fillRect(x1, y - 1, x2 - x1, 2)
        // Additive bloom
        glow.fillStyle(0x6600ff, 0.45)
        glow.fillRect(x1, y - 16, x2 - x1, 32)
      }

      // Vertical plasma beam
      if (maxY > minY) {
        const x = exp.centerX * TS + H
        const y1 = minY * TS + H
        const y2 = maxY * TS + H
        gfx.fillStyle(0x2200aa, 0.3)
        gfx.fillRect(x - 14, y1, 28, y2 - y1)
        gfx.fillStyle(0x4400ff, 0.55)
        gfx.fillRect(x - 9, y1, 18, y2 - y1)
        gfx.fillStyle(0x8844ff, 0.8)
        gfx.fillRect(x - 5, y1, 10, y2 - y1)
        gfx.fillStyle(0xbbaaff, 0.9)
        gfx.fillRect(x - 2, y1, 4, y2 - y1)
        gfx.fillStyle(0xffffff, 0.8)
        gfx.fillRect(x - 1, y1, 2, y2 - y1)
        glow.fillStyle(0x6600ff, 0.45)
        glow.fillRect(x - 16, y1, 32, y2 - y1)
      }

      this.explGfx.push({ gfx, glow, id: exp.id })
    }
  }

  // ─── SYNC POWERUPS ───────────────────────────────────────────────────────
  syncPowerups(state) {
    const activePwKeys = new Set()
    for (const pw of state.powerupsOnMap || []) {
      const key = `${pw.x},${pw.y}`
      activePwKeys.add(key)
      if (!this.pwSprites[key]) {
        const x = pw.x * TS + H
        const y = pw.y * TS + H
        const gfx = this.add.graphics().setDepth(2).setPosition(x, y)
        const sz = TS - 8
        const half = sz / 2
        const color = PW_HEX[pw.type] || 0xffffff

        // Outer glow halo
        gfx.fillStyle(color, 0.08)
        gfx.fillCircle(0, 0, half + 8)
        gfx.fillStyle(color, 0.12)
        gfx.fillCircle(0, 0, half + 4)

        // Shadow
        gfx.fillStyle(0x000000, 0.4)
        gfx.fillRoundedRect(-half + 2, -half + 3, sz, sz, 10)
        // Dark backdrop
        gfx.fillStyle(0x0a0a14)
        gfx.fillRoundedRect(-half, -half, sz, sz, 10)
        // Colored face
        gfx.fillStyle(darken(color, 0.15))
        gfx.fillRoundedRect(-half + 1, -half + 1, sz - 2, sz - 2, 9)
        // Inner neon tint
        gfx.fillStyle(color, 0.25)
        gfx.fillRoundedRect(-half + 3, -half + 3, sz - 6, sz - 6, 7)
        // Top shine
        gfx.fillStyle(0xffffff, 0.2)
        gfx.fillRoundedRect(-half + 5, -half + 5, sz - 10, 7, 4)
        // Neon border
        gfx.lineStyle(1.5, color, 0.7)
        gfx.strokeRoundedRect(-half + 1, -half + 1, sz - 2, sz - 2, 9)

        const txt = this.add.text(x, y + 1, PW_ICONS[pw.type] || '?', {
          fontSize: `${Math.floor(sz * 0.5)}px`,
          fontFamily: '"Rajdhani", "Outfit", sans-serif',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
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
      const isRespawning = !player.alive && (player.respawnTimer || 0) > 0
      if (!player.alive && !isRespawning && (player.deathFrame || 0) > 18) continue
      activeIds.add(player.userId)

      let entry = this.playerGfx[player.userId]
      if (!entry) {
        const gfx = this.add.graphics().setDepth(6)
        const nameText = this.add.text(0, 0, (player.name || '').substring(0, 7).toUpperCase(), {
          fontSize: '10px',
          fontFamily: '"Rajdhani", "Outfit", sans-serif',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          letterSpacing: 1,
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

      if (!player.alive && isRespawning) {
        // Respawning — ghostly pulsing indicator at spawn point
        const pulse = 0.2 + 0.3 * Math.abs(Math.sin(Date.now() / 300))
        entry.gfx.setScale(1).setRotation(0).setAlpha(pulse)
        entry.nameText.setAlpha(pulse)
      } else if (!player.alive) {
        const df = player.deathFrame || 0
        const scale = Math.max(0, 1 - df / 18)
        entry.gfx.setScale(scale).setAlpha(scale).setRotation((df / 18) * Math.PI * 2)
        entry.nameText.setAlpha(scale)
      } else {
        entry.gfx.setScale(1).setRotation(0)
        entry.nameText.setAlpha(1)
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
    const hover = Math.sin(frame * 0.4) * 2 // smooth hover bob

    // ── GROUND SHADOW (hover glow instead of hard shadow) ──
    gfx.fillStyle(color, 0.08)
    gfx.fillEllipse(0, 16, 28, 10)
    gfx.fillStyle(color, 0.04)
    gfx.fillEllipse(0, 18, 36, 8)

    // ── ENGINE EXHAUST (back thrusters) ──
    const exhaustAlpha = 0.3 + Math.sin(frame * 0.8) * 0.2
    gfx.fillStyle(0x4488ff, exhaustAlpha)
    gfx.fillEllipse(-8, 14 - hover, 6, 8)
    gfx.fillEllipse(8, 14 - hover, 6, 8)
    gfx.fillStyle(0x88ccff, exhaustAlpha * 0.8)
    gfx.fillEllipse(-8, 15 - hover, 3, 5)
    gfx.fillEllipse(8, 15 - hover, 3, 5)

    // ── WING FINS (lateral stabilizers) ──
    const wingColor = darken(color, 0.2)
    // Left wing
    gfx.fillStyle(wingColor)
    gfx.fillTriangle(-20, 4 - hover, -9, -4 - hover, -9, 8 - hover)
    gfx.fillStyle(lighten(color, 0.1), 0.6)
    gfx.fillTriangle(-18, 4 - hover, -10, -2 - hover, -10, 6 - hover)
    // Right wing
    gfx.fillStyle(wingColor)
    gfx.fillTriangle(20, 4 - hover, 9, -4 - hover, 9, 8 - hover)
    gfx.fillStyle(lighten(color, 0.1), 0.6)
    gfx.fillTriangle(18, 4 - hover, 10, -2 - hover, 10, 6 - hover)
    // Wing neon edge lights
    gfx.fillStyle(color, 0.8)
    gfx.fillRect(-21, 3 - hover, 4, 2)
    gfx.fillRect(17, 3 - hover, 4, 2)

    // ── MAIN HULL (central fuselage) ──
    // Hull shadow
    gfx.fillStyle(darken(color, 0.5))
    gfx.fillRoundedRect(-10, -10 - hover, 20, 22, 6)
    // Hull main
    gfx.fillStyle(darken(color, 0.2))
    gfx.fillRoundedRect(-9, -11 - hover, 18, 21, 5)
    // Hull highlight (top face)
    gfx.fillStyle(lighten(color, 0.15))
    gfx.fillRoundedRect(-8, -10 - hover, 16, 8, 4)
    // Hull top gloss strip
    gfx.fillStyle(0xffffff, 0.3)
    gfx.fillRoundedRect(-5, -10 - hover, 10, 3, 2)

    // ── SENSOR DOME (instead of head/helmet) ──
    gfx.fillStyle(0x0a0a1a)
    gfx.fillCircle(0, -10 - hover, 8)
    // Sensor glass
    const sensorColor = lighten(color, 0.4)
    gfx.fillStyle(sensorColor, 0.85)
    gfx.fillCircle(0, -10 - hover, 6)
    gfx.fillStyle(0xffffff, 0.5)
    gfx.fillCircle(-2, -12 - hover, 2.5)
    // Sensor eye direction indicator
    if (player.dir === 'left') {
      gfx.fillStyle(0x000000, 0.7); gfx.fillCircle(-2, -10 - hover, 3)
      gfx.fillStyle(color); gfx.fillCircle(-3, -10 - hover, 2)
    } else if (player.dir === 'right') {
      gfx.fillStyle(0x000000, 0.7); gfx.fillCircle(2, -10 - hover, 3)
      gfx.fillStyle(color); gfx.fillCircle(3, -10 - hover, 2)
    } else if (player.dir === 'up') {
      gfx.fillStyle(0x000000, 0.7); gfx.fillCircle(0, -13 - hover, 3)
      gfx.fillStyle(color); gfx.fillCircle(0, -14 - hover, 2)
    } else {
      gfx.fillStyle(0x000000, 0.7); gfx.fillCircle(0, -8 - hover, 3)
      gfx.fillStyle(color); gfx.fillCircle(0, -7 - hover, 2)
    }

    // ── FRONT CANNON TIPS ──
    gfx.fillStyle(darken(color, 0.3))
    gfx.fillRoundedRect(-11, -5 - hover, 4, 10, 2)
    gfx.fillRoundedRect(7, -5 - hover, 4, 10, 2)
    // Cannon barrel tips (glowing)
    gfx.fillStyle(color, 0.9)
    gfx.fillRect(-11, 3 - hover, 4, 2)
    gfx.fillRect(7, 3 - hover, 4, 2)
    gfx.fillStyle(lighten(color, 0.5))
    gfx.fillRect(-10, 3 - hover, 2, 1)
    gfx.fillRect(8, 3 - hover, 2, 1)

    // ── EFFECTS ──
    if (player.skullEffect) {
      gfx.fillStyle(0xff0000, 0.15)
      gfx.fillCircle(0, -hover, 22)
      gfx.lineStyle(1.5, 0xff0000, 0.5)
      gfx.strokeCircle(0, -hover, 22)
    }

    if (player.shieldTimer > 0) {
      // Hexagonal shield effect
      gfx.lineStyle(2, 0x44aaff, 0.7)
      gfx.strokeCircle(0, -hover, 24)
      gfx.lineStyle(1, 0x88ddff, 0.4)
      gfx.strokeCircle(0, -hover, 22)
      gfx.fillStyle(0x2266ff, 0.08)
      gfx.fillCircle(0, -hover, 24)
      // Sparkle nodes
      gfx.fillStyle(0x88ccff, 0.8)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        gfx.fillCircle(Math.cos(a) * 24, Math.sin(a) * 24 - hover, 2)
      }
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
        fontSize: '13px',
        fontFamily: '"Rajdhani", "Outfit", sans-serif',
        fontStyle: 'bold',
        color: label.color || '#00e87a',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(7).setAlpha(Math.max(0, 1 - progress))
      this.labelTexts.push(txt)
    }
  }

  // ─── CAMERA ───────────────────────────────────────────────────────────
  updateCamera(state) {
    const myPlayer = this.userId
      ? state.players[this.userId]
      : Object.values(state.players)[0]

    // Follow player if alive OR if waiting to respawn (so camera stays at spawn zone)
    const isTracking = myPlayer && (myPlayer.alive || (myPlayer.respawnTimer || 0) > 0)
    if (isTracking) {
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

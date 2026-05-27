// ─── TILE CODES ─────────────────────────────────────────────────────────────
export const TILE = {
  EMPTY: 0,
  SOLID: 1,      // indestructible wall
  SOFT: 2,       // destructible brick
  GATE: 3,       // exit gate (single player)
  PORTAL: 4,     // portal gate (multiplayer)
  PORTAL_OPEN: 5,
  ZONE: 6,       // colored zone floor
}

// ─── POWERUP TYPES ───────────────────────────────────────────────────────────
export const POWERUP = {
  EXTRA_BOMB: 'extrabomb',
  FIRE_UP: 'fireup',
  SPEED_UP: 'speedup',
  KICK: 'kick',
  REMOTE: 'remote',
  BOMB_PASS: 'bombpass',
  WALL_PASS: 'wallpass',
  FULL_FIRE: 'fullfire',
  SKULL: 'skull',
  CLOCK: 'clock',
  MYSTERY: 'mystery',
  // Multiplayer exclusive
  GATE_BOMB: 'gatebomb',
  SHIELD: 'shield',
  DECOY: 'decoy',
  BLOCK_ITEM: 'blockitem',
  SWAP: 'swap',
}

export const POWERUP_CHANCE = 0.25

// ─── SPEEDS (pixels per tick at 20 ticks/sec) ───────────────────────────────
export const SPEED_VALUES = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5] // index = speed notch

// ─── INITIAL GAME STATE ──────────────────────────────────────────────────────
export function createInitialState(grid, playerConfigs, mode = 'singleplayer') {
  const players = {}
  for (const p of playerConfigs) {
    players[p.userId] = {
      userId: p.userId,
      name: p.name,
      color: p.color,
      slot: p.slot || 1,
      x: p.startX,
      y: p.startY,
      px: p.startX * 48,
      py: p.startY * 48,
      alive: true,
      lives: mode === 'singleplayer' ? 3 : 3,
      score: 0,
      maxBombs: 1,
      activeBombs: 0,
      fireRange: 1,
      speed: 8,
      powerups: [],
      skullEffect: null,
      skullTimer: 0,
      wallPassTimer: 0,
      shieldTimer: 0,
      kills: 0,
      zone: p.zone || 1,
      respawnTimer: 0,
      moving: false,
      dir: 'down',
      frame: 0,
      frameTimer: 0,
    }
  }

  return {
    tick: 0,
    timer: 300,
    status: 'active',
    mode,
    grid,
    players,
    bombs: [],
    explosions: [],
    gates: [],
    powerupsOnMap: [],
    enemies: [],
    scores: {},
    floatLabels: [],
    gateVisible: false,
    levelCleared: false,
  }
}

// ─── CLONE STATE (for safe mutation) ─────────────────────────────────────────
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state))
}

// ─── APPLY SKULL EFFECT ─────────────────────────────────────────────────────
export const SKULL_EFFECTS = ['slow', 'reverse', 'autobomb', 'randomdetonate']

export function applySkull(player) {
  const effect = SKULL_EFFECTS[Math.floor(Math.random() * SKULL_EFFECTS.length)]
  player.skullEffect = effect
  player.skullTimer = 200 // 10s at 20 ticks/sec
}

// ─── APPLY POWERUP TO PLAYER ─────────────────────────────────────────────────
export function applyPowerup(player, type) {
  switch (type) {
    case POWERUP.EXTRA_BOMB:
      player.maxBombs = Math.min(8, player.maxBombs + 1); break
    case POWERUP.FIRE_UP:
      player.fireRange = Math.min(8, player.fireRange + 1); break
    case POWERUP.SPEED_UP:
      player.speed = Math.min(8, player.speed + 1); break
    case POWERUP.FULL_FIRE:
      player.fireRange = 8; break
    case POWERUP.CLOCK:
      // Handled in state update (timer += 60*20 ticks)
      return { clockBonus: true }
    case POWERUP.SKULL:
      applySkull(player); break
    case POWERUP.MYSTERY:
      const allPowerups = [POWERUP.EXTRA_BOMB, POWERUP.FIRE_UP, POWERUP.SPEED_UP, POWERUP.SKULL]
      return applyPowerup(player, allPowerups[Math.floor(Math.random() * allPowerups.length)])
    case POWERUP.KICK:
    case POWERUP.REMOTE:
    case POWERUP.BOMB_PASS:
    case POWERUP.GATE_BOMB:
    case POWERUP.SHIELD:
    case POWERUP.DECOY:
    case POWERUP.BLOCK_ITEM:
    case POWERUP.SWAP:
      if (!player.powerups.includes(type)) player.powerups.push(type)
      break
    case POWERUP.WALL_PASS:
      if (!player.powerups.includes(type)) player.powerups.push(type)
      player.wallPassTimer = 200 // 10s
      break
  }
  return {}
}

// ─── INPUT HANDLER ────────────────────────────────────────────────────────────

const pressedKeys = new Set()

export function initInput() {
  window.addEventListener('keydown', e => {
    pressedKeys.add(e.code)
    e.preventDefault?.()  // Prevent page scroll on arrows/space
  })
  window.addEventListener('keyup', e => {
    pressedKeys.delete(e.code)
  })
}

export function destroyInput() {
  pressedKeys.clear()
}

export function setVirtualKey(code, isPressed) {
  if (isPressed) {
    pressedKeys.add(code)
  } else {
    pressedKeys.delete(code)
  }
}

// ─── KEY MAPS ─────────────────────────────────────────────────────────────────
// Online multiplayer: everyone controls their own character
const ONLINE_KEYS = {
  up:    ['ArrowUp',    'KeyW'],
  down:  ['ArrowDown',  'KeyS'],
  left:  ['ArrowLeft',  'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  bomb:  ['Enter', 'Space', 'KeyF'],
}

// Local multiplayer key maps (shared keyboard)
const LOCAL_KEY_MAPS = [
  {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], bomb: ['KeyF'],
  },
  {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], bomb: ['Enter'],
  },
  {
    up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], bomb: ['KeyH'],
  },
  {
    up: ['Numpad8'], down: ['Numpad5'], left: ['Numpad4'], right: ['Numpad6'], bomb: ['Numpad0'],
  },
  {
    up: ['KeyT'], down: ['KeyG'], left: ['KeyF'], right: ['KeyH'], bomb: ['KeyR'],
  },
]

// ─── GET PLAYER INPUTS ───────────────────────────────────────────────────────

export function getPlayerInput(slot = 0, mode = 'online') {
  const map = mode === 'online' ? ONLINE_KEYS : (LOCAL_KEY_MAPS[slot] || LOCAL_KEY_MAPS[0])
  return {
    up:    map.up.some(k => pressedKeys.has(k)),
    down:  map.down.some(k => pressedKeys.has(k)),
    left:  map.left.some(k => pressedKeys.has(k)),
    right: map.right.some(k => pressedKeys.has(k)),
    bomb:  map.bomb.some(k => pressedKeys.has(k)),
  }
}

// ─── BOMB KEY EDGE DETECTION ─────────────────────────────────────────────────
const prevBombState = {}

export function getBombPressed(slot = 0, mode = 'online') {
  const cur = getPlayerInput(slot, mode).bomb
  const prev = prevBombState[slot] || false
  prevBombState[slot] = cur
  return cur && !prev // only true on the frame it's first pressed
}

export function resetBombState(slot) {
  prevBombState[slot] = false
}

// ─── CONTROL DISPLAY ─────────────────────────────────────────────────────────
export const CONTROL_HINTS = {
  online: '← → ↑ ↓ to move · Enter/Space to bomb',
  local: [
    'WASD + F to bomb',
    'Arrows + Enter to bomb',
    'IJKL + H to bomb',
    'Numpad 8456 + 0 to bomb',
    'TFGH + R to bomb',
  ],
}

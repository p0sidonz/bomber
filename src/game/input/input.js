// ─── INPUT HANDLER ────────────────────────────────────────────────────────────

const pressedKeys = new Set()

let _onKeyDown = null
let _onKeyUp = null
let _onBlur = null
let _onVisibility = null

export function initInput() {
  _onKeyDown = e => {
    pressedKeys.add(e.code)
    e.preventDefault?.()
  }
  _onKeyUp = e => {
    pressedKeys.delete(e.code)
  }
  // Clear all keys when window loses focus or tab is hidden
  // Prevents stuck movement keys on app switch / incoming call
  _onBlur = () => { pressedKeys.clear() }
  _onVisibility = () => { if (document.hidden) pressedKeys.clear() }

  window.addEventListener('keydown', _onKeyDown)
  window.addEventListener('keyup', _onKeyUp)
  window.addEventListener('blur', _onBlur)
  document.addEventListener('visibilitychange', _onVisibility)
}

export function destroyInput() {
  pressedKeys.clear()
  if (_onKeyDown) window.removeEventListener('keydown', _onKeyDown)
  if (_onKeyUp) window.removeEventListener('keyup', _onKeyUp)
  if (_onBlur) window.removeEventListener('blur', _onBlur)
  if (_onVisibility) document.removeEventListener('visibilitychange', _onVisibility)
  _onKeyDown = _onKeyUp = _onBlur = _onVisibility = null
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
  detonate: ['ShiftRight', 'ShiftLeft', 'KeyE', 'KeyR'],
}

// Local multiplayer key maps (shared keyboard)
const LOCAL_KEY_MAPS = [
  {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], bomb: ['KeyF'], detonate: ['KeyE'],
  },
  {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], bomb: ['Enter'], detonate: ['ShiftRight'],
  },
  {
    up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], bomb: ['KeyH'], detonate: ['KeyY'],
  },
  {
    up: ['Numpad8'], down: ['Numpad5'], left: ['Numpad4'], right: ['Numpad6'], bomb: ['Numpad0'], detonate: ['NumpadEnter'],
  },
  {
    up: ['KeyT'], down: ['KeyG'], left: ['KeyF'], right: ['KeyH'], bomb: ['KeyR'], detonate: ['KeyY'],
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
    detonate: map.detonate.some(k => pressedKeys.has(k)),
  }
}

// ─── BOMB KEY EDGE DETECTION ─────────────────────────────────────────────────
const prevBombState = {}
const prevDetonateState = {}

export function getBombPressed(slot = 0, mode = 'online') {
  const cur = getPlayerInput(slot, mode).bomb
  const prev = prevBombState[slot] || false
  prevBombState[slot] = cur
  return cur && !prev // only true on the frame it's first pressed
}

export function getDetonatePressed(slot = 0, mode = 'online') {
  const cur = getPlayerInput(slot, mode).detonate
  const prev = prevDetonateState[slot] || false
  prevDetonateState[slot] = cur
  return cur && !prev
}

export function resetBombState(slot) {
  prevBombState[slot] = false
  prevDetonateState[slot] = false
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

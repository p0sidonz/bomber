// ─── WEB AUDIO API SOUND ENGINE ──────────────────────────────────────────────

let ctx = null
let masterGain = null
let bgmOscillators = []
let bgmPlaying = false
let currentBgmTrack = null

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.3
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(freq, type, duration, gainVal = 0.3, startTime = 0) {
  const c = getCtx()
  const t = c.currentTime + startTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(gainVal, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(t)
  osc.stop(t + duration)
}

function playNoise(duration, gainVal = 0.2) {
  const c = getCtx()
  const bufferSize = c.sampleRate * duration
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = c.createBufferSource()
  source.buffer = buffer
  const gain = c.createGain()
  gain.gain.setValueAtTime(gainVal, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  source.connect(gain)
  gain.connect(masterGain)
  source.start()
  source.stop(c.currentTime + duration)
}

// ─── SOUND EFFECTS ────────────────────────────────────────────────────────────

export const sfx = {
  walk() {
    playTone(80, 'square', 0.05, 0.08)
  },

  bombPlant() {
    playTone(200, 'square', 0.15, 0.25)
    playTone(150, 'square', 0.1, 0.15, 0.05)
  },

  explosion() {
    playNoise(0.4, 0.4)
    playTone(100, 'sawtooth', 0.3, 0.3)
    playTone(60, 'square', 0.5, 0.2, 0.1)
  },

  powerupCollect() {
    // C-E-G ascending
    playTone(261, 'triangle', 0.15, 0.3, 0)
    playTone(329, 'triangle', 0.15, 0.3, 0.1)
    playTone(392, 'triangle', 0.2, 0.35, 0.2)
  },

  skullCollect() {
    // G-E-C descending with wobble
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(392, c.currentTime)
    osc.frequency.setValueAtTime(329, c.currentTime + 0.1)
    osc.frequency.setValueAtTime(261, c.currentTime + 0.2)
    osc.frequency.setValueAtTime(200, c.currentTime + 0.3)
    gain.gain.setValueAtTime(0.3, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start()
    osc.stop(c.currentTime + 0.5)
  },

  playerDeath() {
    // Descending glide 400→50hz
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(400, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, c.currentTime + 0.5)
    gain.gain.setValueAtTime(0.4, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start()
    osc.stop(c.currentTime + 0.5)
  },

  enemyDeath() {
    playTone(300, 'square', 0.1, 0.3)
    playTone(200, 'square', 0.08, 0.2, 0.05)
  },

  levelClear() {
    // C-E-G-C fanfare
    playTone(261, 'square', 0.2, 0.4, 0)
    playTone(329, 'square', 0.2, 0.4, 0.15)
    playTone(392, 'square', 0.2, 0.4, 0.3)
    playTone(523, 'square', 0.4, 0.5, 0.45)
  },

  gateOpen() {
    // Rising sweep 200→600hz
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(200, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.4)
    gain.gain.setValueAtTime(0.3, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start()
    osc.stop(c.currentTime + 0.4)
  },

  timerWarning() {
    playTone(800, 'square', 0.1, 0.2)
  },

  gameStart() {
    playTone(440, 'square', 0.1, 0.4, 0)
    playTone(550, 'square', 0.1, 0.4, 0.1)
    playTone(660, 'square', 0.2, 0.5, 0.2)
  },
}

// ─── BACKGROUND MUSIC ─────────────────────────────────────────────────────────
const BGM_TRACKS = {
  world1: {
    // Happy chiptune — C major
    notes: [261, 294, 329, 349, 392, 349, 329, 294, 261, 294, 329, 392, 523, 392, 329, 261],
    tempo: 180, // BPM
    type: 'square',
  },
  world2: {
    // Tense — minor
    notes: [220, 233, 220, 196, 185, 196, 220, 233, 220, 185, 174, 185, 220, 233, 247, 233],
    tempo: 200,
    type: 'sawtooth',
  },
  boss: {
    // Urgent — fast minor
    notes: [196, 233, 196, 175, 196, 233, 262, 233, 196, 175, 165, 175, 196, 175, 165, 156],
    tempo: 240,
    type: 'square',
  },
}

export function playBGM(track) {
  if (bgmPlaying && currentBgmTrack === track) return
  stopBGM()
  currentBgmTrack = track
  bgmPlaying = true

  const t = BGM_TRACKS[track] || BGM_TRACKS.world1
  const c = getCtx()
  const beatLen = 60 / t.tempo // seconds per beat

  let i = 0
  function scheduleNote() {
    if (!bgmPlaying) return
    const note = t.notes[i % t.notes.length]
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = t.type
    osc.frequency.value = note
    gain.gain.setValueAtTime(0.12, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.9)
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + beatLen)
    bgmOscillators.push(osc)
    i++
    setTimeout(scheduleNote, beatLen * 1000)
  }

  scheduleNote()
}

export function stopBGM() {
  bgmPlaying = false
  for (const osc of bgmOscillators) {
    try { osc.stop() } catch (_) {}
  }
  bgmOscillators = []
  currentBgmTrack = null
}

export function setMasterVolume(vol) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol))
}

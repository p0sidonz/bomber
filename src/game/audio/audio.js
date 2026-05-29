// ─── WEB AUDIO API SOUND ENGINE ──────────────────────────────────────────────

let ctx = null
let masterGain = null
let bgmOscillators = []
let bgmPlaying = false
let currentBgmTrack = null
let isMuted = localStorage.getItem('bm_muted') === 'true'

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = isMuted ? 0 : 0.3
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function toggleMute() {
  isMuted = !isMuted
  localStorage.setItem('bm_muted', isMuted)
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.3
  }
  return isMuted
}

export function getIsMuted() {
  return isMuted
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

function playNoise(duration, gainVal = 0.2, filterFreq = 0, startTime = 0) {
  const c = getCtx()
  const t = c.currentTime + startTime
  const bufferSize = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = c.createBufferSource()
  source.buffer = buffer
  const gain = c.createGain()
  gain.gain.setValueAtTime(gainVal, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

  if (filterFreq > 0) {
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    source.connect(filter)
    filter.connect(gain)
  } else {
    source.connect(gain)
  }

  gain.connect(masterGain)
  source.start(t)
  source.stop(t + duration)
}

function playSweep(startFreq, endFreq, type, duration, gainVal = 0.3, startTime = 0) {
  const c = getCtx()
  const t = c.currentTime + startTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(startFreq, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t + duration)
  gain.gain.setValueAtTime(gainVal, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(t)
  osc.stop(t + duration)
}

// ─── SOUND EFFECTS ────────────────────────────────────────────────────────────

export const sfx = {
  walk() {
    // Crisp 8-bit footstep click
    playNoise(0.015, 0.08, 1500)
    playSweep(400, 200, 'square', 0.02, 0.05)
  },

  bombPlant() {
    // Classic retro "Bloop-Thud"
    playSweep(600, 150, 'sine', 0.1, 0.4)
    playTone(80, 'square', 0.15, 0.2, 0.05)
    playNoise(0.05, 0.15, 1000)
  },

  explosion() {
    // 8-bit Retro Explosion! Crunchy noise + descending square wave
    
    // LAYER 1: The crunch (filtered white noise)
    playNoise(0.4, 0.5, 2000) // sharp initial blast
    playNoise(0.8, 0.3, 800)  // lingering rumble
    
    // LAYER 2: The classic "pew" sweep downwards
    playSweep(400, 40, 'square', 0.4, 0.4)
    playSweep(200, 20, 'sawtooth', 0.6, 0.4)

    // LAYER 3: Sub-thud
    playSweep(100, 10, 'sine', 0.5, 0.6)
  },

  powerupCollect() {
    // Super fast arcade magical sweep!
    playSweep(400, 1200, 'square', 0.15, 0.2)
    playSweep(600, 1600, 'square', 0.15, 0.2, 0.1) // delayed harmony
    playTone(1600, 'sine', 0.2, 0.3, 0.15)
    playTone(2000, 'sine', 0.3, 0.2, 0.15)
  },

  skullCollect() {
    // Ominous descending minor
    playSweep(600, 150, 'sawtooth', 0.5, 0.3)
    playTone(233, 'square', 0.15, 0.15, 0.1)
    playTone(185, 'square', 0.15, 0.15, 0.25)
    playTone(150, 'square', 0.2, 0.2, 0.35)
  },

  playerDeath() {
    // Retro flutter death: descending rapid arpeggio
    const notes = [600, 500, 400, 300, 450, 350, 250, 150, 300, 200, 100, 50]
    for (let i = 0; i < notes.length; i++) {
      playSweep(notes[i], notes[i]*0.8, 'sawtooth', 0.1, 0.3, i * 0.08)
    }
    // Impact explosion at the end
    playNoise(0.5, 0.3, 500, notes.length * 0.08)
    playSweep(100, 20, 'square', 0.5, 0.4, notes.length * 0.08)
  },

  enemyDeath() {
    // 8-bit squish / poof
    playSweep(600, 50, 'sawtooth', 0.2, 0.3)
    playNoise(0.15, 0.2, 800)
  },

  levelClear() {
    // 8-bit Victory Fanfare
    const notes = [262, 330, 392, 523, 392, 523] // C E G C G C!
    const times = [0, 0.1, 0.2, 0.3, 0.45, 0.6]
    for (let i = 0; i < notes.length; i++) {
      playTone(notes[i], 'square', 0.15, 0.25, times[i])
      playTone(notes[i] * 1.01, 'square', 0.15, 0.25, times[i]) // chorus
    }
  },

  gateOpen() {
    // Classic Zelda-esque "Secret Revealed" chime
    const notes = [440, 493, 554, 622, 659, 739, 830, 880]
    for (let i = 0; i < notes.length; i++) {
      playTone(notes[i], 'square', 0.1, 0.2, i * 0.05)
    }
  },

  timerWarning() {
    // Urgent, shrill 8-bit alarm
    playTone(1000, 'square', 0.1, 0.3)
    playTone(1000, 'square', 0.1, 0.3, 0.15)
  },

  gameStart() {
    // Fast "Get Ready" jingle
    const notes = [523, 659, 783, 1046]
    for (let i = 0; i < notes.length; i++) {
      playTone(notes[i], 'square', 0.1, 0.2, i * 0.1)
    }
    playTone(1046, 'square', 0.4, 0.2, 0.4)
  },

  teleport() {
    // Retro warp tunnel
    for (let i = 0; i < 10; i++) {
      playSweep(200 + i*50, 600 + i*50, 'sawtooth', 0.05, 0.2, i * 0.05)
    }
    playNoise(0.5, 0.15, 2000)
  },

  kick() {
    // Quick kick thud
    playTone(160, 'sine', 0.08, 0.25)
    playNoise(0.05, 0.1, 600)
  },

  allEnemiesDead() {
    // Magical triumph chime
    playSweep(400, 800, 'sine', 0.3, 0.2)
    playTone(800, 'sine', 0.2, 0.2, 0.3)
    playTone(1200, 'triangle', 0.3, 0.3, 0.5)
  },
}

// ─── BACKGROUND MUSIC ─────────────────────────────────────────────────────────
const BGM_TRACKS = {
  menu: { // Chill lobby / menu groove
    notes: [
      392, 0, 440, 0, 493, 0, 523, 0, 587, 0, 523, 0, 493, 0, 440, 0,
      392, 0, 440, 0, 493, 0, 587, 0, 659, 0, 587, 0, 493, 0, 523, 493
    ],
    bass: [
      98, 0, 0, 98, 0, 130, 0, 0, 98, 0, 0, 98, 0, 146, 0, 0,
      98, 0, 0, 98, 0, 130, 0, 0, 98, 0, 0, 98, 0, 110, 0, 0
    ],
    drums: [
      1, 3, 3, 3, 2, 3, 3, 3, 1, 3, 1, 3, 2, 3, 3, 3,
      1, 3, 3, 3, 2, 3, 3, 3, 1, 3, 1, 3, 2, 3, 3, 3
    ],
    tempo: 380, // slightly slower, relaxed
    type: 'triangle'
  },
  world1: { // Upbeat Arcade Groove (C minor)
    notes: [
      262, 0, 311, 0, 349, 0, 392, 0, 466, 0, 392, 0, 349, 311, 262, 0,
      262, 0, 311, 0, 349, 0, 369, 392, 523, 0, 466, 0, 392, 0, 311, 294
    ],
    bass: [
      131, 0, 131, 0, 131, 0, 131, 0, 155, 0, 155, 0, 174, 0, 174, 0,
      131, 0, 131, 0, 131, 0, 131, 0, 116, 0, 116, 0, 131, 0, 0,   0
    ],
    drums: [
      1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 1,
      1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 2, 3
    ],
    tempo: 480, // steps per minute
    type: 'square'
  },
  world2: { // Tense stealthy beat (A minor)
    notes: [
      440, 0, 493, 523, 0, 493, 440, 0, 392, 0, 440, 0, 329, 0, 0, 0,
      440, 0, 493, 523, 0, 587, 659, 0, 783, 0, 659, 0, 523, 0, 493, 0
    ],
    bass: [
      110, 110, 0, 110, 110, 0, 110, 0, 98, 98, 0, 98, 98, 0, 98, 0,
      110, 110, 0, 110, 110, 0, 110, 0, 130, 130, 0, 130, 98, 0, 104, 0
    ],
    drums: [
      1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 0,
      1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 3
    ],
    tempo: 440,
    type: 'sawtooth'
  },
  boss: { // Intense driving boss theme
    notes: [
      196, 196, 233, 196, 262, 196, 294, 262, 196, 196, 233, 196, 311, 0, 294, 0,
      196, 196, 233, 196, 262, 196, 294, 262, 392, 0, 349, 0, 311, 294, 262, 233
    ],
    bass: [
      98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 104, 104, 110, 110,
      98, 98, 98, 98, 98, 98, 98, 98, 116, 116, 116, 116, 130, 130, 146, 146
    ],
    drums: [
      1, 3, 1, 3, 2, 3, 1, 3, 1, 3, 1, 3, 2, 3, 1, 3,
      1, 3, 1, 3, 2, 3, 1, 3, 1, 3, 1, 3, 2, 3, 3, 3
    ],
    tempo: 520,
    type: 'square'
  }
}
let bgmFast = false
let bgmTimeout = null

export function playBGM(track, fast = false) {
  if (bgmPlaying && currentBgmTrack === track && bgmFast === fast) return
  stopBGM()
  currentBgmTrack = track
  bgmFast = fast
  bgmPlaying = true

  const t = BGM_TRACKS[track] || BGM_TRACKS.world1
  const c = getCtx()
  const beatLen = (60 / t.tempo) / (fast ? 1.5 : 1)

  let i = 0
  function scheduleNote() {
    if (!bgmPlaying) return
    const note = t.notes[i % t.notes.length]
    const bassNote = t.bass ? t.bass[i % t.bass.length] : null
    const drum = t.drums ? t.drums[i % t.drums.length] : 0

    // Melody (Dual oscillator for chorus effect)
    if (note > 0) {
      const gain = c.createGain()
      gain.gain.setValueAtTime(0, c.currentTime)
      gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.8)
      gain.connect(masterGain)

      const osc1 = c.createOscillator()
      osc1.type = t.type
      osc1.frequency.value = note
      osc1.connect(gain)
      osc1.start(c.currentTime)
      osc1.stop(c.currentTime + beatLen)
      bgmOscillators.push(osc1)

      const osc2 = c.createOscillator()
      osc2.type = t.type
      osc2.frequency.value = note * 1.008 // slightly detuned for thickness
      osc2.connect(gain)
      osc2.start(c.currentTime)
      osc2.stop(c.currentTime + beatLen)
      bgmOscillators.push(osc2)
    }

    // Bass line
    if (bassNote > 0) {
      const bassOsc = c.createOscillator()
      const bassGain = c.createGain()
      bassOsc.type = 'triangle' // much punchier for bass
      bassOsc.frequency.value = bassNote
      bassGain.gain.setValueAtTime(0.2, c.currentTime)
      bassGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.9)
      bassOsc.connect(bassGain)
      bassGain.connect(masterGain)
      bassOsc.start(c.currentTime)
      bassOsc.stop(c.currentTime + beatLen)
      bgmOscillators.push(bassOsc)
    }

    // Drums
    if (drum > 0) {
      if (drum === 1) { // Kick
        playTone(150, 'sine', 0.1, 0.25, 0)
        playNoise(0.05, 0.15, 400)
      } else if (drum === 2) { // Snare
        playTone(200, 'triangle', 0.1, 0.15, 0)
        playNoise(0.15, 0.25, 1500)
      } else if (drum === 3) { // Hi-hat
        playNoise(0.05, 0.08, 6000)
      }
    }

    i++
    bgmTimeout = setTimeout(scheduleNote, beatLen * 1000)
  }

  scheduleNote()
}
export function stopBGM() {
  if (bgmTimeout) clearTimeout(bgmTimeout)
  bgmPlaying = false
  for (const osc of bgmOscillators) {
    try { osc.stop() } catch (_) {}
  }
  bgmOscillators = []
  currentBgmTrack = null
  bgmFast = false
}

export function setBGMFast(fast) {
  if (!bgmPlaying || !currentBgmTrack) return
  playBGM(currentBgmTrack, fast)
}

export function setMasterVolume(vol) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol))
}

// ─── FULLSCREEN ───────────────────────────────────────────────────────────────
export function toggleFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (el.requestFullscreen) el.requestFullscreen()
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  } else {
    if (document.exitFullscreen) document.exitFullscreen()
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
  }
}

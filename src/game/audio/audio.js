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

function playNoise(duration, gainVal = 0.2, filterFreq = 0) {
  const c = getCtx()
  const bufferSize = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = c.createBufferSource()
  source.buffer = buffer
  const gain = c.createGain()
  gain.gain.setValueAtTime(gainVal, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)

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
  source.start()
  source.stop(c.currentTime + duration)
}

function playSweep(startFreq, endFreq, type, duration, gainVal = 0.3) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(startFreq, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + duration)
  gain.gain.setValueAtTime(gainVal, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start()
  osc.stop(c.currentTime + duration)
}

// ─── SOUND EFFECTS ────────────────────────────────────────────────────────────

export const sfx = {
  walk() {
    // Quick snappy footstep tick
    const pitch = Math.random() > 0.5 ? 250 : 300
    playTone(pitch, 'sine', 0.025, 0.12)
  },

  bombPlant() {
    // Satisfying "thunk" — metallic drop
    playTone(100, 'sine', 0.15, 0.35)
    playTone(65, 'triangle', 0.1, 0.25, 0.02)
    playNoise(0.05, 0.12, 600)
  },

  explosion() {
    const c = getCtx()
    const now = c.currentTime

    // ── LAYER 1: Initial transient CRACK (the snap of the blast) ──
    const crackBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate)
    const crackData = crackBuf.getChannelData(0)
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.008))
    }
    const crackSrc = c.createBufferSource()
    crackSrc.buffer = crackBuf
    const crackGain = c.createGain()
    crackGain.gain.setValueAtTime(0.5, now)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    const crackFilter = c.createBiquadFilter()
    crackFilter.type = 'highpass'
    crackFilter.frequency.value = 800
    crackSrc.connect(crackFilter)
    crackFilter.connect(crackGain)
    crackGain.connect(masterGain)
    crackSrc.start(now)
    crackSrc.stop(now + 0.05)

    // ── LAYER 2: Deep bass THUMP (the impact) ──
    const bassOsc = c.createOscillator()
    bassOsc.type = 'sine'
    bassOsc.frequency.setValueAtTime(150, now)
    bassOsc.frequency.exponentialRampToValueAtTime(30, now + 0.25)
    const bassGain = c.createGain()
    bassGain.gain.setValueAtTime(0.6, now)
    bassGain.gain.setValueAtTime(0.5, now + 0.02)
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    bassOsc.connect(bassGain)
    bassGain.connect(masterGain)
    bassOsc.start(now)
    bassOsc.stop(now + 0.35)

    // ── LAYER 3: Mid-range BODY (the rumble/roar) ──
    const bodyBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate)
    const bodyData = bodyBuf.getChannelData(0)
    for (let i = 0; i < bodyData.length; i++) {
      bodyData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.15))
    }
    const bodySrc = c.createBufferSource()
    bodySrc.buffer = bodyBuf
    const bodyGain = c.createGain()
    bodyGain.gain.setValueAtTime(0.35, now + 0.01)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    const bodyFilter = c.createBiquadFilter()
    bodyFilter.type = 'lowpass'
    bodyFilter.frequency.setValueAtTime(1200, now)
    bodyFilter.frequency.exponentialRampToValueAtTime(200, now + 0.4)
    bodySrc.connect(bodyFilter)
    bodyFilter.connect(bodyGain)
    bodyGain.connect(masterGain)
    bodySrc.start(now + 0.01)
    bodySrc.stop(now + 0.4)

    // ── LAYER 4: Sub-bass punch (feel the boom) ──
    const subOsc = c.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(80, now)
    subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.3)
    const subGain = c.createGain()
    subGain.gain.setValueAtTime(0.4, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    subOsc.connect(subGain)
    subGain.connect(masterGain)
    subOsc.start(now)
    subOsc.stop(now + 0.3)

    // ── LAYER 5: Debris/crackle tail ──
    const debrisBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate)
    const debrisData = debrisBuf.getChannelData(0)
    for (let i = 0; i < debrisData.length; i++) {
      // Sparse crackle — random pops
      debrisData[i] = Math.random() < 0.05 ? (Math.random() * 2 - 1) * 0.8 : 0
    }
    const debrisSrc = c.createBufferSource()
    debrisSrc.buffer = debrisBuf
    const debrisGain = c.createGain()
    debrisGain.gain.setValueAtTime(0.15, now + 0.1)
    debrisGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    const debrisFilter = c.createBiquadFilter()
    debrisFilter.type = 'bandpass'
    debrisFilter.frequency.value = 3000
    debrisFilter.Q.value = 0.5
    debrisSrc.connect(debrisFilter)
    debrisFilter.connect(debrisGain)
    debrisGain.connect(masterGain)
    debrisSrc.start(now + 0.1)
    debrisSrc.stop(now + 0.5)
  },

  powerupCollect() {
    // Bright shimmery ascending chime: C-E-G-C
    playTone(523, 'sine', 0.12, 0.25, 0)
    playTone(659, 'sine', 0.12, 0.25, 0.08)
    playTone(784, 'sine', 0.12, 0.3, 0.16)
    playTone(1047, 'sine', 0.2, 0.35, 0.24)
    // Sparkle
    playTone(2093, 'sine', 0.08, 0.08, 0.3)
  },

  skullCollect() {
    // Ominous descending minor
    playSweep(600, 150, 'sawtooth', 0.5, 0.3)
    playTone(233, 'square', 0.15, 0.15, 0.1)
    playTone(185, 'square', 0.15, 0.15, 0.25)
    playTone(150, 'square', 0.2, 0.2, 0.35)
  },

  playerDeath() {
    // Dramatic death — descending wail + impact
    playSweep(800, 80, 'sawtooth', 0.6, 0.35)
    playSweep(600, 50, 'square', 0.8, 0.2)
    playNoise(0.4, 0.2, 400)
    // Final low thud
    playTone(40, 'sine', 0.5, 0.3, 0.3)
    playTone(30, 'sine', 0.4, 0.2, 0.5)
  },

  enemyDeath() {
    // Quick pop + squish
    playTone(400, 'sine', 0.08, 0.25)
    playSweep(500, 100, 'triangle', 0.15, 0.2)
    playNoise(0.08, 0.1, 1200)
  },

  levelClear() {
    // Triumphant fanfare — C-E-G-C with harmonics
    playTone(262, 'triangle', 0.2, 0.3, 0)
    playTone(330, 'triangle', 0.2, 0.3, 0.15)
    playTone(392, 'triangle', 0.2, 0.35, 0.3)
    playTone(523, 'triangle', 0.4, 0.4, 0.45)
    // Harmony layer
    playTone(392, 'sine', 0.3, 0.15, 0.45)
    playTone(659, 'sine', 0.3, 0.15, 0.45)
    // Sparkle finish
    playTone(1047, 'sine', 0.15, 0.1, 0.7)
    playTone(1319, 'sine', 0.15, 0.08, 0.8)
  },

  gateOpen() {
    // Magical rising shimmer
    playSweep(200, 800, 'sine', 0.5, 0.25)
    playSweep(300, 1200, 'triangle', 0.4, 0.1)
    playTone(800, 'sine', 0.2, 0.15, 0.3)
  },

  timerWarning() {
    // Urgent beep-beep
    playTone(880, 'square', 0.08, 0.2)
    playTone(880, 'square', 0.08, 0.2, 0.12)
  },

  gameStart() {
    // Arcade start jingle
    playTone(440, 'triangle', 0.1, 0.3, 0)
    playTone(554, 'triangle', 0.1, 0.3, 0.1)
    playTone(659, 'triangle', 0.15, 0.35, 0.2)
    playTone(880, 'triangle', 0.3, 0.4, 0.35)
  },

  teleport() {
    // Wooshy warp
    playSweep(200, 1600, 'sine', 0.3, 0.2)
    playSweep(1600, 200, 'sine', 0.3, 0.15)
    playNoise(0.15, 0.08, 3000)
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
  world1: {
    // Upbeat chiptune — C major bouncy
    notes: [262, 330, 392, 330, 262, 294, 349, 294, 262, 330, 392, 523, 494, 440, 392, 330],
    bass:  [131, 131, 196, 196, 131, 131, 175, 175, 131, 131, 196, 262, 247, 220, 196, 165],
    tempo: 200,
    type: 'triangle',
  },
  world2: {
    // Tense minor
    notes: [220, 262, 247, 220, 196, 220, 262, 294, 262, 220, 196, 185, 196, 220, 247, 220],
    bass:  [110, 131, 124, 110, 98,  110, 131, 147, 131, 110, 98,  93,  98,  110, 124, 110],
    tempo: 220,
    type: 'square',
  },
  boss: {
    // Urgent driving beat
    notes: [196, 233, 262, 233, 196, 175, 196, 262, 294, 262, 233, 196, 175, 165, 175, 196],
    bass:  [98,  117, 131, 117, 98,  88,  98,  131, 147, 131, 117, 98,  88,  83,  88,  98],
    tempo: 260,
    type: 'square',
  },
}

let bgmFast = false

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

    // Melody
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = t.type
    osc.frequency.value = note
    gain.gain.setValueAtTime(0.1, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.85)
    osc.connect(gain)
    gain.connect(masterGain)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + beatLen)
    bgmOscillators.push(osc)

    // Bass line
    if (bassNote) {
      const bassOsc = c.createOscillator()
      const bassGain = c.createGain()
      bassOsc.type = 'sine'
      bassOsc.frequency.value = bassNote
      bassGain.gain.setValueAtTime(0.07, c.currentTime)
      bassGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.9)
      bassOsc.connect(bassGain)
      bassGain.connect(masterGain)
      bassOsc.start(c.currentTime)
      bassOsc.stop(c.currentTime + beatLen)
      bgmOscillators.push(bassOsc)
    }

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

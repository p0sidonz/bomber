// ─── WEB AUDIO API — NOVA STRIKE SPACE AUDIO ENGINE ──────────────────────────

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

// ─── CORE SYNTH PRIMITIVES ────────────────────────────────────────────────────

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

function playToneWithVibrato(freq, type, duration, gainVal, startTime, vibratoRate = 5, vibratoDepth = 8) {
  const c = getCtx()
  const t = c.currentTime + startTime
  const osc = c.createOscillator()
  const vibratoOsc = c.createOscillator()
  const vibratoGain = c.createGain()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  vibratoOsc.frequency.value = vibratoRate
  vibratoGain.gain.value = vibratoDepth
  vibratoOsc.connect(vibratoGain)
  vibratoGain.connect(osc.frequency)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(gainVal, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(gain)
  gain.connect(masterGain)
  vibratoOsc.start(t); vibratoOsc.stop(t + duration)
  osc.start(t); osc.stop(t + duration)
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
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 2
    source.connect(filter)
    filter.connect(gain)
  } else {
    source.connect(gain)
  }
  gain.connect(masterGain)
  source.start(t); source.stop(t + duration)
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
  osc.start(t); osc.stop(t + duration)
}

// FM synthesis for alien metallic tones
function playFM(carrierFreq, modRatio, modDepth, duration, gainVal, startTime = 0) {
  const c = getCtx()
  const t = c.currentTime + startTime
  const carrier = c.createOscillator()
  const modulator = c.createOscillator()
  const modGain = c.createGain()
  const outGain = c.createGain()
  carrier.type = 'sine'
  modulator.type = 'sine'
  carrier.frequency.value = carrierFreq
  modulator.frequency.value = carrierFreq * modRatio
  modGain.gain.value = modDepth * carrierFreq
  outGain.gain.setValueAtTime(gainVal, t)
  outGain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  modulator.connect(modGain)
  modGain.connect(carrier.frequency)
  carrier.connect(outGain)
  outGain.connect(masterGain)
  modulator.start(t); modulator.stop(t + duration)
  carrier.start(t); carrier.stop(t + duration)
}

// ─── SPACE SOUND EFFECTS ──────────────────────────────────────────────────────

export const sfx = {
  walk() {
    // Subtle drone engine hum — quiet mechanical click + sub rumble
    playNoise(0.012, 0.04, 3000)
    playTone(60, 'sine', 0.015, 0.04)
  },

  bombPlant() {
    // Plasma charge deploy — magnetic clunk + energy charge-up whine
    playFM(120, 2, 3, 0.12, 0.25)
    playSweep(300, 800, 'sine', 0.18, 0.15, 0.05)
    playNoise(0.08, 0.1, 800)
    // Energy crackle
    playTone(1800, 'sine', 0.05, 0.06, 0.1)
    playTone(2200, 'sine', 0.04, 0.05, 0.14)
  },

  explosion() {
    // Plasma discharge — electric zap + deep space rumble
    // LAYER 1: Electric discharge crack
    playNoise(0.05, 0.5, 4000)
    playNoise(0.3, 0.35, 1200)

    // LAYER 2: Deep sub boom
    playSweep(180, 20, 'sine', 0.5, 0.5)
    playFM(80, 0.5, 4, 0.6, 0.4)

    // LAYER 3: Alien ring — high sci-fi metallic
    playSweep(1200, 200, 'sine', 0.4, 0.2, 0.05)
    playFM(440, 3.5, 2, 0.35, 0.15, 0.08)

    // LAYER 4: Electric arc (bandpass noise bursts)
    for (let i = 0; i < 3; i++) {
      playNoise(0.06, 0.15, 3000 + i * 500, i * 0.06)
    }
  },

  powerupCollect() {
    // Alien crystal chime — FM bell + ascending pentatonic sweep
    const notes = [528, 660, 792, 1056, 1320]
    for (let i = 0; i < notes.length; i++) {
      playFM(notes[i], 2, 1.5, 0.25, 0.12, i * 0.07)
      playTone(notes[i], 'sine', 0.2, 0.05, i * 0.07)
    }
    // Shimmer
    playSweep(800, 3000, 'sine', 0.3, 0.08, 0.1)
  },

  skullCollect() {
    // Alien warning — descending alien whine + dissonant FM
    playFM(400, 1.5, 4, 0.5, 0.3)
    playSweep(800, 100, 'sine', 0.6, 0.2)
    playFM(300, 2.7, 3, 0.4, 0.15, 0.15)
    // Alien voice texture
    for (let i = 0; i < 4; i++) {
      playTone(200 - i * 30, 'sawtooth', 0.08, 0.08, i * 0.1)
    }
  },

  playerDeath() {
    // Drone destruction — wailing frequency dive + electric death rattle
    playSweep(880, 55, 'sine', 0.8, 0.35)
    playFM(440, 2, 5, 0.7, 0.3)
    playNoise(0.6, 0.3, 1500, 0.1)
    // Digital glitch stutter
    const glitchFreqs = [700, 500, 800, 400, 600, 300, 400, 200]
    for (let i = 0; i < glitchFreqs.length; i++) {
      playTone(glitchFreqs[i], 'square', 0.04, 0.15, i * 0.07)
    }
    // Final sub thud
    playSweep(120, 10, 'sine', 0.5, 0.5, 0.5)
  },

  enemyDeath() {
    // Alien entity dissolve — glitchy FM squeal
    playFM(600, 2.2, 3, 0.2, 0.25)
    playSweep(800, 80, 'sine', 0.25, 0.2)
    playNoise(0.1, 0.15, 2000)
  },

  levelClear() {
    // Alien fanfare — otherworldly FM chord progression
    const notes = [264, 330, 396, 528, 660, 792]
    const times  = [0, 0.12, 0.24, 0.36, 0.52, 0.68]
    for (let i = 0; i < notes.length; i++) {
      playFM(notes[i], 2, 1.2, 0.4, 0.12, times[i])
      playToneWithVibrato(notes[i], 'sine', 0.35, 0.07, times[i], 6, 5)
    }
    // Space shimmer at the end
    playSweep(400, 2400, 'sine', 0.6, 0.08, 0.7)
    playNoise(0.4, 0.05, 5000, 0.7)
  },

  gateOpen() {
    // Warp gate activating — ascending alien scale with portal hum
    // Pentatonic alien scale (A-based)
    const notes = [220, 277, 330, 370, 440, 554, 659, 880]
    for (let i = 0; i < notes.length; i++) {
      playFM(notes[i], 1.5, 0.8, 0.18, 0.1, i * 0.06)
    }
    // Portal hum
    playToneWithVibrato(110, 'sine', 0.7, 0.08, 0.1, 4, 6)
    playSweep(200, 1200, 'sine', 0.5, 0.06, 0.2)
  },

  timerWarning() {
    // Proximity alarm — pulsing alien alert tone
    playFM(440, 1, 0.5, 0.12, 0.3)
    playFM(440, 1, 0.5, 0.12, 0.18)
  },

  gameStart() {
    // Launch sequence — system activation sweep
    playSweep(80, 600, 'sine', 0.3, 0.15)
    playFM(300, 2, 2, 0.25, 0.15, 0.2)
    playFM(450, 2, 1.5, 0.3, 0.12, 0.32)
    playFM(600, 2, 1.2, 0.35, 0.1, 0.44)
    // Final lock-on chime
    playTone(1200, 'sine', 0.3, 0.1, 0.56)
    playNoise(0.15, 0.06, 4000, 0.56)
  },

  teleport() {
    // Quantum tunnel warp — alien dimension shift
    playSweep(100, 3000, 'sine', 0.4, 0.2)
    playFM(500, 3, 5, 0.35, 0.2, 0.05)
    for (let i = 0; i < 8; i++) {
      playTone(300 + i * 150, 'sine', 0.08, 0.1, i * 0.04)
    }
    playSweep(3000, 100, 'sine', 0.35, 0.15, 0.28)
    playNoise(0.2, 0.12, 3000, 0.1)
  },

  kick() {
    // Plasma thrust kick — electromagnetic recoil
    playFM(100, 0.3, 2, 0.12, 0.25)
    playNoise(0.04, 0.1, 800)
    playSweep(300, 80, 'sine', 0.1, 0.15)
  },

  allEnemiesDead() {
    // Sector clear — triumphant alien chorus
    playFM(330, 2, 1.5, 0.6, 0.2)
    playFM(440, 2, 1.2, 0.5, 0.2, 0.15)
    playFM(660, 2, 1, 0.4, 0.3, 0.35)
    playSweep(200, 1600, 'sine', 0.5, 0.08, 0.2)
    playToneWithVibrato(880, 'sine', 0.8, 0.1, 0.5, 5, 12)
  },
}

// ─── BACKGROUND MUSIC — NOVA STRIKE SPACE SOUNDTRACK ─────────────────────────
// All tracks use alien pentatonic / modal scales with FM-style synthesis.
// Frequencies are tuned to give an ethereal, otherworldly, electronic feel.
//
// Scale reference used throughout:
//   "Alien Pentatonic" based on D Dorian + tritone substitutions:
//   D  E  F  A  C  (294, 330, 349, 440, 523 Hz)

const BGM_TRACKS = {
  menu: {
    // ── DRIFT PROTOCOL: Ambient space station floating ──
    // Slow, ethereal. Like being adrift in orbit with distant stars.
    // Uses a minor modal scale with slow pad chords.
    notes: [
      // 8-step: slow pads cycling around D minor modal
      294, 0, 0, 330, 0, 0, 392, 0,
      440, 0, 0, 392, 0, 0, 349, 0,
      294, 0, 0, 311, 0, 0, 370, 0,
      440, 0, 0, 415, 0, 0, 370, 311
    ],
    bass: [
      // Deep sub bass pulses — cosmic heartbeat
      73,  0, 0, 0, 73, 0, 0, 0,
      82,  0, 0, 0, 82, 0, 0, 0,
      73,  0, 0, 0, 73, 0, 0, 0,
      92,  0, 0, 0, 82, 0, 0, 0
    ],
    pad: [
      // Harmonizing high shimmer
      588, 0, 0, 0, 784, 0, 0, 0,
      880, 0, 0, 0, 784, 0, 0, 0,
      588, 0, 0, 0, 622, 0, 0, 0,
      880, 0, 0, 0, 740, 0, 0, 0
    ],
    drums: [
      // Very subtle sci-fi pulse — no snare, just light hi-hats and soft kick
      1, 0, 0, 3, 0, 0, 3, 0,
      1, 0, 0, 3, 0, 0, 3, 0,
      1, 0, 0, 3, 0, 0, 3, 0,
      1, 0, 0, 3, 2, 0, 3, 0
    ],
    tempo: 280,  // Very slow — ambient space pace
    type: 'sine',
  },

  world1: {
    // ── PULSE GRID: Energetic cyberpunk arena battle ──
    // A minor pentatonic (A C D E G) — bright, punchy, melodic.
    // Repeated 8-note motif that feels catchy and driving.
    // Tempo: fast 16th-note grid at 480 BPM steps.
    notes: [
      // Bar 1: Main motif — ascending then resolve
      220, 0, 262, 0, 294, 0, 330, 0,
      440, 330, 294, 0, 262, 0, 220, 0,
      // Bar 2: Second phrase — jump up, step down
      294, 0, 370, 0, 440, 0, 523, 0,
      587, 0, 523, 440, 0, 370, 294, 0,
      // Bar 3: Bridge — lower register groove
      220, 0, 247, 0, 294, 0, 330, 0,
      392, 330, 0, 294, 247, 0, 220, 0,
      // Bar 4: Build — high run then drop
      440, 523, 587, 659, 784, 0, 659, 0,
      587, 523, 440, 0, 370, 294, 220, 0,
    ],
    bass: [
      // Pumping quarter-note bass — root-fifth alternation
      110, 0, 0, 110, 0, 0, 165, 0,
      110, 0, 0, 110, 0, 0, 165, 0,
      147, 0, 0, 147, 0, 0, 220, 0,
      147, 0, 0, 147, 0, 0, 196, 0,
      110, 0, 0, 110, 0, 0, 165, 0,
      110, 0, 0, 110, 0, 0, 165, 0,
      110, 0, 0, 123, 0, 0, 147, 0,
      110, 0, 0, 0,   0, 0, 0,   0,
    ],
    pad: [
      // Off-beat chord stabs — Am / F / C / G
      0, 0, 523, 0, 0, 0, 0, 0,
      0, 0, 440, 0, 0, 0, 0, 0,
      0, 0, 494, 0, 0, 0, 0, 0,
      0, 0, 523, 0, 0, 0, 0, 0,
      0, 0, 440, 0, 0, 0, 0, 0,
      0, 0, 523, 0, 0, 0, 0, 0,
      0, 0, 587, 0, 0, 0, 0, 0,
      0, 0, 659, 0, 0, 0, 0, 0,
    ],
    drums: [
      // Standard 4/4 electronic — kick on 1+3, snare on 2+4, hi-hat 8ths
      1, 3, 3, 3, 2, 3, 1, 3,
      1, 3, 3, 3, 2, 3, 3, 3,
      1, 3, 3, 3, 2, 3, 1, 3,
      1, 3, 3, 3, 2, 3, 3, 3,
      1, 3, 3, 3, 2, 3, 1, 3,
      1, 3, 1, 3, 2, 3, 3, 3,
      1, 3, 3, 3, 2, 3, 1, 3,
      1, 1, 3, 3, 2, 3, 3, 3,
    ],
    tempo: 480,
    type: 'triangle',  // Softer than sawtooth — less harsh, more musical
  },

  world2: {
    // ── DEEP SECTOR: Dark, tense alien infiltration ──
    // D Phrygian (D Eb F G A Bb C) — minor with flat 2nd = very ominous.
    // Slow pulse creates creeping tension. Like moving through a dark alien ship.
    notes: [
      // Bar 1: Low sinister motif
      294, 0, 0, 0, 311, 0, 0, 0,
      330, 0, 0, 294, 0, 0, 0, 0,
      // Bar 2: Upper register — eerie melody
      440, 0, 0, 0, 415, 0, 0, 0,
      392, 0, 370, 0, 330, 0, 0, 0,
      // Bar 3: Repeat + variation
      294, 0, 0, 0, 311, 0, 349, 0,
      370, 0, 0, 349, 311, 0, 0, 0,
      // Bar 4: Tension peak — descend back to root
      523, 0, 0, 494, 0, 466, 440, 0,
      415, 0, 392, 0, 370, 311, 294, 0,
    ],
    bass: [
      // Very slow, heavy bass — only on key beats
      147, 0, 0, 0, 0, 0, 0, 0,
      155, 0, 0, 0, 0, 0, 0, 0,
      147, 0, 0, 0, 0, 0, 0, 0,
      175, 0, 0, 0, 0, 0, 0, 0,
      147, 0, 0, 0, 0, 0, 0, 0,
      155, 0, 0, 0, 0, 0, 0, 0,
      147, 0, 0, 0, 0, 0, 0, 0,
      196, 0, 0, 0, 185, 0, 0, 0,
    ],
    pad: [
      // Long, sustained dark chords held for 8 steps
      523, 0, 0, 0, 0, 0, 0, 0,
      554, 0, 0, 0, 0, 0, 0, 0,
      466, 0, 0, 0, 0, 0, 0, 0,
      494, 0, 0, 0, 0, 0, 0, 0,
      523, 0, 0, 0, 0, 0, 0, 0,
      440, 0, 0, 0, 0, 0, 0, 0,
      587, 0, 0, 0, 0, 0, 0, 0,
      659, 0, 0, 0, 0, 0, 0, 0,
    ],
    drums: [
      // Minimal, sparse — only hi-hats and rare kicks for maximum tension
      1, 0, 0, 3, 0, 0, 3, 0,
      0, 0, 2, 0, 0, 3, 0, 0,
      1, 0, 0, 3, 0, 0, 0, 3,
      0, 0, 2, 0, 3, 0, 0, 0,
      1, 0, 0, 3, 0, 0, 3, 0,
      0, 3, 2, 0, 0, 3, 0, 0,
      1, 0, 0, 0, 2, 0, 3, 0,
      1, 0, 3, 0, 2, 3, 0, 0,
    ],
    tempo: 380,  // Slow and menacing
    type: 'triangle',
  },

  boss: {
    // ── APEX ENTITY: Heavy driving alien boss confrontation ──
    // E Phrygian (E F G A B C D) — very dark, Spanish/alien feel.
    // Fast and heavy. Relentless.
    notes: [
      // Bar 1: Powerful low riff
      165, 0, 175, 165, 0, 196, 0, 220,
      0, 220, 0, 196, 175, 165, 0, 0,
      // Bar 2: Ascending tension
      165, 0, 220, 0, 262, 0, 294, 0,
      330, 0, 0, 294, 262, 0, 220, 0,
      // Bar 3: Middle section — aggressive push
      196, 196, 0, 220, 0, 247, 262, 0,
      294, 0, 262, 0, 247, 220, 196, 0,
      // Bar 4: Climax — high run then crash
      330, 392, 440, 523, 587, 659, 0, 659,
      587, 523, 494, 440, 392, 330, 294, 262,
    ],
    bass: [
      // HEAVY bass — driving 8th notes, power-metal style
      82, 0, 82, 0, 87,  0, 87,  0,
      82, 0, 82, 0, 87,  0, 82,  0,
      82, 0, 82, 82, 87, 0, 92,  0,
      98, 0, 98, 0, 104, 0, 110, 0,
      82, 0, 82, 0, 87,  0, 87,  0,
      82, 0, 82, 0, 87,  0, 82,  0,
      82, 82, 0, 92, 0, 98, 0, 104,
      110,0, 98, 0, 87,  0, 82,  0,
    ],
    pad: [
      // Distorted chord stabs — tritone tension
      0, 330, 0, 0, 0, 349, 0, 0,
      0, 311, 0, 0, 0, 330, 0, 0,
      0, 294, 0, 0, 0, 311, 0, 0,
      0, 330, 0, 0, 0, 392, 0, 0,
      0, 330, 0, 0, 0, 349, 0, 0,
      0, 311, 0, 0, 0, 330, 0, 0,
      0, 392, 0, 0, 0, 440, 0, 0,
      0, 523, 0, 0, 0, 587, 0, 0,
    ],
    drums: [
      // HEAVY 4/4 — double kick on 1 and the "e" of 3, relentless
      1, 3, 1, 3, 2, 3, 1, 3,
      1, 3, 1, 1, 2, 3, 1, 3,
      1, 3, 1, 3, 2, 3, 1, 3,
      1, 1, 3, 3, 2, 3, 3, 3,
      1, 3, 1, 3, 2, 3, 1, 3,
      1, 3, 1, 1, 2, 3, 1, 3,
      1, 3, 1, 3, 2, 3, 1, 3,
      1, 1, 1, 3, 2, 1, 3, 3,
    ],
    tempo: 560,  // Very fast and driving
    type: 'sawtooth',
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
    const note    = t.notes[i % t.notes.length]
    const bassNote = t.bass  ? t.bass[i  % t.bass.length]  : null
    const padNote  = t.pad   ? t.pad[i   % t.pad.length]   : null
    const drum     = t.drums ? t.drums[i % t.drums.length] : 0

    // ── MELODY: FM synthesis for alien metallic texture ──
    if (note > 0) {
      // Primary FM carrier + modulator for metallic tone
      const carrier = c.createOscillator()
      const modulator = c.createOscillator()
      const modGain = c.createGain()
      const outGain = c.createGain()

      carrier.type = t.type
      modulator.type = 'sine'
      carrier.frequency.value = note
      modulator.frequency.value = note * (track === 'boss' ? 2.8 : track === 'menu' ? 1.5 : 2.0)
      modGain.gain.value = note * (track === 'boss' ? 1.2 : track === 'menu' ? 0.4 : 0.8)

      outGain.gain.setValueAtTime(0, c.currentTime)
      outGain.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.015)
      outGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.75)

      modulator.connect(modGain)
      modGain.connect(carrier.frequency)
      carrier.connect(outGain)
      outGain.connect(masterGain)

      modulator.start(c.currentTime); modulator.stop(c.currentTime + beatLen)
      carrier.start(c.currentTime);   carrier.stop(c.currentTime + beatLen)
      bgmOscillators.push(carrier, modulator)

      // Second voice — slight detune for thickness (chorus)
      if (track !== 'menu') {
        const osc2 = c.createOscillator()
        const gain2 = c.createGain()
        osc2.type = t.type
        osc2.frequency.value = note * 1.006
        gain2.gain.setValueAtTime(0.03, c.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.7)
        osc2.connect(gain2); gain2.connect(masterGain)
        osc2.start(c.currentTime); osc2.stop(c.currentTime + beatLen)
        bgmOscillators.push(osc2)
      }
    }

    // ── PAD LAYER: Ethereal background chords ──
    if (padNote > 0) {
      const padOsc = c.createOscillator()
      const padGain = c.createGain()
      padOsc.type = track === 'menu' ? 'sine' : 'triangle'
      padOsc.frequency.value = padNote
      padGain.gain.setValueAtTime(0, c.currentTime)
      padGain.gain.linearRampToValueAtTime(track === 'menu' ? 0.04 : 0.025, c.currentTime + 0.05)
      padGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 1.6)
      padOsc.connect(padGain); padGain.connect(masterGain)
      padOsc.start(c.currentTime); padOsc.stop(c.currentTime + beatLen * 2)
      bgmOscillators.push(padOsc)
    }

    // ── SUB BASS: Deep space foundation ──
    if (bassNote > 0) {
      const bassOsc = c.createOscillator()
      const bassGain = c.createGain()
      bassOsc.type = 'sine'
      bassOsc.frequency.value = bassNote
      bassGain.gain.setValueAtTime(track === 'boss' ? 0.28 : 0.18, c.currentTime)
      bassGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.85)
      bassOsc.connect(bassGain); bassGain.connect(masterGain)
      bassOsc.start(c.currentTime); bassOsc.stop(c.currentTime + beatLen)
      bgmOscillators.push(bassOsc)

      // Sub octave for depth
      if (track === 'boss' || track === 'world1') {
        const subOsc = c.createOscillator()
        const subGain = c.createGain()
        subOsc.type = 'sine'
        subOsc.frequency.value = bassNote / 2
        subGain.gain.setValueAtTime(0.15, c.currentTime)
        subGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 0.7)
        subOsc.connect(subGain); subGain.connect(masterGain)
        subOsc.start(c.currentTime); subOsc.stop(c.currentTime + beatLen)
        bgmOscillators.push(subOsc)
      }
    }

    // ── DRUMS: Sci-fi electronic percussion ──
    if (drum > 0) {
      if (drum === 1) {
        // KICK: Deep sub thud — sine sweep
        const kickOsc = c.createOscillator()
        const kickGain = c.createGain()
        kickOsc.type = 'sine'
        kickOsc.frequency.setValueAtTime(track === 'boss' ? 180 : 120, c.currentTime)
        kickOsc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.12)
        kickGain.gain.setValueAtTime(track === 'boss' ? 0.5 : 0.35, c.currentTime)
        kickGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
        kickOsc.connect(kickGain); kickGain.connect(masterGain)
        kickOsc.start(c.currentTime); kickOsc.stop(c.currentTime + 0.25)
        bgmOscillators.push(kickOsc)
        // Transient click
        playNoise(0.015, track === 'boss' ? 0.25 : 0.15, 5000)
      } else if (drum === 2) {
        // SNARE/CLAP: Metallic electronic snare — bandpass noise
        playNoise(0.12, track === 'boss' ? 0.25 : 0.18, 2200)
        playNoise(0.08, 0.12, 800)
        playTone(220, 'sine', 0.05, track === 'boss' ? 0.12 : 0.08)
      } else if (drum === 3) {
        // HI-HAT: High-freq noise blip
        playNoise(0.03, track === 'menu' ? 0.03 : 0.06, 8000)
      }
    }

    // ── MENU: Extra slow LFO shimmer on every 4 beats ──
    if (track === 'menu' && i % 8 === 0) {
      // Slowly modulating atmospheric hum
      const shimmerOsc = c.createOscillator()
      const shimmerGain = c.createGain()
      shimmerOsc.type = 'sine'
      shimmerOsc.frequency.setValueAtTime(880 + (i % 4) * 110, c.currentTime)
      shimmerGain.gain.setValueAtTime(0, c.currentTime)
      shimmerGain.gain.linearRampToValueAtTime(0.018, c.currentTime + 0.3)
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + beatLen * 7)
      shimmerOsc.connect(shimmerGain); shimmerGain.connect(masterGain)
      shimmerOsc.start(c.currentTime); shimmerOsc.stop(c.currentTime + beatLen * 8)
      bgmOscillators.push(shimmerOsc)
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

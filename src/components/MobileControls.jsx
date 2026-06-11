import React, { useEffect, useState, useRef, useCallback } from 'react'
import { setVirtualKey } from '../game/input/input.js'

const JOYSTICK_RADIUS = 50
const KNOB_RADIUS = 22
const DEAD_ZONE = 10
const DPAD_SIZE = 120
const DPAD_BTN = 38

const CONTROL_TYPE_KEY = 'bm_control_type'
const CONTROL_OPACITY_KEY = 'bm_control_opacity'
const BOMB_SIZE_KEY = 'bm_bomb_size'
const BOMB_X_KEY = 'bm_bomb_x'
const BOMB_Y_KEY = 'bm_bomb_y'

export default function MobileControls({ hudData }) {
  const [isTouch, setIsTouch] = useState(false)
  const [controlType, setControlType] = useState(() => localStorage.getItem(CONTROL_TYPE_KEY) || 'analog')
  const [opacity, setOpacity] = useState(() => parseFloat(localStorage.getItem(CONTROL_OPACITY_KEY)) || 0.55)
  const [bombSize, setBombSize] = useState(() => parseFloat(localStorage.getItem(BOMB_SIZE_KEY)) || 68)
  const [bombX, setBombX] = useState(() => parseFloat(localStorage.getItem(BOMB_X_KEY)) || 24)
  const [bombY, setBombY] = useState(() => parseFloat(localStorage.getItem(BOMB_Y_KEY)) || 40)
  const [showSettings, setShowSettings] = useState(false)

  const joystickRef = useRef(null)
  const [joystick, setJoystick] = useState(null)
  const activeKeysRef = useRef(new Set())
  const joystickTouchIdRef = useRef(null)
  const dpadActiveRef = useRef(new Set())

  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouch(true)
    }
  }, [])

  const pressKey = useCallback((key) => {
    if (!activeKeysRef.current.has(key)) {
      activeKeysRef.current.add(key)
      setVirtualKey(key, true)
    }
  }, [])

  const releaseKey = useCallback((key) => {
    if (activeKeysRef.current.has(key)) {
      activeKeysRef.current.delete(key)
      setVirtualKey(key, false)
    }
  }, [])

  const releaseAll = useCallback(() => {
    for (const key of activeKeysRef.current) {
      setVirtualKey(key, false)
    }
    activeKeysRef.current.clear()
  }, [])

  const releaseDirections = useCallback(() => {
    releaseKey('ArrowUp')
    releaseKey('ArrowDown')
    releaseKey('ArrowLeft')
    releaseKey('ArrowRight')
  }, [releaseKey])

  // Must be AFTER releaseAll is defined (useCallback const doesn't hoist)
  useEffect(() => {
    // Release all keys when app loses focus / goes to background
    // This prevents stuck movement when user lifts finger during app switch
    const handleVisibility = () => {
      if (document.hidden) {
        releaseAll()
        setJoystick(null)
        joystickTouchIdRef.current = null
        dpadActiveRef.current.clear()
      }
    }
    const handleBlur = () => {
      releaseAll()
      setJoystick(null)
      joystickTouchIdRef.current = null
      dpadActiveRef.current.clear()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)

    // Safety net: periodically check if touches are gone but keys still pressed
    // This catches edge cases where touchend is swallowed by the system
    const safetyInterval = setInterval(() => {
      // If no joystick touch is active but direction keys are still pressed, release them
      if (joystickTouchIdRef.current === null && controlType === 'analog') {
        const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
        for (const d of dirs) {
          if (activeKeysRef.current.has(d)) {
            setVirtualKey(d, false)
            activeKeysRef.current.delete(d)
          }
        }
      }
    }, 200)

    return () => {
      releaseAll()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      clearInterval(safetyInterval)
    }
  }, [releaseAll, controlType])

  // ── JOYSTICK INPUT ──
  const applyJoystickInput = useCallback((dx, dy) => {
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < DEAD_ZONE) {
      releaseDirections()
      return
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      releaseKey('ArrowUp')
      releaseKey('ArrowDown')
      if (dx > 0) { pressKey('ArrowRight'); releaseKey('ArrowLeft') }
      else { pressKey('ArrowLeft'); releaseKey('ArrowRight') }
    } else {
      releaseKey('ArrowLeft')
      releaseKey('ArrowRight')
      if (dy > 0) { pressKey('ArrowDown'); releaseKey('ArrowUp') }
      else { pressKey('ArrowUp'); releaseKey('ArrowDown') }
    }
  }, [pressKey, releaseKey, releaseDirections])

  const onJoystickTouchStart = useCallback((e) => {
    e.preventDefault()
    if (joystickTouchIdRef.current !== null) return
    const touch = e.changedTouches[0]
    joystickTouchIdRef.current = touch.identifier
    setJoystick({
      baseX: touch.clientX,
      baseY: touch.clientY,
      knobX: touch.clientX,
      knobY: touch.clientY,
    })
  }, [])

  const onJoystickTouchMove = useCallback((e) => {
    e.preventDefault()
    if (joystickTouchIdRef.current === null) return
    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchIdRef.current) {
        setJoystick(prev => {
          if (!prev) return prev
          let dx = touch.clientX - prev.baseX
          let dy = touch.clientY - prev.baseY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > JOYSTICK_RADIUS) {
            dx = (dx / dist) * JOYSTICK_RADIUS
            dy = (dy / dist) * JOYSTICK_RADIUS
          }
          applyJoystickInput(dx, dy)
          return { ...prev, knobX: prev.baseX + dx, knobY: prev.baseY + dy }
        })
        break
      }
    }
  }, [applyJoystickInput])

  const onJoystickTouchEnd = useCallback((e) => {
    // We check both changedTouches (standard) and touches (fallback)
    let match = false
    if (e.changedTouches) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchIdRef.current) match = true
      }
    }
    // If our touch is no longer in active touches, it must have ended
    let stillActive = false
    if (e.touches) {
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === joystickTouchIdRef.current) stillActive = true
      }
    }
    
    if (match || !stillActive) {
      joystickTouchIdRef.current = null
      setJoystick(null)
      releaseDirections()
    }
  }, [releaseDirections])

  useEffect(() => {
    window.addEventListener('touchend', onJoystickTouchEnd)
    window.addEventListener('touchcancel', onJoystickTouchEnd)
    return () => {
      window.removeEventListener('touchend', onJoystickTouchEnd)
      window.removeEventListener('touchcancel', onJoystickTouchEnd)
    }
  }, [onJoystickTouchEnd])

  // ── D-PAD INPUT ──
  const onDpadDown = useCallback((dir) => (e) => {
    e.preventDefault()
    dpadActiveRef.current.add(dir)
    pressKey(dir)
  }, [pressKey])

  const onDpadUp = useCallback((dir) => (e) => {
    e.preventDefault()
    dpadActiveRef.current.delete(dir)
    releaseKey(dir)
  }, [releaseKey])

  // ── BOMB BUTTON ──
  const onBombStart = useCallback((e) => {
    e.preventDefault()
    pressKey('Space')
  }, [pressKey])

  const onBombEnd = useCallback((e) => {
    e.preventDefault()
    releaseKey('Space')
  }, [releaseKey])

  // ── DETONATE BUTTON ──
  const onDetonateStart = useCallback((e) => {
    e.preventDefault()
    pressKey('KeyE')
  }, [pressKey])

  const onDetonateEnd = useCallback((e) => {
    e.preventDefault()
    releaseKey('KeyE')
  }, [releaseKey])

  // ── SETTINGS ──
  const cycleControlType = useCallback(() => {
    setControlType(prev => {
      const next = prev === 'analog' ? 'dpad' : 'analog'
      localStorage.setItem(CONTROL_TYPE_KEY, next)
      releaseDirections()
      return next
    })
  }, [releaseDirections])

  const changeOpacity = useCallback((val) => {
    setOpacity(val)
    localStorage.setItem(CONTROL_OPACITY_KEY, val)
  }, [])

  const changeBombSize = useCallback((val) => {
    setBombSize(val)
    localStorage.setItem(BOMB_SIZE_KEY, val)
  }, [])

  const changeBombX = useCallback((val) => {
    setBombX(val)
    localStorage.setItem(BOMB_X_KEY, val)
  }, [])

  const changeBombY = useCallback((val) => {
    setBombY(val)
    localStorage.setItem(BOMB_Y_KEY, val)
  }, [])

  if (!isTouch) return null

  const baseOpacity = opacity

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 200,
      pointerEvents: 'none',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>

      {/* ── LEFT: Movement Controls ── */}
      {controlType === 'analog' ? (
        /* ANALOG JOYSTICK */
        <div
          ref={joystickRef}
          onTouchStart={onJoystickTouchStart}
          onTouchMove={onJoystickTouchMove}
          onTouchEnd={onJoystickTouchEnd}
          onTouchCancel={onJoystickTouchEnd}
          style={{
            position: 'absolute',
            left: 0, top: '20%',
            width: '45%', height: '80%',
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
        >
          {joystick && (
            <>
              <div style={{
                position: 'fixed',
                left: joystick.baseX - JOYSTICK_RADIUS,
                top: joystick.baseY - JOYSTICK_RADIUS,
                width: JOYSTICK_RADIUS * 2,
                height: JOYSTICK_RADIUS * 2,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(255,255,255,${0.06 * baseOpacity / 0.55}) 0%, rgba(255,255,255,${0.02 * baseOpacity / 0.55}) 100%)`,
                border: `2px solid rgba(255,255,255,${0.2 * baseOpacity})`,
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'fixed',
                left: joystick.knobX - KNOB_RADIUS,
                top: joystick.knobY - KNOB_RADIUS,
                width: KNOB_RADIUS * 2,
                height: KNOB_RADIUS * 2,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,${0.35 * baseOpacity}), rgba(255,255,255,${0.12 * baseOpacity}))`,
                border: `2px solid rgba(255,255,255,${0.45 * baseOpacity})`,
                boxShadow: `0 2px 10px rgba(0,0,0,${0.3 * baseOpacity})`,
                pointerEvents: 'none',
              }} />
            </>
          )}
          {/* Static hint when not touching */}
          {!joystick && (
            <div style={{
              position: 'absolute',
              left: '50%', bottom: '25%',
              transform: 'translateX(-50%)',
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
              borderRadius: '50%',
              border: `2px dashed rgba(255,255,255,${0.08 * baseOpacity / 0.55})`,
              pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: KNOB_RADIUS * 1.4,
                height: KNOB_RADIUS * 1.4,
                borderRadius: '50%',
                background: `rgba(255,255,255,${0.04 * baseOpacity / 0.55})`,
                border: `1px solid rgba(255,255,255,${0.08 * baseOpacity / 0.55})`,
              }} />
            </div>
          )}
        </div>
      ) : (
        /* D-PAD */
        <div style={{
          position: 'absolute',
          left: 16, bottom: 20,
          width: DPAD_SIZE, height: DPAD_SIZE,
          pointerEvents: 'auto',
          touchAction: 'none',
          opacity: baseOpacity,
        }}>
          {/* Center cross bg */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'grid',
            gridTemplateColumns: `${DPAD_BTN}px ${DPAD_BTN}px ${DPAD_BTN}px`,
            gridTemplateRows: `${DPAD_BTN}px ${DPAD_BTN}px ${DPAD_BTN}px`,
            gap: 2,
          }}>
            {/* Row 1: empty, UP, empty */}
            <div />
            <DpadButton dir="ArrowUp" onDown={onDpadDown} onUp={onDpadUp} label="▲" />
            <div />
            {/* Row 2: LEFT, center, RIGHT */}
            <DpadButton dir="ArrowLeft" onDown={onDpadDown} onUp={onDpadUp} label="◄" />
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
            }} />
            <DpadButton dir="ArrowRight" onDown={onDpadDown} onUp={onDpadUp} label="►" />
            {/* Row 3: empty, DOWN, empty */}
            <div />
            <DpadButton dir="ArrowDown" onDown={onDpadDown} onUp={onDpadUp} label="▼" />
            <div />
          </div>
        </div>
      )}

      {/* ── RIGHT: Bomb Button ── */}
      <div
        onTouchStart={onBombStart}
        onTouchEnd={onBombEnd}
        onTouchCancel={onBombEnd}
        style={{
          position: 'absolute',
          right: bombX, bottom: bombY,
          width: bombSize, height: bombSize,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, rgba(255,140,40,${0.7 * baseOpacity}), rgba(200,50,0,${0.5 * baseOpacity}))`,
          border: `3px solid rgba(255,160,60,${0.75 * baseOpacity})`,
          boxShadow: `0 0 20px rgba(255,100,0,${0.3 * baseOpacity}), inset 0 -3px 8px rgba(0,0,0,0.3)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: bombSize * 0.4, pointerEvents: 'none' }}>💣</span>
      </div>

      {/* ── RIGHT: Detonate Button (Only if Remote Powerup) ── */}
      {hudData?.hasRemote && (
        <div
          onTouchStart={onDetonateStart}
          onTouchEnd={onDetonateEnd}
          onTouchCancel={onDetonateEnd}
          style={{
            position: 'absolute',
            right: bombX + bombSize + 20, bottom: bombY + 10,
            width: bombSize * 0.8, height: bombSize * 0.8,
            borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, rgba(255,80,80,${0.7 * baseOpacity}), rgba(200,0,0,${0.5 * baseOpacity}))`,
            border: `3px solid rgba(255,100,100,${0.75 * baseOpacity})`,
            boxShadow: `0 0 20px rgba(255,50,50,${0.3 * baseOpacity}), inset 0 -3px 8px rgba(0,0,0,0.3)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            touchAction: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: bombSize * 0.35, pointerEvents: 'none' }}>💥</span>
        </div>
      )}

      {/* ── MOBILE STATS (compact, premium badges positioned above bomb button) ── */}
      {hudData && (
        <div style={{
          position: 'absolute',
          right: 12, bottom: 124,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
          opacity: baseOpacity * 0.95,
          alignItems: 'flex-end',
        }}>
          {/* Bomb */}
          <div style={{
            background: 'rgba(255,204,0,0.12)', border: '1px solid rgba(255,204,0,0.3)',
            borderRadius: 6, padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 10 }}>💣</span>
            <span style={{ fontFamily: '"Rajdhani", sans-serif', fontSize: 12, fontWeight: 800, color: '#ffcc00' }}>{hudData.maxBombs || 1}</span>
          </div>

          {/* Fire */}
          <div style={{
            background: 'rgba(255,112,64,0.12)', border: '1px solid rgba(255,112,64,0.3)',
            borderRadius: 6, padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 10 }}>🔥</span>
            <span style={{ fontFamily: '"Rajdhani", sans-serif', fontSize: 12, fontWeight: 800, color: '#ff7040' }}>{hudData.fireRange || 1}</span>
          </div>

          {/* Speed */}
          <div style={{
            background: 'rgba(0,232,122,0.12)', border: '1px solid rgba(0,232,122,0.3)',
            borderRadius: 6, padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 10 }}>⚡</span>
            <span style={{ fontFamily: '"Rajdhani", sans-serif', fontSize: 12, fontWeight: 800, color: '#00e87a' }}>{hudData.speed || 1}</span>
          </div>

          {/* Skull Effect */}
          {hudData.skullEffect && (
            <div style={{
              background: 'rgba(255,32,32,0.15)', border: '1px solid rgba(255,32,32,0.4)',
              borderRadius: 6, padding: '2px 6px',
              display: 'flex', alignItems: 'center', gap: 4,
              animation: 'pulseGlow 0.6s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 10 }}>☠</span>
              <span style={{ fontFamily: '"Rajdhani", sans-serif', fontSize: 10, fontWeight: 800, color: '#ff2020', letterSpacing: '0.05em' }}>{hudData.skullEffect.substring(0, 3).toUpperCase()}</span>
            </div>
          )}

          {/* Gate Open */}
          {hudData.gateOpen && (
            <div style={{
              background: 'rgba(255,204,0,0.15)', border: '1px solid rgba(255,204,0,0.4)',
              borderRadius: 6, padding: '2px 6px',
              display: 'flex', alignItems: 'center', gap: 4,
              animation: 'pulseGlow 1s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 10 }}>★</span>
              <span style={{ fontFamily: '"Rajdhani", sans-serif', fontSize: 10, fontWeight: 800, color: '#ffcc00', letterSpacing: '0.05em' }}>EXIT</span>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TOGGLE (tiny gear in bottom center) ── */}
      <div
        onClick={() => setShowSettings(p => !p)}
        style={{
          position: 'absolute',
          bottom: 4, left: '50%',
          transform: 'translateX(-50%)',
          width: 26, height: 26,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px',
          opacity: 0.4,
          pointerEvents: 'auto',
          touchAction: 'none',
          cursor: 'pointer',
        }}
      >
        ⚙
      </div>

      {/* ── SETTINGS PANEL (inline, minimal) ── */}
      {showSettings && (
        <div style={{
          position: 'absolute',
          bottom: 36, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(6,6,16,0.92)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontFamily: '"Rajdhani", "Outfit", sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          color: '#ccc',
          pointerEvents: 'auto',
          touchAction: 'none',
          zIndex: 210,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          minWidth: 180,
        }}>
          {/* Control type */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '9px' }}>CONTROLS</span>
            <div
              onClick={cycleControlType}
              style={{
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.3)',
                borderRadius: 5,
                padding: '3px 10px',
                color: '#00d4ff',
                cursor: 'pointer',
                fontSize: '10px',
                letterSpacing: '0.08em',
              }}
            >
              {controlType === 'analog' ? 'ANALOG' : 'D-PAD'}
            </div>
          </div>
          {/* Opacity */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '9px' }}>OPACITY</span>
            <input
              type="range"
              min="0.2" max="1.0" step="0.05"
              value={opacity}
              onChange={(e) => changeOpacity(parseFloat(e.target.value))}
              style={{
                width: 80, height: 4,
                accentColor: '#00d4ff',
                cursor: 'pointer',
              }}
            />
          </div>
          {/* Bomb Size */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '9px' }}>BOMB SIZE</span>
            <input
              type="range"
              min="40" max="120" step="2"
              value={bombSize}
              onChange={(e) => changeBombSize(parseFloat(e.target.value))}
              style={{
                width: 80, height: 4,
                accentColor: '#00d4ff',
                cursor: 'pointer',
              }}
            />
          </div>
          {/* Bomb X */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '9px' }}>BOMB POS X</span>
            <input
              type="range"
              min="10" max="200" step="2"
              value={bombX}
              onChange={(e) => changeBombX(parseFloat(e.target.value))}
              style={{
                width: 80, height: 4,
                accentColor: '#00d4ff',
                cursor: 'pointer',
              }}
            />
          </div>
          {/* Bomb Y */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', fontSize: '9px' }}>BOMB POS Y</span>
            <input
              type="range"
              min="10" max="200" step="2"
              value={bombY}
              onChange={(e) => changeBombY(parseFloat(e.target.value))}
              style={{
                width: 80, height: 4,
                accentColor: '#00d4ff',
                cursor: 'pointer',
              }}
            />
          </div>
          {/* Close */}
          <div
            onClick={() => setShowSettings(false)}
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '8px',
              letterSpacing: '0.15em',
              cursor: 'pointer',
              padding: '2px 0',
              marginTop: 4,
            }}
          >
            TAP TO CLOSE
          </div>
        </div>
      )}
    </div>
  )
}

// ── D-Pad Button Component ──
function DpadButton({ dir, onDown, onUp, label }) {
  const [pressed, setPressed] = useState(false)

  return (
    <div
      onTouchStart={(e) => { setPressed(true); onDown(dir)(e) }}
      onTouchEnd={(e) => { setPressed(false); onUp(dir)(e) }}
      onTouchCancel={(e) => { setPressed(false); onUp(dir)(e) }}
      style={{
        background: pressed
          ? 'rgba(0,212,255,0.25)'
          : 'rgba(255,255,255,0.08)',
        border: pressed
          ? '1.5px solid rgba(0,212,255,0.6)'
          : '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        color: pressed ? '#00d4ff' : 'rgba(255,255,255,0.4)',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.05s, border-color 0.05s',
      }}
    >
      {label}
    </div>
  )
}

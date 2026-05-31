import React, { useEffect, useState, useRef, useCallback } from 'react'
import { setVirtualKey } from '../game/input/input.js'

const JOYSTICK_RADIUS = 50
const KNOB_RADIUS = 22
const DEAD_ZONE = 10
const DPAD_SIZE = 120
const DPAD_BTN = 38

const CONTROL_TYPE_KEY = 'bm_control_type'
const CONTROL_OPACITY_KEY = 'bm_control_opacity'

export default function MobileControls({ hudData }) {
  const [isTouch, setIsTouch] = useState(false)
  const [controlType, setControlType] = useState(() => localStorage.getItem(CONTROL_TYPE_KEY) || 'analog')
  const [opacity, setOpacity] = useState(() => parseFloat(localStorage.getItem(CONTROL_OPACITY_KEY)) || 0.55)
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

  useEffect(() => {
    return () => { releaseAll() }
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
    e.preventDefault()
    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null
        setJoystick(null)
        releaseDirections()
        break
      }
    }
  }, [releaseDirections])

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
          right: 24, bottom: 40,
          width: 68, height: 68,
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
        <span style={{ fontSize: 28, pointerEvents: 'none' }}>💣</span>
      </div>

      {/* ── MOBILE STATS (compact, positioned above bomb button) ── */}
      {hudData && (
        <div style={{
          position: 'absolute',
          right: 10, bottom: 118,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          fontFamily: '"Rajdhani", "Outfit", sans-serif',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          pointerEvents: 'none',
          opacity: baseOpacity * 0.85,
          alignItems: 'flex-end',
        }}>
          <span style={{ color: '#f0c040' }}>💣{hudData.maxBombs || 1}</span>
          <span style={{ color: '#ff7040' }}>🔥{hudData.fireRange || 1}</span>
          <span style={{ color: '#00e87a' }}>⚡{hudData.speed || 1}</span>
          {hudData.skullEffect && (
            <span style={{ color: '#ff2020', animation: 'pulseGlow 0.6s infinite' }}>☠</span>
          )}
          {hudData.gateOpen && (
            <span style={{ color: '#f0c040' }}>★</span>
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

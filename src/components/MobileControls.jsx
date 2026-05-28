import React, { useEffect, useState, useRef, useCallback } from 'react'
import { setVirtualKey } from '../game/input/input.js'

const JOYSTICK_RADIUS = 55
const KNOB_RADIUS = 26
const DEAD_ZONE = 12

export default function MobileControls() {
  const [isTouch, setIsTouch] = useState(false)
  const joystickRef = useRef(null)
  const [joystick, setJoystick] = useState(null) // { baseX, baseY, knobX, knobY }
  const activeKeysRef = useRef(new Set())
  const joystickTouchIdRef = useRef(null)

  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouch(true)
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      releaseAll()
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

  // Convert joystick delta to key presses
  const applyJoystickInput = useCallback((dx, dy) => {
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < DEAD_ZONE) {
      releaseDirections()
      return
    }

    const angle = Math.atan2(dy, dx)

    // 4-directional snapping (like bomberman needs)
    // Right: -45° to 45°, Down: 45° to 135°, Left: 135° to -135°, Up: -135° to -45°
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      releaseKey('ArrowUp')
      releaseKey('ArrowDown')
      if (dx > 0) { pressKey('ArrowRight'); releaseKey('ArrowLeft') }
      else { pressKey('ArrowLeft'); releaseKey('ArrowRight') }
    } else {
      // Vertical dominant
      releaseKey('ArrowLeft')
      releaseKey('ArrowRight')
      if (dy > 0) { pressKey('ArrowDown'); releaseKey('ArrowUp') }
      else { pressKey('ArrowUp'); releaseKey('ArrowDown') }
    }
  }, [pressKey, releaseKey, releaseDirections])

  // ── JOYSTICK TOUCH HANDLERS ──
  const onJoystickTouchStart = useCallback((e) => {
    e.preventDefault()
    if (joystickTouchIdRef.current !== null) return // already tracking

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

          // Clamp to joystick radius
          if (dist > JOYSTICK_RADIUS) {
            dx = (dx / dist) * JOYSTICK_RADIUS
            dy = (dy / dist) * JOYSTICK_RADIUS
          }

          applyJoystickInput(dx, dy)

          return {
            ...prev,
            knobX: prev.baseX + dx,
            knobY: prev.baseY + dy,
          }
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

  // ── BOMB BUTTON ──
  const onBombStart = useCallback((e) => {
    e.preventDefault()
    pressKey('Space')
  }, [pressKey])

  const onBombEnd = useCallback((e) => {
    e.preventDefault()
    releaseKey('Space')
  }, [releaseKey])

  if (!isTouch) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
      pointerEvents: 'none',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>

      {/* LEFT HALF — Joystick Zone */}
      <div
        ref={joystickRef}
        onTouchStart={onJoystickTouchStart}
        onTouchMove={onJoystickTouchMove}
        onTouchEnd={onJoystickTouchEnd}
        onTouchCancel={onJoystickTouchEnd}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '50%',
          height: '100%',
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
      >
        {/* Joystick visual — only shows when touching */}
        {joystick && (
          <>
            {/* Base ring */}
            <div style={{
              position: 'fixed',
              left: joystick.baseX - JOYSTICK_RADIUS,
              top: joystick.baseY - JOYSTICK_RADIUS,
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              pointerEvents: 'none',
            }} />

            {/* Direction indicators on base */}
            <div style={{
              position: 'fixed',
              left: joystick.baseX - JOYSTICK_RADIUS,
              top: joystick.baseY - JOYSTICK_RADIUS,
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
              pointerEvents: 'none',
            }}>
              {/* Up arrow */}
              <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', opacity: 0.2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 4l-6 6h4v6h4v-6h4z"/></svg>
              </div>
              {/* Down arrow */}
              <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', opacity: 0.2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 20l6-6h-4v-6h-4v6h-4z"/></svg>
              </div>
              {/* Left arrow */}
              <div style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', opacity: 0.2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M4 12l6-6v4h6v4h-6v4z"/></svg>
              </div>
              {/* Right arrow */}
              <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', opacity: 0.2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20 12l-6 6v-4h-6v-4h6v-4z"/></svg>
              </div>
            </div>

            {/* Knob (thumb) */}
            <div style={{
              position: 'fixed',
              left: joystick.knobX - KNOB_RADIUS,
              top: joystick.knobY - KNOB_RADIUS,
              width: KNOB_RADIUS * 2,
              height: KNOB_RADIUS * 2,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.35), rgba(255,255,255,0.12))',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              transition: 'none',
            }} />
          </>
        )}
      </div>

      {/* RIGHT SIDE — Action Buttons */}
      <div style={{
        position: 'absolute',
        right: '20px',
        bottom: '40px',
        pointerEvents: 'auto',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* Bomb Button */}
        <div
          onTouchStart={onBombStart}
          onTouchEnd={onBombEnd}
          onTouchCancel={onBombEnd}
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, rgba(255, 130, 40, 0.65), rgba(180, 40, 0, 0.5))',
            border: '3px solid rgba(255, 160, 60, 0.7)',
            boxShadow: '0 0 24px rgba(255, 100, 0, 0.35), inset 0 -4px 10px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            userSelect: 'none',
            touchAction: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >💣</div>
      </div>

      {/* Subtle hint text */}
      <div style={{
        position: 'absolute',
        bottom: '6px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '7px',
        color: 'rgba(255,255,255,0.15)',
        fontFamily: '"Press Start 2P", monospace',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        DRAG TO MOVE · TAP 💣 TO BOMB
      </div>
    </div>
  )
}

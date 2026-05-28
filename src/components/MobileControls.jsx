import React, { useEffect, useState, useRef, useCallback } from 'react'
import { setVirtualKey } from '../game/input/input.js'

export default function MobileControls() {
  const [isTouch, setIsTouch] = useState(false)
  const activeKeysRef = useRef(new Set())

  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouch(true)
    }
  }, [])

  // Clear all virtual keys on unmount
  useEffect(() => {
    return () => {
      for (const key of activeKeysRef.current) {
        setVirtualKey(key, false)
      }
      activeKeysRef.current.clear()
    }
  }, [])

  const press = useCallback((key) => {
    activeKeysRef.current.add(key)
    setVirtualKey(key, true)
  }, [])

  const release = useCallback((key) => {
    activeKeysRef.current.delete(key)
    setVirtualKey(key, false)
  }, [])

  const handleTouch = useCallback((key) => ({
    onTouchStart: (e) => { e.preventDefault(); press(key) },
    onTouchEnd: (e) => { e.preventDefault(); release(key) },
    onTouchCancel: (e) => { e.preventDefault(); release(key) },
    // Also handle mouse for testing on desktop
    onMouseDown: (e) => { e.preventDefault(); press(key) },
    onMouseUp: (e) => { e.preventDefault(); release(key) },
    onMouseLeave: (e) => { release(key) },
  }), [press, release])

  if (!isTouch) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '200px',
      zIndex: 200,
      pointerEvents: 'none',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>

      {/* D-PAD (Left Side) */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        width: '160px',
        height: '160px',
        pointerEvents: 'auto',
        touchAction: 'none',
      }}>
        {/* Up */}
        <div {...handleTouch('ArrowUp')} style={{
          ...dpadBtn,
          top: 0,
          left: '55px',
          borderRadius: '14px 14px 6px 6px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 4l-8 8h5v8h6v-8h5z"/>
          </svg>
        </div>

        {/* Down */}
        <div {...handleTouch('ArrowDown')} style={{
          ...dpadBtn,
          bottom: 0,
          left: '55px',
          borderRadius: '6px 6px 14px 14px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 20l8-8h-5v-8h-6v8h-5z"/>
          </svg>
        </div>

        {/* Left */}
        <div {...handleTouch('ArrowLeft')} style={{
          ...dpadBtn,
          top: '55px',
          left: 0,
          borderRadius: '14px 6px 6px 14px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M4 12l8-8v5h8v6h-8v5z"/>
          </svg>
        </div>

        {/* Right */}
        <div {...handleTouch('ArrowRight')} style={{
          ...dpadBtn,
          top: '55px',
          right: 0,
          borderRadius: '6px 14px 14px 6px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M20 12l-8 8v-5h-8v-6h8v-5z"/>
          </svg>
        </div>

        {/* Center circle (decorative) */}
        <div style={{
          position: 'absolute',
          top: '55px',
          left: '55px',
          width: '50px',
          height: '50px',
          background: 'rgba(40, 40, 60, 0.6)',
          borderRadius: '8px',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ACTION BUTTONS (Right Side) */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        pointerEvents: 'auto',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}>
        {/* Bomb Button */}
        <div {...handleTouch('Space')} style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(255, 120, 30, 0.6), rgba(200, 50, 0, 0.5))',
          border: '3px solid rgba(255, 160, 60, 0.8)',
          boxShadow: '0 0 20px rgba(255, 100, 0, 0.4), inset 0 -3px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          color: 'white',
          userSelect: 'none',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}>💣</div>

        <span style={{
          fontSize: '9px',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: '"Press Start 2P", monospace',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>BOMB</span>
      </div>

      {/* Semi-transparent background strip so controls are visible over the game */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '190px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.7))',
        pointerEvents: 'none',
        zIndex: -1,
      }} />
    </div>
  )
}

const dpadBtn = {
  position: 'absolute',
  width: '50px',
  height: '50px',
  background: 'rgba(255, 255, 255, 0.12)',
  border: '2px solid rgba(255, 255, 255, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  touchAction: 'none',
  WebkitTapHighlightColor: 'transparent',
  cursor: 'pointer',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
}

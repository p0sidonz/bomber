import React, { useEffect, useState } from 'react'
import { setVirtualKey } from '../game/input/input.js'

export default function MobileControls() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    // Only show if the device supports touch
    const checkTouch = () => {
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        setIsTouch(true)
      }
    }
    checkTouch()
  }, [])

  if (!isTouch) return null

  const handleTouch = (key, isPressed) => (e) => {
    if (e.cancelable) e.preventDefault() // prevent highlighting/scrolling
    setVirtualKey(key, isPressed)
  }

  const btnStyle = {
    width: '50px',
    height: '50px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '2px solid rgba(255, 255, 255, 0.5)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: 'white',
    userSelect: 'none',
    touchAction: 'none', // disable native touch actions
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '0',
      right: '0',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 100,
      pointerEvents: 'none', // let clicks pass through the container
    }}>
      
      {/* D-PAD (Left Side) */}
      <div style={{ position: 'relative', width: '150px', height: '150px', pointerEvents: 'auto' }}>
        <div
          style={{ ...btnStyle, position: 'absolute', top: 0, left: '50px' }}
          onTouchStart={handleTouch('ArrowUp', true)}
          onTouchEnd={handleTouch('ArrowUp', false)}
          onTouchCancel={handleTouch('ArrowUp', false)}
        >▲</div>
        <div
          style={{ ...btnStyle, position: 'absolute', bottom: 0, left: '50px' }}
          onTouchStart={handleTouch('ArrowDown', true)}
          onTouchEnd={handleTouch('ArrowDown', false)}
          onTouchCancel={handleTouch('ArrowDown', false)}
        >▼</div>
        <div
          style={{ ...btnStyle, position: 'absolute', top: '50px', left: 0 }}
          onTouchStart={handleTouch('ArrowLeft', true)}
          onTouchEnd={handleTouch('ArrowLeft', false)}
          onTouchCancel={handleTouch('ArrowLeft', false)}
        >◀</div>
        <div
          style={{ ...btnStyle, position: 'absolute', top: '50px', right: 0 }}
          onTouchStart={handleTouch('ArrowRight', true)}
          onTouchEnd={handleTouch('ArrowRight', false)}
          onTouchCancel={handleTouch('ArrowRight', false)}
        >▶</div>
      </div>

      {/* ACTION BUTTON (Right Side) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', pointerEvents: 'auto' }}>
        <div
          style={{
            ...btnStyle,
            width: '70px',
            height: '70px',
            borderRadius: '50%', // Circle bomb button
            background: 'rgba(232, 80, 0, 0.4)',
            borderColor: 'rgba(255, 136, 0, 0.8)',
            boxShadow: '0 0 15px rgba(255,136,0,0.5)'
          }}
          onTouchStart={handleTouch('Space', true)}
          onTouchEnd={handleTouch('Space', false)}
          onTouchCancel={handleTouch('Space', false)}
        >💣</div>
      </div>

    </div>
  )
}

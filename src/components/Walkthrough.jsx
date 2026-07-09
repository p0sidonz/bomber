import { useState, useEffect, useCallback } from 'react'

const WALKTHROUGH_STEPS = [
  {
    id: 'welcome',
    title: 'WELCOME, PILOT',
    icon: '🚀',
    body: 'Welcome to Omega Arena! Let us give you a quick tour of everything you need to dominate the grid.',
    targetId: null,
    position: 'center',
  },
  {
    id: 'solo',
    title: 'SOLO MODE',
    icon: '⚔',
    body: 'Battle through 50 challenging sectors in the campaign. Destroy enemies, collect power-ups, and find the exit portal to advance!',
    targetId: 'menu-classic',
    position: 'below',
  },
  {
    id: 'multiplayer',
    title: 'MULTIPLAYER',
    icon: '◈',
    body: 'Host a game and invite friends with a room code, or join an existing arena. Last pilot standing wins!',
    targetId: 'menu-create',
    position: 'below',
  },
  {
    id: 'leaderboard',
    title: 'LEADERBOARD',
    icon: '♛',
    body: 'Compete for the top spot! Your best campaign scores are tracked globally.',
    targetId: 'menu-leaderboard',
    position: 'below',
  },
  {
    id: 'coins',
    title: 'EARN COINS',
    icon: '🪙',
    body: 'Coins let you buy loadouts, skip tough sectors, and more. You can earn free coins by watching short ads — look for the "Earn Coin" button in Settings and even in the pause menu during gameplay!',
    targetId: null,
    position: 'center',
  },
  {
    id: 'controls',
    title: 'CONTROLS',
    icon: '🎮',
    body: 'On mobile, use the analog joystick to move and the bomb button to plant plasma charges. On desktop, use arrow keys to move and SPACE to plant bombs.',
    targetId: null,
    position: 'center',
  },
  {
    id: 'done',
    title: 'YOU\'RE READY!',
    icon: '⭐',
    body: 'Start with Solo Mode to learn the ropes. Destroy walls to find power-ups and the hidden exit portal. Defeat all enemies to open the gate!',
    targetId: 'menu-classic',
    position: 'below',
  },
]

const STORAGE_KEY = 'bm_walkthrough_done'

export default function Walkthrough({ onComplete, forceShow = false }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [spotlightRect, setSpotlightRect] = useState(null)

  useEffect(() => {
    if (forceShow) {
      setStep(0)
      setVisible(true)
      return
    }
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Small delay to let menu render first
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [forceShow])

  // Update spotlight position when step changes
  useEffect(() => {
    if (!visible) return
    const currentStep = WALKTHROUGH_STEPS[step]
    if (currentStep?.targetId) {
      const el = document.getElementById(currentStep.targetId)
      if (el) {
        const rect = el.getBoundingClientRect()
        setSpotlightRect({
          x: rect.left - 8,
          y: rect.top - 6,
          width: rect.width + 16,
          height: rect.height + 12,
        })
      } else {
        setSpotlightRect(null)
      }
    } else {
      setSpotlightRect(null)
    }
  }, [step, visible])

  const handleNext = useCallback(() => {
    if (step < WALKTHROUGH_STEPS.length - 1) {
      setExiting(true)
      setTimeout(() => {
        setStep(s => s + 1)
        setExiting(false)
      }, 200)
    } else {
      // Done
      localStorage.setItem(STORAGE_KEY, 'true')
      setVisible(false)
      if (onComplete) onComplete()
    }
  }, [step, onComplete])

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
    if (onComplete) onComplete()
  }, [onComplete])

  if (!visible) return null

  const currentStep = WALKTHROUGH_STEPS[step]
  const isLast = step === WALKTHROUGH_STEPS.length - 1
  const isCenter = currentStep.position === 'center' || !spotlightRect

  // Calculate tooltip position using flex wrapper
  let wrapperStyle = {}
  if (isCenter) {
    wrapperStyle = {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9002,
      pointerEvents: 'none',
    }
  } else if (spotlightRect) {
    const tooltipTop = spotlightRect.y + spotlightRect.height + 16
    const maxTop = window.innerHeight - 280
    wrapperStyle = {
      position: 'fixed',
      top: Math.min(tooltipTop, maxTop),
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 9002,
      pointerEvents: 'none',
    }
  }

  return (
    <div className="walkthrough-overlay">
      {/* Dark overlay background */}
      <div
        className="walkthrough-overlay-bg"
        onClick={handleNext}
        style={spotlightRect ? {
          maskImage: `radial-gradient(ellipse ${spotlightRect.width * 0.6 + 30}px ${spotlightRect.height * 0.6 + 20}px at ${spotlightRect.x + spotlightRect.width / 2}px ${spotlightRect.y + spotlightRect.height / 2}px, transparent 65%, black 100%)`,
          WebkitMaskImage: `radial-gradient(ellipse ${spotlightRect.width * 0.6 + 30}px ${spotlightRect.height * 0.6 + 20}px at ${spotlightRect.x + spotlightRect.width / 2}px ${spotlightRect.y + spotlightRect.height / 2}px, transparent 65%, black 100%)`,
        } : {}}
      />

      {/* Spotlight ring around target */}
      {spotlightRect && (
        <div
          className="walkthrough-spotlight-ring"
          style={{
            position: 'fixed',
            left: spotlightRect.x,
            top: spotlightRect.y,
            width: spotlightRect.width,
            height: spotlightRect.height,
            borderRadius: 14,
            border: '2px solid rgba(0,212,255,0.6)',
            pointerEvents: 'none',
            zIndex: 9001,
          }}
        />
      )}

      {/* Tooltip Wrapper */}
      <div style={wrapperStyle}>
        {/* Tooltip Card */}
        <div
          className={exiting ? 'walkthrough-tooltip-exit' : 'walkthrough-tooltip'}
          key={step}
          style={{
            width: '90%',
            maxWidth: 360,
            pointerEvents: 'auto',
            background: 'linear-gradient(180deg, rgba(12,12,36,0.97) 0%, rgba(6,6,20,0.97) 100%)',
            border: '1.5px solid rgba(0,212,255,0.3)',
            borderRadius: 20,
            padding: '24px 24px 20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.12) inset',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(100,0,255,0.1))',
            border: '1px solid rgba(0,212,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            boxShadow: '0 0 15px rgba(0,212,255,0.2)',
            flexShrink: 0,
          }}>
            {currentStep.icon}
          </div>
          <div>
            <div style={{
              fontFamily: 'Rajdhani,Outfit,sans-serif',
              fontSize: 16, fontWeight: 800,
              letterSpacing: '0.1em', color: '#00d4ff',
            }}>
              {currentStep.title}
            </div>
            <div style={{
              fontFamily: 'Outfit,sans-serif',
              fontSize: 9, fontWeight: 600,
              letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)',
            }}>
              STEP {step + 1} OF {WALKTHROUGH_STEPS.length}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{
          fontFamily: 'Outfit,sans-serif',
          fontSize: 14, lineHeight: 1.6,
          color: 'rgba(255,255,255,0.75)',
          marginBottom: 20,
        }}>
          {currentStep.body}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {WALKTHROUGH_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step
                  ? 'linear-gradient(90deg, #00d4ff, #6644ff)'
                  : i < step
                    ? 'rgba(0,212,255,0.4)'
                    : 'rgba(255,255,255,0.1)',
                transition: 'all 0.3s ease',
                animation: i === step ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isLast && (
            <button
              onClick={handleSkip}
              style={{
                flex: 1,
                fontFamily: 'Rajdhani,Outfit,sans-serif',
                fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 16px',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              SKIP
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              flex: isLast ? 1 : 2,
              fontFamily: 'Rajdhani,Outfit,sans-serif',
              fontSize: 13, fontWeight: 800,
              letterSpacing: '0.1em',
              color: isLast ? '#00e87a' : '#00d4ff',
              background: isLast
                ? 'rgba(0,232,122,0.1)'
                : 'rgba(0,212,255,0.08)',
              border: `1.5px solid ${isLast ? 'rgba(0,232,122,0.4)' : 'rgba(0,212,255,0.35)'}`,
              padding: '10px 20px',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isLast
                ? '0 0 15px rgba(0,232,122,0.15)'
                : '0 0 15px rgba(0,212,255,0.1)',
            }}
          >
            {isLast ? 'LET\'S GO! →' : 'NEXT →'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

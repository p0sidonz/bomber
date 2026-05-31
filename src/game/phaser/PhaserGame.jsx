// ============================================================
// React wrapper for Phaser 3 game engine
// Mounts Phaser into a div, renders HUD overlay on top
// ============================================================
import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import GameScene from './GameScene.js'
import { toggleFullscreen } from '../audio/audio.js'

export default function PhaserGame({ stateRef, mode, userId, hudData }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Lock to landscape + immersive fullscreen on native
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {})
      // Try to hide status bar / nav bar via Android immersive
      try {
        if (window.StatusBar) window.StatusBar.hide()
        if (window.NavigationBar) window.NavigationBar.hide()
      } catch (_) {}
      // Fallback: request web fullscreen API
      try {
        const el = document.documentElement
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
      } catch (_) {}

      return () => {
        ScreenOrientation.lock({ orientation: 'portrait-primary' }).catch(() => {})
      }
    }
  }, [])

  // Auto-request fullscreen on first user touch (web mobile)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouchDevice) return

    const requestFS = () => {
      const el = document.documentElement
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
      }
      window.removeEventListener('touchstart', requestFS)
    }
    window.addEventListener('touchstart', requestFS, { once: true })
    return () => window.removeEventListener('touchstart', requestFS)
  }, [])

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1280,
      height: 720,
      backgroundColor: '#060610',
      pixelArt: false,
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
      smoothStepInterpolation: true,
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [],
      audio: { noAudio: true },
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
    }

    const game = new Phaser.Game(config)
    game.scene.add('GameScene', GameScene, true, { stateRef, mode, userId })
    gameRef.current = game

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Phaser canvas container */}
      <div
        ref={containerRef}
        id="phaser-container"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* ─── TOP HUD BAR ─── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        pointerEvents: 'none', zIndex: 10,
      }}>
        {mode === 'singleplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: isMobile ? '2px 8px' : '10px 28px',
            background: isMobile
              ? 'linear-gradient(180deg, rgba(6,6,16,0.88) 0%, rgba(6,6,16,0.4) 80%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(6,6,16,0.95) 0%, rgba(6,6,16,0.6) 70%, transparent 100%)',
            fontFamily: '"Rajdhani", "Outfit", sans-serif',
            fontSize: isMobile ? '11px' : '16px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            flexWrap: 'nowrap',
            gap: isMobile ? '6px' : '20px',
            minHeight: isMobile ? '28px' : 'auto',
          }}>
            {/* Left: Timer + Enemies */}
            <div style={{ display: 'flex', gap: isMobile ? '8px' : '24px', alignItems: 'center', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: isMobile ? '8px' : '12px', letterSpacing: '0.1em' }}>TIME</span>
                <span style={{
                  color: hudData.timerTicks < 600 ? '#ff4444' : '#ffffff',
                  textShadow: hudData.timerTicks < 600 ? '0 0 12px #ff4444' : 'none',
                  fontWeight: 700,
                }}>{hudData.timerStr}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: isMobile ? '8px' : '12px', letterSpacing: '0.1em' }}>EN</span>
                <span style={{ color: '#ff7040', fontWeight: 700 }}>{hudData.enemyCount}</span>
              </div>
            </div>

            {/* Center: Level */}
            <div style={{
              background: 'rgba(240,192,64,0.1)',
              border: '1px solid rgba(240,192,64,0.3)',
              borderRadius: isMobile ? 5 : 8,
              padding: isMobile ? '1px 7px' : '3px 14px',
              color: '#f0c040',
              textShadow: '0 0 12px rgba(240,192,64,0.6)',
              fontSize: isMobile ? '11px' : '18px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}>
              LV {String(hudData.level || 1).padStart(2, '0')}
            </div>

            {/* Right: Score + Lives + Pause */}
            <div style={{ display: 'flex', gap: isMobile ? '6px' : '24px', alignItems: 'center', minWidth: 0 }}>
              <span style={{ color: '#f0c040', fontWeight: 700, fontSize: isMobile ? '10px' : undefined }}>
                {String(hudData.score || 0).padStart(6, '0')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {Array.from({ length: Math.max(0, hudData.lives || 0) }).map((_, i) => (
                  <span key={i} style={{ color: '#ff3355', fontSize: isMobile ? '9px' : '15px', textShadow: '0 0 8px #ff3355' }}>♥</span>
                ))}
              </div>
              {/* Inline pause button on mobile */}
              {isMobile && (
                <div
                  style={{ cursor: 'pointer', pointerEvents: 'auto', opacity: 0.5, fontSize: '12px', marginLeft: 2 }}
                  onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
                >⚙️</div>
              )}
            </div>
          </div>
        )}

        {mode === 'multiplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: isMobile ? '12px' : '32px', alignItems: 'center',
            padding: isMobile ? '2px 8px' : '10px 28px',
            background: isMobile
              ? 'linear-gradient(180deg, rgba(6,6,16,0.88) 0%, rgba(6,6,16,0.4) 80%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(6,6,16,0.95) 0%, rgba(6,6,16,0.5) 70%, transparent 100%)',
            fontFamily: '"Rajdhani", "Outfit", sans-serif',
            fontWeight: 600,
          }}>
            {(hudData.players || []).map(p => (
              <div key={p.userId} style={{
                textAlign: 'center',
                opacity: (p.alive || p.respawning) ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }}>
                <div style={{
                  width: isMobile ? 8 : 12, height: isMobile ? 8 : 12, margin: '0 auto 2px',
                  backgroundColor: p.color || '#fff',
                  borderRadius: '50%',
                  boxShadow: p.alive ? `0 0 6px ${p.color || '#fff'}` : p.respawning ? '0 0 6px #ffaa00' : 'none',
                  border: p.respawning ? '2px solid #ffaa00' : 'none',
                }} />
                <div style={{ fontSize: isMobile ? '7px' : '11px', color: '#fff', letterSpacing: '0.05em' }}>{(p.name || '').substring(0, 5).toUpperCase()}</div>
                <div style={{ fontSize: isMobile ? '7px' : '11px', color: '#f0c040' }}>×{p.kills || 0}</div>
                <div style={{ fontSize: isMobile ? '8px' : '12px', marginTop: 1 }}>
                  {p.respawning
                    ? <span style={{ color: '#ffaa00', fontSize: isMobile ? '10px' : '14px' }}>↺</span>
                    : Array.from({ length: Math.max(0, p.lives ?? 3) }).map((_, i) => (
                        <span key={i} style={{ color: '#ff3355', textShadow: '0 0 6px #ff3355' }}>♥</span>
                      ))
                  }
                </div>
              </div>
            ))}
            <div style={{
              background: 'rgba(240,192,64,0.1)',
              border: '1px solid rgba(240,192,64,0.25)',
              borderRadius: isMobile ? 5 : 8,
              padding: isMobile ? '1px 7px' : '3px 14px',
              color: hudData.timerTicks < 400 ? '#ff4444' : '#f0c040',
              textShadow: hudData.timerTicks < 400 ? '0 0 12px #ff4444' : '0 0 8px rgba(240,192,64,0.5)',
              fontSize: isMobile ? '12px' : '20px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              marginLeft: 4,
            }}>{hudData.timerStr}</div>
            <div 
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', pointerEvents: 'auto', fontSize: isMobile ? '13px' : '18px', opacity: 0.5 }}
              onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
            >
              ⚙️
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM STATS BAR (singleplayer) ─── */}
      {mode === 'singleplayer' && hudData && !isMobile && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontFamily: '"Rajdhani", "Outfit", sans-serif',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          background: 'rgba(6,6,16,0.8)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '7px 18px',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <span style={{ color: '#f0c040', textShadow: '0 0 8px rgba(240,192,64,0.4)' }}>💣 {hudData.maxBombs || 1}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ color: '#ff7040', textShadow: '0 0 8px rgba(255,112,64,0.4)' }}>🔥 {hudData.fireRange || 1}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ color: '#00e87a', textShadow: '0 0 8px rgba(0,232,122,0.4)' }}>⚡ {hudData.speed || 1}</span>
          {hudData.skullEffect && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span style={{ color: '#ff2020', textShadow: '0 0 10px #ff2020', animation: 'pulseGlow 0.6s ease-in-out infinite' }}>
                ☠ {hudData.skullEffect.toUpperCase()}
              </span>
            </>
          )}
          {hudData.gateOpen && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span style={{ color: '#f0c040', textShadow: '0 0 12px rgba(240,192,64,0.7)' }}>★ EXIT OPEN</span>
            </>
          )}
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <div 
            style={{ cursor: 'pointer', pointerEvents: 'auto', opacity: 0.6, fontSize: '14px' }}
            onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
          >
            ⚙️
          </div>
        </div>
      )}

      {/* ─── FULLSCREEN BUTTON ─── */}
      {!Capacitor.isNativePlatform() && (
        <div
          onClick={toggleFullscreen}
          style={{
            position: 'absolute',
            top: isMobile ? '30px' : '42px',
            right: '8px',
            width: isMobile ? '24px' : '28px',
            height: isMobile ? '24px' : '28px',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 15,
            pointerEvents: 'auto',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            {isFullscreen ? (
              <>
                <polyline points="4 14 4 20 10 20" />
                <polyline points="20 10 20 4 14 4" />
                <line x1="14" y1="10" x2="20" y2="4" />
                <line x1="4" y1="20" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </div>
      )}
    </div>
  )
}

// ============================================================
// React wrapper for Phaser 3 game engine
// Mounts Phaser into a div, renders HUD overlay on top
// ============================================================
import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { StatusBar, Style } from '@capacitor/status-bar'
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

  // Lock to landscape + hide status bar on native
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {})
      StatusBar.hide().catch(() => {})
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})

      return () => {
        StatusBar.show().catch(() => {})
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

      {/* ─── TOP HUD BAR — Premium Native Game Feel ─── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        pointerEvents: 'none', zIndex: 10,
      }}>
        {mode === 'singleplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: isMobile ? '4px 6px' : '8px 20px',
            background: isMobile
              ? 'linear-gradient(180deg, rgba(4,4,14,0.92) 0%, rgba(4,4,14,0.5) 85%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(4,4,14,0.95) 0%, rgba(4,4,14,0.6) 80%, transparent 100%)',
            fontFamily: '"Rajdhani", "Outfit", sans-serif',
            fontWeight: 700,
            gap: isMobile ? 4 : 12,
          }}>
            {/* ── Left cluster: Timer + Enemies ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 10, minWidth: 0 }}>
              {/* Timer pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 5,
                background: hudData.timerTicks < 600
                  ? 'rgba(255,50,50,0.15)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hudData.timerTicks < 600 ? 'rgba(255,50,50,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6, padding: isMobile ? '2px 6px' : '3px 10px',
                transition: 'all 0.3s',
              }}>
                <span style={{
                  fontSize: isMobile ? 8 : 10, color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.08em',
                }}>⏱</span>
                <span style={{
                  fontSize: isMobile ? 11 : 16, fontWeight: 800,
                  color: hudData.timerTicks < 600 ? '#ff4444' : '#fff',
                  textShadow: hudData.timerTicks < 600 ? '0 0 10px rgba(255,68,68,0.8)' : 'none',
                  animation: hudData.timerTicks < 600 ? 'pulseGlow 0.5s ease-in-out infinite' : 'none',
                  letterSpacing: '0.06em',
                }}>{hudData.timerStr}</span>
              </div>

              {/* Enemies pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 2 : 4,
                background: hudData.enemyCount === 0 ? 'rgba(0,232,122,0.1)' : 'rgba(255,112,64,0.08)',
                border: `1px solid ${hudData.enemyCount === 0 ? 'rgba(0,232,122,0.3)' : 'rgba(255,112,64,0.2)'}`,
                borderRadius: 6, padding: isMobile ? '2px 6px' : '3px 10px',
                transition: 'all 0.3s',
              }}>
                <span style={{ fontSize: isMobile ? 8 : 11, color: 'rgba(255,255,255,0.3)' }}>👾</span>
                <span style={{
                  fontSize: isMobile ? 11 : 15, fontWeight: 800,
                  color: hudData.enemyCount === 0 ? '#00e87a' : '#ff7040',
                }}>{hudData.enemyCount}</span>
              </div>
            </div>

            {/* ── Center: Level Badge ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,204,0,0.12) 0%, rgba(255,120,0,0.08) 100%)',
              border: '1px solid rgba(255,204,0,0.35)',
              borderRadius: isMobile ? 6 : 8,
              padding: isMobile ? '2px 8px' : '4px 16px',
              textShadow: '0 0 10px rgba(255,204,0,0.5)',
              fontSize: isMobile ? 11 : 18, fontWeight: 900,
              letterSpacing: '0.1em', color: '#ffcc00',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(255,204,0,0.1)',
            }}>
              LV {String(hudData.level || 1).padStart(2, '0')}
            </div>

            {/* ── Right cluster: Score + Lives + Pause ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 10, minWidth: 0 }}>
              {/* Score pill */}
              <div style={{
                background: 'rgba(255,204,0,0.06)',
                border: '1px solid rgba(255,204,0,0.15)',
                borderRadius: 6, padding: isMobile ? '2px 6px' : '3px 10px',
                fontSize: isMobile ? 10 : 15, fontWeight: 800,
                color: '#ffcc00', letterSpacing: '0.05em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {String(hudData.score || 0).padStart(6, '0')}
              </div>

              {/* Lives */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 2,
                background: 'rgba(255,51,85,0.06)',
                border: '1px solid rgba(255,51,85,0.15)',
                borderRadius: 6, padding: isMobile ? '2px 5px' : '3px 8px',
              }}>
                {Array.from({ length: Math.max(0, hudData.lives || 0) }).map((_, i) => (
                  <span key={i} style={{
                    color: '#ff3355', fontSize: isMobile ? 9 : 14,
                    textShadow: '0 0 6px rgba(255,51,85,0.6)',
                  }}>♥</span>
                ))}
              </div>

              {/* Pause button */}
              {isMobile && (
                <div
                  onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
                  style={{
                    width: isMobile ? 24 : 30, height: isMobile ? 24 : 30,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', pointerEvents: 'auto',
                  }}
                >
                  <svg width={isMobile ? 10 : 12} height={isMobile ? 10 : 12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round">
                    <line x1="6" y1="4" x2="6" y2="20" />
                    <line x1="18" y1="4" x2="18" y2="20" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'multiplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: isMobile ? 8 : 20, alignItems: 'center',
            padding: isMobile ? '4px 8px' : '8px 24px',
            background: isMobile
              ? 'linear-gradient(180deg, rgba(4,4,14,0.92) 0%, rgba(4,4,14,0.5) 85%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(4,4,14,0.95) 0%, rgba(4,4,14,0.6) 80%, transparent 100%)',
            fontFamily: '"Rajdhani", "Outfit", sans-serif',
            fontWeight: 700,
            position: 'relative',
          }}>
            {(hudData.players || []).map(p => (
              <div key={p.userId} style={{
                textAlign: 'center',
                opacity: (p.alive || p.respawning) ? 1 : 0.3,
                transition: 'opacity 0.3s',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: isMobile ? '3px 6px' : '4px 10px',
              }}>
                <div style={{
                  width: isMobile ? 8 : 12, height: isMobile ? 8 : 12, margin: '0 auto 2px',
                  backgroundColor: p.color || '#fff',
                  borderRadius: '50%',
                  boxShadow: p.alive ? `0 0 6px ${p.color || '#fff'}` : p.respawning ? '0 0 6px #ffaa00' : 'none',
                  border: p.respawning ? '2px solid #ffaa00' : 'none',
                }} />
                <div style={{ fontSize: isMobile ? 7 : 11, color: '#fff', letterSpacing: '0.05em' }}>{(p.name || '').substring(0, 5).toUpperCase()}</div>
                <div style={{ fontSize: isMobile ? 7 : 11, color: '#f0c040' }}>×{p.kills || 0}</div>
                <div style={{ fontSize: isMobile ? 8 : 12, marginTop: 1 }}>
                  {p.respawning
                    ? <span style={{ color: '#ffaa00', fontSize: isMobile ? 10 : 14 }}>↺</span>
                    : Array.from({ length: Math.max(0, p.lives ?? 3) }).map((_, i) => (
                        <span key={i} style={{ color: '#ff3355', textShadow: '0 0 6px #ff3355' }}>♥</span>
                      ))
                  }
                </div>
              </div>
            ))}

            {/* Timer */}
            <div style={{
              background: hudData.timerTicks < 400 ? 'rgba(255,50,50,0.12)' : 'rgba(255,204,0,0.08)',
              border: `1px solid ${hudData.timerTicks < 400 ? 'rgba(255,50,50,0.4)' : 'rgba(255,204,0,0.25)'}`,
              borderRadius: isMobile ? 6 : 8,
              padding: isMobile ? '2px 8px' : '4px 14px',
              color: hudData.timerTicks < 400 ? '#ff4444' : '#f0c040',
              textShadow: hudData.timerTicks < 400 ? '0 0 10px #ff4444' : '0 0 8px rgba(240,192,64,0.5)',
              fontSize: isMobile ? 12 : 20, fontWeight: 800,
              letterSpacing: '0.05em',
            }}>{hudData.timerStr}</div>

            {/* Pause */}
            <div
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                width: isMobile ? 26 : 32, height: isMobile ? 26 : 32,
                borderRadius: 7,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', pointerEvents: 'auto',
              }}
              onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
            >
              <svg width={isMobile ? 10 : 12} height={isMobile ? 10 : 12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round">
                <line x1="6" y1="4" x2="6" y2="20" />
                <line x1="18" y1="4" x2="18" y2="20" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM STATS BAR (singleplayer, desktop) ─── */}
      {mode === 'singleplayer' && hudData && !isMobile && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 6, alignItems: 'center',
          fontFamily: '"Rajdhani", "Outfit", sans-serif',
          fontSize: 14, fontWeight: 700,
          pointerEvents: 'none', zIndex: 10,
        }}>
          {/* Bomb stat */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.2)',
            borderRadius: 7, padding: '5px 12px',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 13 }}>💣</span>
            <span style={{ color: '#ffcc00', textShadow: '0 0 6px rgba(255,204,0,0.4)' }}>{hudData.maxBombs || 1}</span>
          </div>
          {/* Fire stat */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,112,64,0.08)', border: '1px solid rgba(255,112,64,0.2)',
            borderRadius: 7, padding: '5px 12px',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ color: '#ff7040', textShadow: '0 0 6px rgba(255,112,64,0.4)' }}>{hudData.fireRange || 1}</span>
          </div>
          {/* Speed stat */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.2)',
            borderRadius: 7, padding: '5px 12px',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <span style={{ color: '#00e87a', textShadow: '0 0 6px rgba(0,232,122,0.4)' }}>{hudData.speed || 1}</span>
          </div>
          {/* Skull effect */}
          {hudData.skullEffect && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,32,32,0.12)', border: '1px solid rgba(255,32,32,0.3)',
              borderRadius: 7, padding: '5px 12px',
              animation: 'pulseGlow 0.6s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 13 }}>☠</span>
              <span style={{ color: '#ff2020', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em' }}>
                {hudData.skullEffect.toUpperCase()}
              </span>
            </div>
          )}
          {/* Gate open */}
          {hudData.gateOpen && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,204,0,0.1)', border: '1px solid rgba(255,204,0,0.3)',
              borderRadius: 7, padding: '5px 12px',
              animation: 'pulseGlow 1s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 13 }}>★</span>
              <span style={{ color: '#ffcc00', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em' }}>EXIT</span>
            </div>
          )}
          {/* Pause */}
          <div
            onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', pointerEvents: 'auto',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeLinecap="round">
              <line x1="6" y1="4" x2="6" y2="20" />
              <line x1="18" y1="4" x2="18" y2="20" />
            </svg>
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

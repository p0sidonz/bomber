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

  // Lock to landscape orientation on native mobile when playing
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.lock({ orientation: 'landscape' }).catch(e => console.error('Failed to lock orientation', e))
      return () => {
        ScreenOrientation.lock({ orientation: 'portrait-primary' }).catch(e => console.error('Failed to unlock orientation', e))
      }
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1280,
      height: 720,
      backgroundColor: '#0a0a14',
      pixelArt: false,
      antialias: true,
      roundPixels: false,
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
            padding: isMobile ? '6px 12px' : '8px 24px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 80%, transparent 100%)',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: isMobile ? '7px' : '9px',
            flexWrap: 'nowrap',
            gap: isMobile ? '8px' : '16px',
          }}>
            <div style={{ display: 'flex', gap: isMobile ? '8px' : '20px', alignItems: 'center', minWidth: 0 }}>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: '#909090', fontSize: isMobile ? '6px' : '7px' }}>TIME </span>
                <span style={{
                  color: hudData.timerTicks < 600 ? '#ff4040' : '#ffffff',
                }}>{hudData.timerStr}</span>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: '#909090', fontSize: isMobile ? '6px' : '7px' }}>EN </span>
                <span style={{ color: '#ff8040' }}>{hudData.enemyCount}</span>
              </div>
            </div>

            <div style={{
              color: '#f0c040',
              textShadow: '0 0 8px #f0c04080',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              LV {String(hudData.level || 1).padStart(2, '0')}
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '8px' : '20px', alignItems: 'center', minWidth: 0 }}>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: '#909090', fontSize: isMobile ? '6px' : '7px' }}>SC </span>
                <span style={{ color: '#f0c040' }}>{String(hudData.score || 0).padStart(6, '0')}</span>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: '#ff4040', fontSize: isMobile ? '10px' : '12px' }}>
                  {'♥'.repeat(Math.max(0, hudData.lives || 0))}
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'multiplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: isMobile ? '12px' : '28px', alignItems: 'center',
            padding: isMobile ? '6px 12px' : '8px 24px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 80%, transparent 100%)',
            fontFamily: '"Press Start 2P", monospace',
          }}>
            {(hudData.players || []).map(p => (
              <div key={p.userId} style={{ textAlign: 'center', opacity: p.alive ? 1 : 0.4 }}>
                <div style={{
                  width: 10, height: 10, margin: '0 auto 3px',
                  backgroundColor: p.color || '#fff',
                  border: p.alive ? '2px solid #fff' : '2px solid #555',
                  borderRadius: 2,
                }} />
                <div style={{ fontSize: '6px', color: '#fff' }}>{(p.name || '').substring(0, 5)}</div>
                <div style={{ fontSize: '6px', color: '#f0c040' }}>×{p.kills || 0}</div>
              </div>
            ))}
            <div style={{
              color: hudData.timerTicks < 400 ? '#ff4040' : '#f0c040',
              fontSize: isMobile ? '10px' : '13px', marginLeft: 8,
            }}>{hudData.timerStr}</div>
            <div 
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', pointerEvents: 'auto', fontSize: isMobile ? '14px' : '16px' }}
              onClick={() => window.dispatchEvent(new CustomEvent('hw_back_pressed'))}
            >
              ⚙️
            </div>
          </div>
        )}
      </div>

      {/* ─── BOTTOM STATS BAR (singleplayer) — avoid mobile controls area ─── */}
      {mode === 'singleplayer' && hudData && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? '5px' : '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: isMobile ? 12 : 20,
          fontFamily: '"Press Start 2P", monospace',
          background: 'rgba(0,0,0,0.55)',
          padding: isMobile ? '4px 10px' : '6px 16px',
          borderRadius: 8,
          fontSize: isMobile ? '7px' : '8px',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ color: '#f0c040' }}>B×{hudData.maxBombs || 1}</span>
          <span style={{ color: '#ff6020' }}>F×{hudData.fireRange || 1}</span>
          <span style={{ color: '#40c040' }}>S×{hudData.speed || 1}</span>
          {hudData.skullEffect && (
            <span style={{ color: '#ff2020' }}>⚠{hudData.skullEffect.toUpperCase()}</span>
          )}
          {hudData.gateOpen && (
            <span style={{ color: '#ffffa0' }}>★EXIT</span>
          )}
          <span style={{ color: '#666' }}>|</span>
          <div 
            style={{ cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '10px' : '12px' }}
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
            top: isMobile ? '34px' : '42px',
            right: '8px',
            width: '28px',
            height: '28px',
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
            {isFullscreen ? (
              // Exit fullscreen icon
              <>
                <polyline points="4 14 4 20 10 20" />
                <polyline points="20 10 20 4 14 4" />
                <line x1="14" y1="10" x2="20" y2="4" />
                <line x1="4" y1="20" x2="10" y2="14" />
              </>
            ) : (
              // Enter fullscreen icon
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

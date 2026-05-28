// ============================================================
// React wrapper for Phaser 3 game engine
// Mounts Phaser into a div, renders HUD overlay on top
// ============================================================
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import GameScene from './GameScene.js'

export default function PhaserGame({ stateRef, mode, userId, hudData }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

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
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [], // no auto-start scenes
      audio: { noAudio: true }, // we handle audio via Web Audio API
      fps: {
        target: 60,
        forceSetTimeOut: false,
      },
    }

    const game = new Phaser.Game(config)
    // Add and start scene with data
    game.scene.add('GameScene', GameScene, true, { stateRef, mode, userId })
    gameRef.current = game

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* Phaser canvas container */}
      <div
        ref={containerRef}
        id="phaser-container"
        className="w-full h-full"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* HUD Overlay */}
      <div className="phaser-hud" style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        pointerEvents: 'none', zIndex: 10,
      }}>
        {mode === 'singleplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 24px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)',
            fontFamily: '"Press Start 2P", monospace',
          }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#909090', fontSize: '8px' }}>TIME </span>
                <span style={{
                  color: hudData.timerTicks < 600 ? '#ff4040' : '#ffffff',
                  fontSize: '11px',
                }}>{hudData.timerStr}</span>
              </div>
              <div>
                <span style={{ color: '#909090', fontSize: '8px' }}>ENEMIES </span>
                <span style={{ color: '#ff8040', fontSize: '11px' }}>{hudData.enemyCount}</span>
              </div>
            </div>
            <div style={{ color: '#f0c040', fontSize: '11px', textShadow: '0 0 8px #f0c04080' }}>
              LEVEL {String(hudData.level || 1).padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#909090', fontSize: '8px' }}>SCORE </span>
                <span style={{ color: '#f0c040', fontSize: '11px' }}>{String(hudData.score || 0).padStart(6, '0')}</span>
              </div>
              <div>
                <span style={{ color: '#909090', fontSize: '8px' }}>LIVES </span>
                <span style={{ color: '#ff4040', fontSize: '13px' }}>
                  {'♥'.repeat(Math.max(0, hudData.lives || 0))}
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'multiplayer' && hudData && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '28px', alignItems: 'center',
            padding: '10px 24px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)',
            fontFamily: '"Press Start 2P", monospace',
          }}>
            {(hudData.players || []).map(p => (
              <div key={p.userId} style={{ textAlign: 'center', opacity: p.alive ? 1 : 0.4 }}>
                <div style={{
                  width: 12, height: 12, margin: '0 auto 4px',
                  backgroundColor: p.color || '#fff',
                  border: p.alive ? '2px solid #fff' : '2px solid #555',
                }} />
                <div style={{ fontSize: '7px', color: '#fff' }}>{(p.name || '').substring(0, 6)}</div>
                <div style={{ fontSize: '7px', color: '#f0c040' }}>×{p.kills || 0}</div>
              </div>
            ))}
            <div style={{
              color: hudData.timerTicks < 400 ? '#ff4040' : '#f0c040',
              fontSize: '13px', marginLeft: 16,
            }}>{hudData.timerStr}</div>
          </div>
        )}

        {/* Powerups bar (singleplayer) */}
        {mode === 'singleplayer' && hudData?.powerups?.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 80, left: 16,
            display: 'flex', gap: 4, flexDirection: 'column',
            fontFamily: '"Press Start 2P", monospace',
          }}>
            {hudData.powerups.map((pw, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: 4,
              }}>
                <div style={{ width: 10, height: 10, backgroundColor: pw.color }} />
                <span style={{ color: '#ccc', fontSize: '6px' }}>{pw.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats bar (singleplayer) */}
        {mode === 'singleplayer' && hudData && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 24,
            fontFamily: '"Press Start 2P", monospace',
            background: 'rgba(0,0,0,0.5)', padding: '6px 16px', borderRadius: 8,
            fontSize: '8px',
          }}>
            <span style={{ color: '#f0c040' }}>BOMB ×{hudData.maxBombs || 1}</span>
            <span style={{ color: '#ff6020' }}>FIRE ×{hudData.fireRange || 1}</span>
            <span style={{ color: '#40c040' }}>SPD ×{hudData.speed || 1}</span>
            {hudData.skullEffect && (
              <span style={{ color: '#ff2020' }}>⚠ {hudData.skullEffect.toUpperCase()}</span>
            )}
            {hudData.gateOpen && (
              <span style={{ color: '#ffffa0' }}>★ EXIT OPEN</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

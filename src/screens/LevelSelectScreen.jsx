import { useState, useEffect } from 'react'
import { playBGM } from '../game/audio/audio'

const DEBUG = true // set to false to lock levels again

export default function LevelSelectScreen({ user, campaign, nav }) {
  useEffect(() => {
    playBGM('menu')
  }, [])

  const maxLevel = Math.min(50, Math.max(1, campaign?.maxLevel || 1))
  const effectiveMaxLevel = DEBUG ? 50 : maxLevel

  function handleSelect(level) {
    if (level <= effectiveMaxLevel) {
      nav('classic', { level })
    }
  }

  // Generate chunks of 5 for boustrophedon (winding) layout
  const chunks = []
  for (let i = 0; i < 10; i++) {
    const chunk = []
    for (let j = 1; j <= 5; j++) {
      chunk.push(i * 5 + j)
    }
    // Reverse odd rows so the path snakes back and forth
    if (i % 2 !== 0) chunk.reverse()
    chunks.push(chunk)
  }

  return (
    <div className="full-screen bg-bm-dark relative overflow-hidden flex flex-col items-center pt-8 pb-4">
      <div className="absolute inset-0 bg-[#020513] overflow-hidden z-0">
        <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, #00d4ff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          background: 'radial-gradient(circle at 50% -20%, rgba(0, 212, 255, 0.4) 0%, transparent 60%)'
        }} />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 shrink-0 bg-[#050a1f]/60 p-4 rounded-2xl border border-cyan-500/20 shadow-[0_0_30px_rgba(0,212,255,0.1)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent translate-x-[-100%] animate-[shimmer_3s_infinite]" />
          <div>
            <h1 className="logo-text text-2xl sm:text-4xl mb-0 text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-300 drop-shadow-[0_0_10px_rgba(0,212,255,0.5)] tracking-widest uppercase">
              SECTOR MAP
            </h1>
            <p className="text-[10px] tracking-[0.2em] font-bold" style={{ color: '#00d4ff', textShadow: '0 0 5px rgba(0,212,255,0.5)' }}>
              TACTICAL DEPLOYMENT GRID
            </p>
          </div>
          <button 
            className="btn-pixel bg-[#0a122a] text-cyan-300 border border-cyan-800 hover:bg-cyan-900/40 hover:border-cyan-400 hover:scale-105 transition-all shadow-[0_0_15px_rgba(0,212,255,0.15)] px-4 py-2" 
            onClick={() => nav('landing')}
          >
            ← ABORT
          </button>
        </div>

        {/* Winding Path Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-2 sm:px-4">
          <div className="flex flex-col gap-[72px] max-w-[400px] mx-auto relative pt-8">
            {chunks.map((row, rowIndex) => (
              <div 
                key={rowIndex} 
                className="flex justify-between relative z-10"
              >
                {/* Horizontal connecting line behind the nodes */}
                <div className="absolute top-1/2 left-8 right-8 h-[2px] bg-cyan-900/30 -translate-y-1/2 z-[-1]" />
                <div className="absolute top-1/2 left-8 right-8 h-[2px] bg-gradient-to-r from-cyan-500/0 via-cyan-400/50 to-cyan-500/0 -translate-y-1/2 z-[-1] shadow-[0_0_8px_rgba(0,212,255,0.5)]" />
                
                {/* Vertical connecting track to the next row */}
                {rowIndex < 9 && (
                  <>
                    <div className={`
                      absolute bottom-[-72px] w-[2px] h-[72px] bg-cyan-900/30 z-[-1]
                      ${rowIndex % 2 === 0 ? 'right-[29px]' : 'left-[29px]'}
                    `} />
                    <div className={`
                      absolute bottom-[-72px] w-[2px] h-[72px] bg-gradient-to-b from-cyan-400/50 to-cyan-500/0 z-[-1] shadow-[0_0_8px_rgba(0,212,255,0.5)]
                      ${rowIndex % 2 === 0 ? 'right-[29px]' : 'left-[29px]'}
                    `} />
                  </>
                )}

                {row.map((level) => {
                  const isUnlocked = level <= effectiveMaxLevel
                  const isCurrent = level === maxLevel
                  const isCompleted = level < maxLevel || (DEBUG && level > maxLevel)

                  return (
                    <div key={level} className="relative flex justify-center w-[60px] group">
                      <button
                        onClick={() => handleSelect(level)}
                        disabled={!isUnlocked}
                        className={`
                          w-[58px] h-[66px] flex items-center justify-center transition-all duration-300 relative
                          ${isCurrent 
                            ? 'cursor-pointer scale-110 z-20' 
                            : isCompleted 
                              ? 'cursor-pointer hover:scale-110 z-10'
                              : 'cursor-not-allowed opacity-50 grayscale'
                          }
                        `}
                        style={{
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                          background: isCurrent 
                            ? 'linear-gradient(135deg, #ffcc00, #ff6600)' 
                            : isCompleted 
                              ? 'linear-gradient(135deg, rgba(0,212,255,0.8), rgba(0,100,255,0.8))'
                              : '#1a2035',
                          padding: '2px' // Border thickness
                        }}
                      >
                        {/* Inner Hexagon (The Fill) */}
                        <div 
                          className="w-full h-full flex items-center justify-center relative overflow-hidden"
                          style={{
                            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                            background: isCurrent
                              ? 'linear-gradient(135deg, #2a1100, #4a2200)'
                              : isCompleted
                                ? '#051024'
                                : '#0a0f1c'
                          }}
                        >
                          {/* Inner glow effect */}
                          {isCurrent && <div className="absolute inset-0 bg-yellow-500/20 animate-pulse" />}
                          {isCompleted && !isCurrent && <div className="absolute inset-0 bg-cyan-500/10 group-hover:bg-cyan-400/30 transition-colors" />}

                          {isCurrent ? (
                            <span className="text-xl animate-pulse" style={{ color: '#ffcc00', filter: 'drop-shadow(0 0 5px #ffaa00)' }}>◉</span>
                          ) : isCompleted ? (
                            <span style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: '#00d4ff', textShadow: '0 0 8px rgba(0,212,255,0.6)' }}>
                              {level}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">🔒</span>
                          )}
                        </div>
                      </button>

                      {/* External Glow for active/completed */}
                      {isCurrent && (
                        <div className="absolute inset-0 -z-10 bg-yellow-500/40 blur-[15px] rounded-full animate-pulse" />
                      )}
                      {isCompleted && !isCurrent && (
                        <div className="absolute inset-0 -z-10 bg-cyan-500/20 blur-[10px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}

                      {/* Tooltip for current level */}
                      {isCurrent && (
                        <div className="absolute -bottom-10 text-[10px] whitespace-nowrap bg-[#050a1f]/90 px-3 py-1 rounded border border-yellow-500/40 shadow-[0_0_10px_rgba(255,200,0,0.2)] backdrop-blur-sm animate-bounce" style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontWeight: 800, letterSpacing: '0.15em', color: '#ffcc00' }}>
                          DEPLOY HERE
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

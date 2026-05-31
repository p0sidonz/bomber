import { useState, useEffect } from 'react'
import { playBGM } from '../game/audio/audio'

const DEBUG = false // set to false to lock levels again

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
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2a] to-[#1a1a3a] z-0" />
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none select-none text-[80px] flex flex-wrap gap-12 p-8 z-0" style={{ filter: 'hue-rotate(200deg)' }}>
        {Array.from({ length: 30 }).map((_, i) => <span key={i}>⬡</span>)}
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 shrink-0 bg-black/40 p-4 rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm">
          <div>
            <h1 className="logo-text text-2xl sm:text-4xl mb-1 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 drop-shadow-[0_0_15px_rgba(0,180,255,0.8)]">
              SECTOR MAP
            </h1>
            <p className="text-[10px] tracking-widest font-bold" style={{ color: '#00d4ff' }}>
              SELECT YOUR DEPLOYMENT ZONE
            </p>
          </div>
          <button 
            className="btn-pixel bg-gray-800 text-white border-gray-600 hover:bg-gray-700 hover:scale-105 transition-transform" 
            onClick={() => nav('landing')}
          >
            ← BACK
          </button>
        </div>

        {/* Winding Path Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-4">
          <div className="flex flex-col gap-12 max-w-[450px] mx-auto relative pt-4">
            {chunks.map((row, rowIndex) => (
              <div 
                key={rowIndex} 
                className="flex justify-between relative z-10"
              >
                {/* Horizontal connecting line behind the nodes */}
                <div className="absolute top-1/2 left-6 right-6 h-3 bg-gray-800 border-y border-gray-900 -translate-y-1/2 z-[-1] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]" />
                
                {/* Vertical connecting track to the next row */}
                {rowIndex < 9 && (
                  <div className={`
                    absolute bottom-[-48px] w-3 h-[48px] bg-gray-800 border-x border-gray-900 z-[-1] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]
                    ${rowIndex % 2 === 0 ? 'right-[24px]' : 'left-[24px]'}
                  `} />
                )}

                {row.map((level) => {
                  const isUnlocked = level <= effectiveMaxLevel
                  const isCurrent = level === maxLevel // Keep the visual highlight on their *actual* current maxLevel
                  const isCompleted = level < maxLevel || (DEBUG && level > maxLevel)

                  return (
                    <div key={level} className="relative flex justify-center w-[60px]">
                      <button
                        onClick={() => handleSelect(level)}
                        disabled={!isUnlocked}
                        className={`
                          w-[50px] h-[50px] rounded-full border-[3px] flex items-center justify-center transition-all duration-300
                          ${isCurrent 
                            ? 'border-yellow-300 bg-gradient-to-br from-yellow-400 to-orange-600 text-black scale-125 shadow-[0_0_25px_rgba(255,200,0,1)] animate-bounce z-20 cursor-pointer ring-4 ring-orange-500/50' 
                            : isCompleted 
                              ? 'border-bm-green bg-gradient-to-br from-green-600 to-green-900 text-white shadow-[0_0_15px_rgba(0,255,0,0.5)] hover:scale-110 hover:shadow-[0_0_25px_rgba(0,255,0,0.8)] z-10 cursor-pointer ring-2 ring-green-400/30'
                              : 'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-900 text-gray-500 cursor-not-allowed opacity-80 shadow-inner'
                          }
                        `}
                      >
                        {isCurrent ? (
                          <span className="text-2xl drop-shadow-md" style={{ filter: 'drop-shadow(0 0 8px #00d4ff)' }}>◉</span>
                        ) : isCompleted ? (
                          <span style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 16, fontWeight: 900, color: '#f0c040' }}>{level}</span>
                        ) : (
                          <span className="text-sm opacity-50">🔒</span>
                        )}
                      </button>

                      {/* Tooltip for current level */}
                      {isCurrent && (
                        <div className="absolute -bottom-8 text-[11px] whitespace-nowrap bg-black/70 px-3 py-1 rounded-full border border-cyan-500/40" style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#00d4ff' }}>
                          SECTOR {level}
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

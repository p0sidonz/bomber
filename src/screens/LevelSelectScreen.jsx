import { useState, useEffect } from 'react'

const DEBUG = false // set to false to lock levels again

export default function LevelSelectScreen({ user, campaign, nav }) {
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
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none text-[80px] flex flex-wrap gap-12 p-8 z-0 animate-pulse mix-blend-overlay">
        {Array.from({ length: 30 }).map((_, i) => <span key={i}>💥</span>)}
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 shrink-0 bg-black/40 p-4 rounded-xl border border-gray-800 shadow-2xl backdrop-blur-sm">
          <div>
            <h1 className="logo-text text-2xl sm:text-4xl mb-1 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 drop-shadow-[0_0_15px_rgba(255,165,0,0.8)]">
              CAMPAIGN MAP
            </h1>
            <p className="text-[10px] text-bm-accent tracking-widest font-bold">
              YOUR JOURNEY AWAITS...
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
                          <span className="text-2xl drop-shadow-md">💣</span>
                        ) : isCompleted ? (
                          <span className="font-['Press_Start_2P'] text-[14px] text-yellow-200 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{level}</span>
                        ) : (
                          <span className="text-sm opacity-50">🔒</span>
                        )}
                      </button>

                      {/* Tooltip for current level */}
                      {isCurrent && (
                        <div className="absolute -bottom-8 font-['Press_Start_2P'] text-[10px] text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] whitespace-nowrap bg-black/60 px-3 py-1 rounded-full border border-yellow-500/30">
                          STAGE {level}
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

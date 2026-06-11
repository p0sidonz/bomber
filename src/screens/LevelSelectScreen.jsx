import { useState, useEffect } from 'react'
import { playBGM } from '../game/audio/audio'
import { PRODUCT_UNLOCK_ALL, PRODUCT_5_COINS, PRODUCT_20_COINS, PRODUCT_50_COINS, purchaseItem } from '../purchases.js'
import { saveCampaignProgress } from '../supabase.js'

const DEBUG = false // set to true to unlock all levels for testing

export default function LevelSelectScreen({ user, campaign, setCampaign, nav }) {
  const [showStore, setShowStore] = useState(false)
  const [showLoadout, setShowLoadout] = useState(null)
  const [buying, setBuying] = useState(false)
  
  const [selectedPowerup, setSelectedPowerup] = useState(null)
  const [buyLife, setBuyLife] = useState(false)

  useEffect(() => {
    playBGM('menu')
  }, [])

  const coins = campaign?.coins || 0
  const unlockedAll = campaign?.unlockedAll || false
  const maxLevel = Math.min(50, Math.max(1, campaign?.maxLevel || 1))
  const effectiveMaxLevel = DEBUG || unlockedAll ? 50 : maxLevel

  function handleSelect(level) {
    if (level <= effectiveMaxLevel) {
      setShowLoadout(level)
      setSelectedPowerup(null)
      setBuyLife(false)
    }
  }

  async function startLevel() {
    let cost = 0
    if (buyLife) cost += 5
    if (selectedPowerup) cost += 5

    if (coins < cost) {
      alert("Not enough coins! Please purchase more.")
      return
    }

    if (cost > 0) {
      const newCampaign = { ...campaign, coins: coins - cost }
      await saveCampaignProgress(newCampaign)
      if (setCampaign) setCampaign(newCampaign) // Update local state
    }

    nav('classic', { 
      level: showLoadout,
      loadout: {
        extraLife: buyLife,
        powerup: selectedPowerup
      }
    })
  }

  async function handleBuy(productId, coinAmount, isUnlockAll = false) {
    if (buying) return
    setBuying(true)
    try {
      const success = await purchaseItem(productId)
      if (success) {
        if (isUnlockAll) {
          const newCampaign = { ...campaign, unlockedAll: true }
          await saveCampaignProgress(newCampaign)
          if (setCampaign) setCampaign(newCampaign)
          alert("All Sectors Unlocked!")
        } else {
          const newCampaign = { ...campaign, coins: coins + coinAmount }
          await saveCampaignProgress(newCampaign)
          if (setCampaign) setCampaign(newCampaign)
          alert(`Purchased ${coinAmount} Coins!`)
        }
        setShowStore(false)
      }
    } catch (e) {
      alert("Purchase failed: " + e.message)
    } finally {
      setBuying(false)
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
          
          <button 
            className="btn-pixel bg-[#0a122a] text-cyan-300 border border-cyan-800 hover:bg-cyan-900/40 hover:border-cyan-400 hover:scale-105 transition-all shadow-[0_0_15px_rgba(0,212,255,0.15)] px-4 py-2" 
            onClick={() => nav('landing')}
          >
            ← ABORT
          </button>

          {/* Coin Balance */}
          <div 
            className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-xl border border-yellow-500/30 cursor-pointer hover:bg-yellow-500/10 transition-colors"
            onClick={() => setShowStore(true)}
          >
            <span className="text-xl">💰</span>
            <span style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontWeight: 800, fontSize: 16, color: '#ffcc00' }}>
              {coins}
            </span>
            <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-400 text-lg leading-none font-bold pb-0.5">
              +
            </div>
          </div>
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
                          You
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

      {/* ═══════════════════════════════════════════════════════
          Coin Store Modal
          ═══════════════════════════════════════════════════════ */}
      {showStore && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
          onClick={() => !buying && setShowStore(false)}
        >
          <div 
            style={{
              width: '100%', maxWidth: 360,
              background: 'linear-gradient(180deg, rgba(12,12,32,0.95) 0%, rgba(6,6,18,0.95) 100%)',
              border: '1.5px solid rgba(255,200,0,0.3)', borderRadius: 20, padding: '24px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255,200,0,0.1) inset',
              display: 'flex', flexDirection: 'column', gap: 20,
              animation: 'fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: '#ffcc00', letterSpacing: '0.1em' }}>
                OMEGA STORE
              </h2>
              <button disabled={buying} onClick={() => setShowStore(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button 
                disabled={buying} onClick={() => handleBuy(PRODUCT_5_COINS, 5)}
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3"><span className="text-2xl">🪙</span><span className="font-bold text-white">5 Coins</span></div>
                <div className="text-yellow-400 font-bold">$1.00</div>
              </button>
              <button 
                disabled={buying} onClick={() => handleBuy(PRODUCT_20_COINS, 20)}
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3"><span className="text-2xl">💰</span><span className="font-bold text-white">20 Coins</span></div>
                <div className="text-yellow-400 font-bold">$3.00</div>
              </button>
              <button 
                disabled={buying} onClick={() => handleBuy(PRODUCT_50_COINS, 50)}
                className="flex items-center justify-between p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500 hover:bg-yellow-500/20 transition-all disabled:opacity-50 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">BEST VALUE</div>
                <div className="flex items-center gap-3"><span className="text-2xl">💎</span><span className="font-bold text-white">50 Coins</span></div>
                <div className="text-yellow-400 font-bold">$7.00</div>
              </button>
              {!unlockedAll && (
                <button 
                  disabled={buying} onClick={() => handleBuy(PRODUCT_UNLOCK_ALL, 0, true)}
                  className="flex items-center justify-between p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500 hover:bg-cyan-500/20 transition-all mt-2 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3"><span className="text-2xl">🔓</span><span className="font-bold text-cyan-100">Unlock All Sectors</span></div>
                  <div className="text-cyan-400 font-bold">$30.00</div>
                </button>
              )}
            </div>
            {buying && <div className="text-center text-xs text-yellow-500 animate-pulse">Processing Transaction...</div>}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Pre-Game Loadout Modal
          ═══════════════════════════════════════════════════════ */}
      {showLoadout && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
          onClick={() => setShowLoadout(null)}
        >
          <div 
            style={{
              width: '100%', maxWidth: 360,
              background: 'linear-gradient(180deg, rgba(12,12,32,0.95) 0%, rgba(6,6,18,0.95) 100%)',
              border: '1.5px solid rgba(0,212,255,0.2)', borderRadius: 20, padding: '24px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.1) inset',
              display: 'flex', flexDirection: 'column', gap: 20,
              animation: 'fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.5)', fontFamily: 'Rajdhani,Outfit,sans-serif' }}>MISSION PREP</div>
                <h2 style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>
                  SECTOR {showLoadout}
                </h2>
              </div>
              <button onClick={() => setShowLoadout(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Extra Life */}
              <div 
                onClick={() => setBuyLife(!buyLife)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${buyLife ? 'border-green-400 bg-green-500/10' : 'border-white/10 hover:border-white/30'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl text-green-400">❤️</span>
                  <div>
                    <div className="font-bold text-white text-sm">Extra Life</div>
                    <div className="text-xs text-white/50">Start with +1 Health</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                  🪙 5
                </div>
              </div>

              {/* Guaranteed Powerup */}
              <div className="flex flex-col gap-2">
                <div className="text-xs font-bold text-white/50 tracking-wider">FIRST DROP ASSURANCE (5 COINS)</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'fireup', icon: '🔥', name: 'FIRE' },
                    { id: 'extrabomb', icon: '💣', name: 'BOMB' },
                    { id: 'speedup', icon: '⚡', name: 'SPEED' },
                  ].map(pw => (
                    <div
                      key={pw.id}
                      onClick={() => setSelectedPowerup(selectedPowerup === pw.id ? null : pw.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border cursor-pointer transition-all ${selectedPowerup === pw.id ? 'border-cyan-400 bg-cyan-500/20' : 'border-white/10 hover:border-white/30'}`}
                    >
                      <span className="text-xl mb-1">{pw.icon}</span>
                      <span className="text-[10px] font-bold text-white">{pw.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-white/60">Total Cost:</span>
                <span className={`font-bold ${coins >= (buyLife ? 5 : 0) + (selectedPowerup ? 5 : 0) ? 'text-yellow-400' : 'text-red-400'}`}>
                  🪙 {(buyLife ? 5 : 0) + (selectedPowerup ? 5 : 0)}
                </span>
              </div>
              <button
                onClick={startLevel}
                style={{
                  fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 16, fontWeight: 800,
                  letterSpacing: '0.1em', color: '#00d4ff',
                  background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
                  padding: '14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: 'inset 0 0 20px rgba(0,212,255,0.1)'
                }}
                className="hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]"
              >
                START MISSION
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

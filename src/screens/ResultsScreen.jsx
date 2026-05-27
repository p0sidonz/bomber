import { useEffect, useState } from 'react'
import { upsertLeaderboard, getLeaderboard, getHighScores, getPersonalStats } from '../supabase.js'

const COLORS = {
  red: '#e03040', blue: '#3060e0', green: '#30c060',
  yellow: '#f0c040', purple: '#9040c0', orange: '#e08030',
}

export default function ResultsScreen({ user, room, result, nav }) {
  const [saved, setSaved] = useState(false)
  const myUserId = user?.id
  const winner = result?.players?.find(p => p.userId === result.winner)
  const players = (result?.players || []).sort((a, b) => (b.kills || 0) - (a.kills || 0))
  const matchType = result?.matchType || 'last_standing'

  useEffect(() => {
    if (result && !saved) {
      saveStats()
      setSaved(true)
    }
  }, [result])

  async function saveStats() {
    const me = players.find(p => p.userId === myUserId)
    if (!me) return
    const isWinner = result.winner === myUserId
    try {
      const existing = await getLeaderboard()
      const myStats = existing?.find(e => e.user_id === myUserId)
      await upsertLeaderboard(
        myUserId,
        user?.user_metadata?.display_name || 'PLAYER',
        (myStats?.wins || 0) + (isWinner ? 1 : 0),
        (myStats?.kills || 0) + (me.kills || 0),
        (myStats?.games_played || 0) + 1,
      )
    } catch (_) {}
  }

  return (
    <div className="full-screen overflow-auto py-8">
      <div className="w-full max-w-xl mx-auto px-4 space-y-6">
        {/* Winner */}
        <div className="text-center panel">
          <div className="text-5xl mb-3">🏆</div>
          {winner ? (
            <>
              <div
                className="text-2xl font-pixel mb-2 winner-glow"
                style={{ color: COLORS[winner.color] || '#f0c040' }}
              >
                {winner.name}
              </div>
              <p className="text-[8px] text-bm-yellow">WINNER!</p>
            </>
          ) : (
            <p className="text-[8px] text-gray-400">DRAW!</p>
          )}
          <p className="text-[7px] text-gray-600 mt-2">
            {matchType === 'last_standing' ? 'LAST STANDING' :
             matchType === 'most_kills' ? 'MOST KILLS' :
             matchType === 'territory' ? 'TERRITORY' : 'GATE RUSH'}
          </p>
        </div>

        {/* Player stats */}
        <div className="panel">
          <h2 className="text-[8px] text-bm-accent mb-4">KILL FEED RECAP</h2>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div
                key={p.userId}
                className={`player-slot ${p.userId === result.winner ? 'ready' : ''}`}
              >
                <span className="text-[8px] text-gray-500 w-4">{i + 1}</span>
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: COLORS[p.color] || '#fff' }}
                />
                <span className="text-[8px] flex-1">{p.name}</span>
                <span className="text-[8px] text-bm-accent">💀 {p.kills || 0}</span>
                {!p.alive && <span className="text-[7px] text-bm-red ml-2">ELIMINATED</span>}
                {p.userId === result.winner && <span className="text-[7px] text-bm-green ml-2">WINNER</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="btn-pixel btn-primary flex-1"
            onClick={() => nav('lobby', { room })}
          >
            PLAY AGAIN
          </button>
          <button
            className="btn-pixel flex-1"
            onClick={() => nav('landing')}
          >
            MAIN MENU
          </button>
        </div>

        <p className="text-center text-[7px] text-gray-700">Stats saved to leaderboard.</p>
      </div>
    </div>
  )
}

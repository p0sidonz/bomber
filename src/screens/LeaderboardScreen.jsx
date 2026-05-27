import { useEffect, useState } from 'react'
import { getLeaderboard, getHighScores, getPersonalStats } from '../supabase.js'

export default function LeaderboardScreen({ user, nav }) {
  const [tab, setTab] = useState('multiplayer') // multiplayer | classic
  const [mpData, setMpData] = useState([])
  const [classicData, setClassicData] = useState([])
  const [myStats, setMyStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [mp, classic, personal] = await Promise.all([
          getLeaderboard(),
          getHighScores(),
          getPersonalStats(user.id),
        ])
        setMpData(mp || [])
        setClassicData(classic || [])
        setMyStats(personal)
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="full-screen overflow-auto py-8">
      <div className="w-full max-w-xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button className="btn-pixel text-[8px]" onClick={() => nav('landing')}>← BACK</button>
          <h1 className="text-pixel text-bm-accent text-sm">🏆 LEADERBOARD</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-2 border-bm-border">
          <button
            className={`flex-1 py-3 text-[8px] transition-colors ${tab === 'multiplayer' ? 'bg-bm-accent text-black' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTab('multiplayer')}
          >
            MULTIPLAYER
          </button>
          <button
            className={`flex-1 py-3 text-[8px] transition-colors ${tab === 'classic' ? 'bg-bm-accent text-black' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setTab('classic')}
          >
            CLASSIC MODE
          </button>
        </div>

        {loading ? (
          <div className="text-center text-[8px] text-gray-500 py-8 animate-pixel-blink">LOADING...</div>
        ) : tab === 'multiplayer' ? (
          <MultiplayerBoard data={mpData} myUserId={user.id} />
        ) : (
          <ClassicBoard data={classicData} myUserId={user.id} />
        )}

        {/* Personal stats */}
        {myStats && (
          <div className="panel">
            <h2 className="text-[8px] text-bm-accent mb-4">YOUR STATS</h2>
            <div className="grid grid-cols-4 gap-3 text-center">
              <Stat label="WINS" value={myStats.wins || 0} />
              <Stat label="KILLS" value={myStats.kills || 0} />
              <Stat label="GAMES" value={myStats.games_played || 0} />
              <Stat label="BEST" value={myStats.best_single_player_score || 0} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MultiplayerBoard({ data, myUserId }) {
  return (
    <div className="panel">
      <div className="grid grid-cols-4 text-[7px] text-gray-500 mb-2 px-2">
        <span>#</span><span>NAME</span><span className="text-right">WINS</span><span className="text-right">KILLS</span>
      </div>
      {data.length === 0 && (
        <p className="text-[8px] text-gray-600 text-center py-4">No entries yet. Be the first!</p>
      )}
      {data.map((row, i) => (
        <div
          key={row.user_id}
          className={`grid grid-cols-4 py-2 px-2 border-b border-bm-border/30 text-[8px] ${row.user_id === myUserId ? 'bg-bm-accent/10' : ''}`}
        >
          <span className="text-gray-500">{i + 1}</span>
          <span className={row.user_id === myUserId ? 'text-bm-accent' : ''}>
            {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}
            {row.display_name?.substring(0, 10)}
          </span>
          <span className="text-right text-bm-yellow">{row.wins || 0}</span>
          <span className="text-right text-bm-red">{row.kills || 0}</span>
        </div>
      ))}
    </div>
  )
}

function ClassicBoard({ data, myUserId }) {
  return (
    <div className="panel">
      <div className="grid grid-cols-4 text-[7px] text-gray-500 mb-2 px-2">
        <span>#</span><span>NAME</span><span className="text-right">SCORE</span><span className="text-right">LVL</span>
      </div>
      {data.length === 0 && (
        <p className="text-[8px] text-gray-600 text-center py-4">No high scores yet. Play Classic Mode!</p>
      )}
      {data.map((row, i) => (
        <div
          key={row.id}
          className={`grid grid-cols-4 py-2 px-2 border-b border-bm-border/30 text-[8px] ${row.user_id === myUserId ? 'bg-bm-accent/10' : ''}`}
        >
          <span className="text-gray-500">{i + 1}</span>
          <span className={row.user_id === myUserId ? 'text-bm-accent' : ''}>
            {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}
            {row.display_name?.substring(0, 10)}
          </span>
          <span className="text-right text-bm-yellow">{String(row.score || 0).padStart(6, '0')}</span>
          <span className="text-right text-bm-green">{row.level_reached || 1}</span>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[8px] text-bm-accent">{value}</div>
      <div className="text-[6px] text-gray-500 mt-1">{label}</div>
    </div>
  )
}

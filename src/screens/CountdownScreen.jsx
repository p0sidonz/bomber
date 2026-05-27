import { useState, useEffect } from 'react'
import { supabase, getRoomPlayers } from '../supabase'

export default function CountdownScreen({ room, nav }) {
  const [count, setCount] = useState(3)
  const [go, setGo] = useState(false)
  const [players, setPlayers] = useState([])

  useEffect(() => {
    getRoomPlayers(room.id).then(p => setPlayers(p || []))
  }, [])

  useEffect(() => {
    const timers = []
    timers.push(setTimeout(() => setCount(2), 1000))
    timers.push(setTimeout(() => setCount(1), 2000))
    timers.push(setTimeout(() => { setCount(0); setGo(true) }, 3000))
    timers.push(setTimeout(() => nav('game', { room }), 4000))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="countdown-overlay flex-col gap-6">
      {/* Player preview */}
      <div className="flex gap-4 mb-4">
        {players.map(p => (
          <div key={p.id} className="text-center">
            <div className="text-2xl mb-1">💣</div>
            <div className="text-[7px] text-gray-400">{p.display_name}</div>
          </div>
        ))}
      </div>

      {go ? (
        <div key="go" className="countdown-go">GO!</div>
      ) : (
        <div key={count} className="countdown-num animate-countdown">
          {count}
        </div>
      )}

      <p className="text-[8px] text-gray-500 mt-4">GET READY!</p>
    </div>
  )
}

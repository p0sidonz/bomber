import { useState, useEffect } from 'react'
import { supabase, onAuthChange } from './supabase'
import AuthScreen from './screens/AuthScreen'
import LandingScreen from './screens/LandingScreen'
import LobbyScreen from './screens/LobbyScreen'
import CountdownScreen from './screens/CountdownScreen'
import GameScreen from './screens/GameScreen'
import ResultsScreen from './screens/ResultsScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import ClassicGameScreen from './screens/ClassicGameScreen'
import ResetPasswordScreen from './screens/ResetPasswordScreen'
import LevelSelectScreen from './screens/LevelSelectScreen'

// SCREENS: auth | landing | level_select | classic | create | join | lobby | countdown | game | results | leaderboard | reset_password
export default function App() {
  const [screen, setScreen] = useState('auth')
  const [user, setUser] = useState(null)
  const [room, setRoom] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [level, setLevel] = useState(1)

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        setScreen('landing')
      }
    })

    const { data: { subscription } } = onAuthChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setScreen('reset_password')
        return
      }

      if (session) {
        setUser(session.user)
        if (screen === 'auth') setScreen('landing')
      } else {
        setUser(null)
        setScreen('auth')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const nav = (s, extra = {}) => {
    if (extra.room) setRoom(extra.room)
    if (extra.result) setGameResult(extra.result)
    if (extra.level) setLevel(extra.level)
    setScreen(s)
  }

  if (screen === 'auth') return <AuthScreen onAuth={(u) => { setUser(u); setScreen('landing') }} />
  if (screen === 'reset_password') return <ResetPasswordScreen nav={nav} />
  if (screen === 'landing') return <LandingScreen user={user} nav={nav} />
  if (screen === 'level_select') return <LevelSelectScreen user={user} nav={nav} />
  if (screen === 'classic') return <ClassicGameScreen user={user} startingLevel={level} nav={nav} />
  if (screen === 'lobby') return <LobbyScreen user={user} room={room} nav={nav} />
  if (screen === 'countdown') return <CountdownScreen room={room} nav={nav} />
  if (screen === 'game') return <GameScreen user={user} room={room} nav={nav} />
  if (screen === 'results') return <ResultsScreen user={user} room={room} result={gameResult} nav={nav} />
  if (screen === 'leaderboard') return <LeaderboardScreen user={user} nav={nav} />

  return null
}

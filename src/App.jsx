import { useState, useEffect } from 'react'
import { supabase, onAuthChange, getCampaignProgress } from './supabase'
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
import PrivacyScreen from './screens/PrivacyScreen'
import TosScreen from './screens/TosScreen'
import ContactScreen from './screens/ContactScreen'
import DeleteAccountScreen from './screens/DeleteAccountScreen'
import { initializeAdMob } from './admob'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'

// SCREENS: auth | landing | level_select | classic | create | join | lobby | countdown | game | results | leaderboard | reset_password | privacy | tos | contact | delete_account
export default function App() {
  const [screen, setScreen] = useState('auth')
  const [user, setUser] = useState(null)
  const [room, setRoom] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [level, setLevel] = useState(1)
  const [campaign, setCampaign] = useState({})

  useEffect(() => {
    if (user) {
      getCampaignProgress(user.id).then(setCampaign).catch(console.error)
    } else {
      setCampaign({})
    }
  }, [user])

  useEffect(() => {
    initializeAdMob()
    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.lock({ orientation: 'portrait-primary' }).catch(e => console.error(e))
    }
  }, [])

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash
      if (h === '#privacy') setScreen('privacy')
      else if (h === '#tos') setScreen('tos')
      else if (h === '#contact') setScreen('contact')
      else if (h === '#delete-account') setScreen('delete_account')
    }
    
    // Check initial hash
    if (window.location.hash) handleHash()
    window.addEventListener('hashchange', handleHash)

    // Restore session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        setScreen(curr => (!['privacy', 'tos', 'contact', 'delete_account'].includes(curr) && !window.location.hash) ? 'landing' : curr)
      }
    })

    const { data: { subscription } } = onAuthChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setScreen('reset_password')
        return
      }

      if (session) {
        setUser(session.user)
        setScreen(curr => (curr === 'auth' && !window.location.hash) ? 'landing' : curr)
      } else {
        setUser(null)
        setScreen(curr => !['privacy', 'tos', 'contact', 'delete_account'].includes(curr) ? 'auth' : curr)
      }
    })
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('hashchange', handleHash)
    }
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
  if (screen === 'level_select') return <LevelSelectScreen user={user} campaign={campaign} nav={nav} />
  if (screen === 'classic') return <ClassicGameScreen user={user} campaign={campaign} setCampaign={setCampaign} startingLevel={level} nav={nav} />
  if (screen === 'lobby') return <LobbyScreen user={user} room={room} nav={nav} />
  if (screen === 'countdown') return <CountdownScreen room={room} nav={nav} />
  if (screen === 'game') return <GameScreen user={user} room={room} nav={nav} />
  if (screen === 'results') return <ResultsScreen user={user} room={room} result={gameResult} nav={nav} />
  if (screen === 'leaderboard') return <LeaderboardScreen user={user} nav={nav} />
  if (screen === 'privacy') return <PrivacyScreen nav={nav} />
  if (screen === 'tos') return <TosScreen nav={nav} />
  if (screen === 'contact') return <ContactScreen nav={nav} />
  if (screen === 'delete_account') return <DeleteAccountScreen user={user} nav={nav} />

  return null
}

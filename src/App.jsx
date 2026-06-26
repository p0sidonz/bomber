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
import { initPurchases } from './purchases'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { StatusBar } from '@capacitor/status-bar'
import { toggleMute, getIsMuted, suspendAudio, resumeAudio } from './game/audio/audio'

// SCREENS: auth | landing | level_select | classic | create | join | lobby | countdown | game | results | leaderboard | reset_password | privacy | tos | contact | delete_account
export default function App() {
  const [screen, setScreen] = useState('auth')
  const [user, setUser] = useState(null)
  const [room, setRoom] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [level, setLevel] = useState(1)
  const [loadout, setLoadout] = useState(null)
  const [campaign, setCampaign] = useState({})
  const [muted, setMuted] = useState(getIsMuted())

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    if (user) {
      getCampaignProgress(user.id).then(setCampaign).catch(console.error)
    } else {
      setCampaign({})
    }
  }, [user])

  useEffect(() => {
    initPurchases().then(() => initializeAdMob())
    if (Capacitor.isNativePlatform()) {
      ScreenOrientation.lock({ orientation: 'portrait-primary' }).catch(e => console.error(e))
      StatusBar.hide().catch(e => console.error('Failed to hide status bar', e))
      
      const stateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          suspendAudio()
        } else {
          resumeAudio()
          // Re-hide status bar — Android/iOS can show it again after app resume
          StatusBar.hide().catch(() => {})
        }
      })
      
      const backListener = CapacitorApp.addListener('backButton', () => {
        setScreen(curr => {
          if (curr === 'classic' || curr === 'game') {
            // Let the game screen handle it (show pause menu)
            window.dispatchEvent(new CustomEvent('hw_back_pressed'))
            return curr
          }
          if (curr === 'landing' || curr === 'auth') {
            CapacitorApp.exitApp()
            return curr
          }
          // Always clear the hash when navigating away from legal/deep pages
          // so a stale #privacy hash can't re-trigger the legal screen on auth refresh
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          return 'landing'
        })
      })

      return () => {
        stateListener.then(l => l.remove())
        backListener.then(l => l.remove())
      }
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
      setIsCheckingAuth(false)
    }).catch((e) => {
      console.error(e)
      setIsCheckingAuth(false)
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
    if (extra.loadout !== undefined) setLoadout(extra.loadout)
    else setLoadout(null) // clear loadout if not explicitly passed
    
    // Clear any URL hash (e.g. #privacy, #tos) so it doesn't re-trigger
    // a legal screen on the next Supabase auth event refresh
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    setScreen(s)
  }

  const renderScreen = () => {
    if (isCheckingAuth) {
      return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#060610] gap-6">
          <img src="/splash.png" alt="Omega Arena" className="w-64 max-w-[80vw] object-contain drop-shadow-[0_0_20px_rgba(0,212,255,0.3)] animate-pulse" />
          <div className="text-bm-accent text-xl font-bold tracking-[0.2em]" style={{ fontFamily: 'Rajdhani,sans-serif' }}>
            LOADING...
          </div>
        </div>
      )
    }

    if (screen === 'auth') return <AuthScreen onAuth={(u) => { setUser(u); setScreen('landing') }} />
    if (screen === 'reset_password') return <ResetPasswordScreen nav={nav} />
    if (screen === 'landing') return <LandingScreen user={user} campaign={campaign} setCampaign={setCampaign} nav={nav} />
    if (screen === 'level_select') return <LevelSelectScreen user={user} campaign={campaign} setCampaign={setCampaign} nav={nav} />
    if (screen === 'classic') return <ClassicGameScreen user={user} campaign={campaign} setCampaign={setCampaign} startingLevel={level} loadout={loadout} nav={nav} />
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

  return (
    <>
      {renderScreen()}
      {screen !== 'classic' && screen !== 'game' && (
        <button
          onClick={() => setMuted(toggleMute())}
          className="fixed bottom-4 left-4 z-[999] w-10 h-10 bg-black/60 border border-bm-border rounded-full flex items-center justify-center text-lg hover:bg-black/80 hover:scale-110 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </>
  )
}

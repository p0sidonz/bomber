import { useState } from 'react'
import { signIn, signUp, resetPasswordForEmail, signInWithGoogle } from '../supabase'
import PlasmaAnimation from '../components/PlasmaAnimation'
import { Capacitor } from '@capacitor/core'

const COLORS = ['cyan', 'purple', 'green', 'red', 'yellow', 'orange']
const COLOR_HEX = {
  cyan: '#00d4ff', purple: '#cc44ff', green: '#00e87a',
  red: '#ff2244', yellow: '#ffcc00', orange: '#ff7720',
}

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState('cyan')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await signIn(email, password)
        onAuth(data.user)
      } else if (mode === 'forgot') {
        await resetPasswordForEmail(email)
        setSuccessMsg('RESET LINK SENT')
      } else {
        if (!displayName.trim()) throw new Error('Display name required')
        if (displayName.length > 12) throw new Error('Name max 12 chars')
        await signUp(email, password, displayName.trim(), color)
        setSuccessMsg('CHECK YOUR EMAIL')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (successMsg) {
    return (
      <div className="full-screen">
        <div className="panel max-w-md w-full mx-4 text-center space-y-6">
          <div className="text-4xl">📧</div>
          <h1 className="text-pixel text-bm-green text-xs leading-loose">
            {successMsg}
          </h1>
          <p className="text-[8px] text-gray-400 leading-loose">
            We sent an email to<br />
            <span className="text-bm-accent">{email}</span><br />
            Click the link inside to continue.
          </p>
          <button className="btn-pixel w-full" onClick={() => { setSuccessMsg(''); setMode('login') }}>
            BACK TO LOGIN
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full relative overflow-y-auto flex flex-col items-center justify-center py-8"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a0a2e 0%, #060610 60%, #030308 100%)' }}
    >
      {/* Animated space grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(0,212,255,0.04) 0, rgba(0,212,255,0.04) 1px, transparent 1px, transparent 48px),
          repeating-linear-gradient(90deg, rgba(0,212,255,0.04) 0, rgba(0,212,255,0.04) 1px, transparent 1px, transparent 48px)
        `,
        backgroundSize: '48px 48px',
      }} />
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(100,0,255,0.15) 0%, transparent 70%)',
      }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <PlasmaAnimation />
          <h1 style={{
            fontFamily: 'Rajdhani,Outfit,sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(36px, 8vw, 56px)',
            letterSpacing: '0.12em',
            background: 'linear-gradient(135deg, #00d4ff 0%, #7744ff 40%, #ff44ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 30px rgba(100,0,255,0.5))',
            margin: 0,
            lineHeight: 1,
          }}>
            Omega Arena
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(0,212,255,0.4))' }} />
            <span style={{ fontFamily: 'Rajdhani,Outfit,sans-serif', fontSize: 10, letterSpacing: '0.3em', color: 'rgba(0,212,255,0.5)' }}>
              DOMINATE THE GRID
            </span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(0,212,255,0.4))' }} />
          </div>
        </div>

        {/* Tab toggle */}
        {mode !== 'forgot' && (
          <div className="flex mb-4 p-1 bg-black/40 backdrop-blur-md rounded-xl border border-bm-border">
            <button
              style={{ fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.1em' }}
              className={`flex-1 py-3 text-[13px] font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-bm-accent text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
              onClick={() => { setMode('login'); setError('') }}
            >LOGIN</button>
            <button
              style={{ fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.1em' }}
              className={`flex-1 py-3 text-[13px] font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-bm-accent text-black shadow-[0_0_15px_rgba(0,212,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
              onClick={() => { setMode('signup'); setError('') }}
            >SIGN UP</button>
          </div>
        )}

        <div className={`panel ${mode !== 'forgot' ? 'border-t-0' : ''}`}>
          {mode === 'forgot' && (
            <h2 className="text-[10px] text-bm-accent mb-4 text-center">RESET PASSWORD</h2>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[8px] text-gray-400 mb-2">EMAIL</label>
              <input
                className="input-pixel"
                type="email"
                name="username"
                placeholder="player@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username email"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-[8px] text-gray-400 mb-2">PASSWORD</label>
                <input
                  className="input-pixel"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            )}

            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-[8px] text-gray-400 mb-2">DISPLAY NAME <span className="text-gray-600">(MAX 12)</span></label>
                  <input
                    className="input-pixel"
                    type="text"
                    placeholder="BlastKing"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    maxLength={12}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[8px] text-gray-400 mb-3">PICK YOUR COLOR</label>
                  <div className="flex gap-3">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`color-dot ${color === c ? 'selected' : ''}`}
                        style={{ background: COLOR_HEX[c], color: COLOR_HEX[c] }}
                        onClick={() => setColor(c)}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="text-[11px] font-bold text-bm-red bg-bm-red/10 border border-bm-red/30 p-3 rounded-lg text-center" style={{ fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.05em' }}>
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-pixel btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? 'LOADING...' : mode === 'login' ? 'LOGIN →' : mode === 'forgot' ? 'SEND RESET LINK →' : 'CREATE ACCOUNT →'}
            </button>
            
            {mode === 'login' && (
              <div className="text-center mt-6 pt-4 flex flex-col items-center gap-4 border-t border-bm-border/50">
                {Capacitor.isNativePlatform() && (
                  <>
                    <button 
                      type="button"
                      disabled={loading}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        background: '#fff',
                        border: '1px solid #dadce0',
                        borderRadius: 8,
                        cursor: loading ? 'wait' : 'pointer',
                        fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
                        fontSize: 15,
                        fontWeight: 500,
                        color: '#3c4043',
                        letterSpacing: '0.01em',
                        transition: 'box-shadow 0.2s, background 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        opacity: loading ? 0.7 : 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; e.currentTarget.style.background = '#f8f9fa' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; e.currentTarget.style.background = '#fff' }}
                      onClick={async () => {
                        setError('')
                        setLoading(true)
                        try {
                          const data = await signInWithGoogle()
                          onAuth(data.user)
                        } catch (err) {
                          setError('Google Sign-In failed: ' + (err.message || 'Unknown error'))
                        } finally {
                          setLoading(false)
                        }
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      {loading ? 'Signing in...' : 'Sign in with Google'}
                    </button>
                    <div className="w-full flex items-center justify-center gap-3">
                      <div className="h-px flex-1 bg-bm-border" />
                      <span className="text-[10px] text-gray-500 font-['Rajdhani']">OR</span>
                      <div className="h-px flex-1 bg-bm-border" />
                    </div>
                  </>
                )}
                <button 
                  type="button" 
                  className="btn-pixel w-full"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                  onClick={() => onAuth({ id: 'guest', isGuest: true, user_metadata: { display_name: 'Guest', color: 'cyan' } })}
                >
                  PLAY AS GUEST →
                </button>
                <button 
                  type="button" 
                  style={{ fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.05em' }}
                  className="text-[12px] text-gray-500 hover:text-bm-accent transition-colors mt-2"
                  onClick={() => { setMode('forgot'); setError('') }}
                >
                  FORGOT PASSWORD?
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <div className="text-center mt-6 pt-4 border-t border-bm-border/50">
                <button 
                  type="button" 
                  style={{ fontFamily: 'Rajdhani,sans-serif', letterSpacing: '0.05em' }}
                  className="text-[12px] text-gray-500 hover:text-bm-accent transition-colors"
                  onClick={() => { setMode('login'); setError('') }}
                >
                  ← BACK TO LOGIN
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Legal Footer */}
        <div className="relative z-20 w-full flex flex-wrap justify-center items-center gap-x-4 gap-y-2 px-4 text-[8px] sm:text-[10px] text-gray-500 font-['Inter',sans-serif] mt-12 pb-4">
          <a href="#privacy" className="hover:text-bm-accent transition-colors">Privacy Policy</a>
          <span className="hidden sm:inline">|</span>
          <a href="#tos" className="hover:text-bm-accent transition-colors">Terms of Service</a>
          <span className="hidden sm:inline">|</span>
          <a href="#contact" className="hover:text-bm-accent transition-colors">Contact</a>
          <span className="hidden sm:inline">|</span>
          <a href="#delete-account" className="hover:text-bm-red transition-colors">Delete Account</a>
        </div>

      </div>
    </div>
  )
}

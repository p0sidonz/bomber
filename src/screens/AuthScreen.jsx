import { useState } from 'react'
import { signIn, signUp } from '../supabase'

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']
const COLOR_HEX = {
  red: '#e03040', blue: '#3060e0', green: '#30c060',
  yellow: '#f0c040', purple: '#9040c0', orange: '#e08030',
}

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState('red')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await signIn(email, password)
        onAuth(data.user)
      } else {
        if (!displayName.trim()) throw new Error('Display name required')
        if (displayName.length > 12) throw new Error('Name max 12 chars')
        await signUp(email, password, displayName.trim(), color)
        setSignupDone(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (signupDone) {
    return (
      <div className="full-screen">
        <div className="panel max-w-md w-full mx-4 text-center space-y-6">
          <div className="text-4xl">📧</div>
          <h1 className="text-pixel text-bm-green text-xs leading-loose">
            CHECK YOUR EMAIL
          </h1>
          <p className="text-[8px] text-gray-400 leading-loose">
            We sent a confirmation link to<br />
            <span className="text-bm-accent">{email}</span><br />
            Click it to activate your account.
          </p>
          <button className="btn-pixel w-full" onClick={() => { setSignupDone(false); setMode('login') }}>
            BACK TO LOGIN
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="full-screen bg-bm-dark relative overflow-hidden">
      {/* Background bombs */}
      <div className="absolute inset-0 opacity-5 pointer-events-none select-none text-[120px] flex flex-wrap gap-8 p-8">
        {Array.from({ length: 20 }).map((_, i) => <span key={i}>💣</span>)}
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="logo-text mb-2">BombRush Arena</h1>
          <p className="text-[8px] text-gray-500 tracking-widest mt-3">BLAST YOUR WAY TO GLORY</p>
        </div>

        {/* Tab toggle */}
        <div className="flex mb-0 border-2 border-bm-border">
          <button
            className={`flex-1 py-3 text-[9px] transition-colors ${mode === 'login' ? 'bg-bm-accent text-black' : 'text-gray-400 hover:text-white'}`}
            onClick={() => { setMode('login'); setError('') }}
          >LOGIN</button>
          <button
            className={`flex-1 py-3 text-[9px] transition-colors ${mode === 'signup' ? 'bg-bm-accent text-black' : 'text-gray-400 hover:text-white'}`}
            onClick={() => { setMode('signup'); setError('') }}
          >SIGN UP</button>
        </div>

        <div className="panel border-t-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[8px] text-gray-400 mb-2">EMAIL</label>
              <input
                className="input-pixel"
                type="email"
                placeholder="player@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[8px] text-gray-400 mb-2">PASSWORD</label>
              <input
                className="input-pixel"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

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
              <div className="text-[8px] text-bm-red leading-loose border border-bm-red p-2">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-pixel btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? 'LOADING...' : mode === 'login' ? 'LOGIN →' : 'CREATE ACCOUNT →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { updatePassword } from '../supabase'
import PlasmaAnimation from '../components/PlasmaAnimation'

export default function ResetPasswordScreen({ nav }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (password.length < 6) throw new Error('Password must be at least 6 characters')
      await updatePassword(password)
      setSuccess(true)
      setTimeout(() => nav('landing'), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
              RESET PASSWORD
            </span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(0,212,255,0.4))' }} />
          </div>
        </div>

        {success ? (
          <div className="panel text-center space-y-6">
            <div className="text-4xl">✅</div>
            <h1 className="text-pixel text-bm-green text-xs leading-loose">
              PASSWORD UPDATED
            </h1>
            <p className="text-[8px] text-gray-400 leading-loose">
              Redirecting to lobby...
            </p>
          </div>
        ) : (
          <div className="panel">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[8px] text-gray-400 mb-2">NEW PASSWORD</label>
                <input
                  className="input-pixel"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

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
                {loading ? 'SAVING...' : 'UPDATE PASSWORD →'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

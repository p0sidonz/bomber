import { useState } from 'react'
import { updatePassword } from '../supabase'

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
    <div className="full-screen bg-bm-dark relative overflow-hidden">
      {/* Background bombs */}
      <div className="absolute inset-0 opacity-5 pointer-events-none select-none text-[120px] flex flex-wrap gap-8 p-8">
        {Array.from({ length: 20 }).map((_, i) => <span key={i}>💣</span>)}
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="logo-text mb-2">NOVA STRIKE</h1>
          <p className="text-[8px] text-gray-500 tracking-widest mt-3">RESET PASSWORD</p>
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
                <div className="text-[8px] text-bm-red leading-loose border border-bm-red p-2">
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

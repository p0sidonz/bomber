import { useState } from 'react'
import { supabase } from '../supabase'

export default function DeleteAccountScreen({ user, nav }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const isGuest = user?.isGuest

  async function handleDelete(e) {
    e.preventDefault()
    if (isGuest) {
      setError('Guest accounts cannot be deleted here.')
      return
    }

    if (!password) {
      setError('Please enter your password to confirm deletion.')
      return
    }

    const confirmDelete = window.confirm("Are you absolutely sure you want to permanently delete your account and all game data? This action CANNOT be undone.")
    if (!confirmDelete) return

    setLoading(true)
    setError('')
    try {
      // First verify the password by trying to sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      })
      if (authError) throw new Error('Incorrect password.')

      // Delete the user via the custom RPC function (requires Supabase SQL setup)
      const { error: deleteError } = await supabase.rpc('delete_user')
      if (deleteError) throw new Error('Failed to delete account. Please contact support. ' + deleteError.message)

      // Sign out locally
      await supabase.auth.signOut()
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="full-screen flex flex-col items-center justify-center p-4">
        <div className="bg-black/60 p-8 rounded-xl border border-bm-green shadow-[0_0_20px_rgba(0,255,0,0.2)] text-center max-w-md">
          <h2 className="text-bm-green text-xl mb-4 logo-text">ACCOUNT DELETED</h2>
          <p className="text-sm font-['Inter'] text-gray-300 mb-8">Your account and all associated data have been permanently removed from our servers.</p>
          <button className="btn-pixel w-full" onClick={() => nav('auth')}>RETURN TO START</button>
        </div>
      </div>
    )
  }

  return (
    <div className="full-screen relative overflow-hidden flex flex-col items-center justify-center pt-8 pb-4">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a0a0a] to-black z-0" />
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none text-[80px] flex flex-wrap gap-12 p-8 z-0">
        {Array.from({ length: 20 }).map((_, i) => <span key={i}>☠</span>)}
      </div>

      <div className="relative z-10 w-full max-w-md px-4 flex flex-col text-gray-300">
        <div className="bg-black/80 p-8 rounded-xl border border-red-900 shadow-[0_0_30px_rgba(255,0,0,0.15)] backdrop-blur-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="logo-text text-xl sm:text-2xl mb-1 text-bm-red">DELETE ACCOUNT</h1>
              <p className="text-[10px] text-red-500/80 tracking-widest font-bold">DANGER ZONE</p>
            </div>
          </div>

          {!user || isGuest ? (
            <div className="text-center font-['Inter']">
              <p className="mb-8 text-gray-400">You must be logged into a registered account to use this feature.</p>
              <button className="btn-pixel w-full" onClick={() => nav('auth')}>← RETURN TO MENU</button>
            </div>
          ) : (
            <form onSubmit={handleDelete} className="space-y-6">
              <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-sm font-['Inter'] text-red-200 leading-relaxed">
                <strong className="text-bm-red block mb-2 font-bold">WARNING:</strong>
                Deleting your account will permanently remove your login credentials, high scores, campaign progress, and multiplayer stats. This action cannot be undone.
              </div>

              <div>
                <label className="block text-[8px] text-gray-500 mb-2">CONFIRM PASSWORD</label>
                <input
                  type="password"
                  required
                  className="input-pixel w-full bg-black/50 border-gray-700 text-white"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {error && <div className="text-[9px] text-bm-red border border-bm-red/50 bg-bm-red/10 p-2 rounded">⚠ {error}</div>}

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-pixel bg-red-900 hover:bg-red-700 text-white border-red-800 flex-1" disabled={loading}>
                  {loading ? 'DELETING...' : 'PERMANENTLY DELETE'}
                </button>
                <button type="button" className="btn-pixel bg-gray-800 hover:bg-gray-700 border-gray-600 px-6" onClick={() => nav('auth')}>
                  CANCEL
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

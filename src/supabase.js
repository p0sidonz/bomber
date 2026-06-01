import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const GOOGLE_WEB_CLIENT_ID = '992048408581-o5da8d4g4k8e0d8rspgb7smu16c2gbb1.apps.googleusercontent.com'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'bm_session',
    storage: localStorage,
  },
})

let socialLoginInit = false
async function getSocialLogin() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  if (!socialLoginInit) {
    await SocialLogin.initialize({
      google: { webClientId: GOOGLE_WEB_CLIENT_ID },
    })
    socialLoginInit = true
  }
  return SocialLogin
}

// ─── AUTH HELPERS ────────────────────────────────────────────────────────────

export async function signUp(email, password, displayName, color) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, color },
    },
  })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  const SocialLogin = await getSocialLogin()

  let result
  try {
    result = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['profile', 'email'] },
    })
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes('cancel') || msg.includes('Cancel') || msg.includes('12501')) {
      throw new Error('Sign-in cancelled')
    }
    console.error('[SocialLogin] Google signIn error:', JSON.stringify(e))
    throw new Error(msg || 'Google Sign-In failed')
  }

  const idToken = result?.result?.idToken
  if (!idToken) {
    console.error('[SocialLogin] No idToken in response:', JSON.stringify(result))
    throw new Error('No ID token received from Google')
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  })
  if (error) throw error

  if (data?.user && !data.user.user_metadata?.display_name) {
    const profile = result?.result?.profile
    const gName = profile?.name || profile?.givenName || profile?.email?.split('@')[0] || 'Player'
    await supabase.auth.updateUser({
      data: { display_name: gName.substring(0, 12), color: 'cyan' }
    }).catch(() => {})
  }

  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session))
}

export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ─── ROOM HELPERS ────────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createRoom(userId, mapId = 1, matchType = 'last_standing') {
  const code = generateRoomCode()
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({ code, host_id: userId, map_id: mapId, match_type: matchType })
    .select()
    .single()
  if (roomErr) throw roomErr
  return room
}

export async function joinRoomByCode(code, userId, displayName, color) {
  // Find room
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  if (roomErr) throw new Error('Room not found')
  if (room.status !== 'waiting') throw new Error('Game already in progress')

  // Find next open slot
  const { data: existing } = await supabase
    .from('room_players')
    .select('slot')
    .eq('room_id', room.id)
    .order('slot')

  const usedSlots = new Set((existing || []).map(p => p.slot))
  let slot = null
  for (let i = 1; i <= 6; i++) {
    if (!usedSlots.has(i)) { slot = i; break }
  }
  if (slot === null) throw new Error('Room is full')

  const { error: playerErr } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, user_id: userId, display_name: displayName, color, slot })
  if (playerErr) throw playerErr

  return room
}

export async function setPlayerReady(roomId, userId, isReady) {
  const { error } = await supabase
    .from('room_players')
    .update({ is_ready: isReady })
    .eq('room_id', roomId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function startGame(roomId) {
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'countdown' })
    .eq('id', roomId)
  if (error) throw error
}

export async function getRoomPlayers(roomId) {
  const { data, error } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
    .order('slot')
  if (error) throw error
  return data
}

export async function updateRoomSettings(roomId, mapId, matchType) {
  const { error } = await supabase
    .from('rooms')
    .update({ map_id: mapId, match_type: matchType })
    .eq('id', roomId)
  if (error) throw error
}

// ─── GAME STATE HELPERS ───────────────────────────────────────────────────────

export async function upsertGameState(roomId, tick, state) {
  const { error } = await supabase
    .from('game_state')
    .upsert({ room_id: roomId, tick, state, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function getCampaignProgress(userId) {
  if (!userId) return {}
  const { data, error } = await supabase
    .from('campaign_progress')
    .select('campaign_data')
    .eq('user_id', userId)
    .maybeSingle()
    
  if (error) {
    console.error('Error fetching campaign:', error)
    return {}
  }
  return data?.campaign_data || {}
}

export async function saveCampaignProgress(campaignData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return // Guests do not save progress

  const { error } = await supabase
    .from('campaign_progress')
    .upsert({ 
      user_id: session.user.id, 
      campaign_data: campaignData,
      updated_at: new Date().toISOString()
    })
    
  if (error) throw error
}

// ─── LEADERBOARD HELPERS ─────────────────────────────────────────────────────

export async function upsertLeaderboard(userId, displayName, wins, kills, gamesPlayed) {
  if (userId === 'guest') return
  const { error } = await supabase
    .from('leaderboard')
    .upsert({
      user_id: userId,
      display_name: displayName,
      wins,
      kills,
      games_played: gamesPlayed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function insertHighScore(userId, displayName, score, levelReached) {
  if (userId === 'guest') return
  
  // Check existing best score
  const { data: existing } = await supabase
    .from('high_scores')
    .select('score')
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0 && existing[0].score >= score) {
    return // Not a new personal best
  }

  // Clean up old scores for this user so they only have 1 entry
  await supabase.from('high_scores').delete().eq('user_id', userId)

  const { error } = await supabase
    .from('high_scores')
    .insert({ user_id: userId, display_name: displayName, score, level_reached: levelReached })
  if (error) throw error
}

export async function getLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('wins', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

export async function getHighScores() {
  const { data, error } = await supabase
    .from('high_scores')
    .select('*')
    .order('score', { ascending: false })
    .limit(1000)
  if (error) throw error

  // Deduplicate on the fly (for legacy entries before cleanup was added)
  const seen = new Set()
  const unique = []
  for (const row of (data || [])) {
    if (!seen.has(row.user_id)) {
      seen.add(row.user_id)
      unique.push(row)
      if (unique.length === 20) break
    }
  }
  return unique
}

export async function getPersonalStats(userId) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

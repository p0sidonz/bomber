import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'bm_session',
    storage: localStorage,
  },
})

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

export async function saveCampaignProgress(campaignData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return // Guests do not save progress

  const { error } = await supabase.auth.updateUser({
    data: { campaign: campaignData }
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
    .limit(20)
  if (error) throw error
  return data
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

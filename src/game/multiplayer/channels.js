import { supabase } from '../../supabase.js'

let lobbyChannel = null
let gameChannel = null

// ─── LOBBY CHANNEL ────────────────────────────────────────────────────────────
export function subscribeLobby(roomCode, onPlayerChange, onRoomUpdate) {
  lobbyChannel = supabase
    .channel(`room:${roomCode}:lobby`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'room_players',
    }, onPlayerChange)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'rooms',
    }, onRoomUpdate)
    .subscribe()
  return lobbyChannel
}

export function unsubscribeLobby() {
  if (lobbyChannel) {
    supabase.removeChannel(lobbyChannel)
    lobbyChannel = null
  }
}

// ─── GAME CHANNEL ─────────────────────────────────────────────────────────────
export function subscribeGame(roomCode, handlers) {
  gameChannel = supabase
    .channel(`room:${roomCode}:game`, { config: { broadcast: { ack: false } } })
    .on('broadcast', { event: 'input' }, ({ payload }) => handlers.onInput?.(payload))
    .on('broadcast', { event: 'state' }, ({ payload }) => handlers.onState?.(payload))
    .on('broadcast', { event: 'explosion' }, ({ payload }) => handlers.onExplosion?.(payload))
    .on('broadcast', { event: 'powerup' }, ({ payload }) => handlers.onPowerup?.(payload))
    .on('broadcast', { event: 'death' }, ({ payload }) => handlers.onDeath?.(payload))
    .on('broadcast', { event: 'gate_open' }, ({ payload }) => handlers.onGateOpen?.(payload))
    .subscribe()
  return gameChannel
}

export function unsubscribeGame() {
  if (gameChannel) {
    supabase.removeChannel(gameChannel)
    gameChannel = null
  }
}

// ─── BROADCAST HELPERS ────────────────────────────────────────────────────────
export async function broadcastInput(userId, keys) {
  if (!gameChannel) return
  await gameChannel.send({
    type: 'broadcast',
    event: 'input',
    payload: { userId, keys, ts: Date.now() },
  })
}

export async function broadcastState(state) {
  if (!gameChannel) return
  await gameChannel.send({
    type: 'broadcast',
    event: 'state',
    payload: state,
  })
}

export async function broadcastDeath(playerId, killedBy) {
  if (!gameChannel) return
  await gameChannel.send({
    type: 'broadcast',
    event: 'death',
    payload: { playerId, killedBy },
  })
}

export async function broadcastGateOpen(gateId, openedBy) {
  if (!gameChannel) return
  await gameChannel.send({
    type: 'broadcast',
    event: 'gate_open',
    payload: { gateId, openedBy },
  })
}

export function getGameChannel() {
  return gameChannel
}

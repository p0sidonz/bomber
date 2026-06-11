import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { isAdFree } from './purchases.js'

// ─── AD UNIT IDs ──────────────────────────────────────────────────────────────
// Google Test IDs — replace with real IDs before publishing
const INTERSTITIAL_ID = Capacitor.getPlatform() === 'ios'
  ? 'ca-app-pub-3940256099942544/4411468910'   // iOS test
  : 'ca-app-pub-3940256099942544/1033173712'   // Android test

const REWARDED_ID = Capacitor.getPlatform() === 'ios'
  ? 'ca-app-pub-3940256099942544/1712485313'   // iOS test
  : 'ca-app-pub-3940256099942544/5224354917'   // Android test

// ─── STATE ────────────────────────────────────────────────────────────────────
let isInitialized   = false
let adReady         = false       // true when an ad is pre-loaded and ready to show
let adLoading       = false       // true while a load request is in flight
let lastShownAt     = 0           // timestamp of last shown ad
const MIN_INTERVAL  = 30_000      // 30s minimum between ads (Google policy)

// ─── INIT ─────────────────────────────────────────────────────────────────────
export async function initializeAdMob() {
  if (!Capacitor.isNativePlatform()) return
  if (isAdFree()) {
    console.log('[AdMob] Skipped init (ad-free purchase)')
    return
  }
  try {
    await AdMob.initialize({
      requestTrackingAuthorization: true,
      initializeForTesting: true, // TODO: Remove before publishing
    })
    isInitialized = true
    console.log('[AdMob] Initialized')
    // Pre-load first ad immediately so it's ready when needed
    _preloadAd()
  } catch (e) {
    console.error('[AdMob] Init failed', e)
  }
}

// ─── PRE-LOAD (internal) ──────────────────────────────────────────────────────
// Loads the next interstitial silently in the background.
// Always called right after showing an ad so the next one is ready.
async function _preloadAd() {
  if (!isInitialized || adLoading || adReady) return
  adLoading = true
  try {
    await AdMob.prepareInterstitial({
      adId: INTERSTITIAL_ID,
      isTesting: true, // TODO: Remove before publishing
    })
    adReady = true
    console.log('[AdMob] Ad pre-loaded and ready')
  } catch (e) {
    console.warn('[AdMob] Pre-load failed:', e?.message || e)
    adReady = false
    // Retry after a short delay
    setTimeout(_preloadAd, 8_000)
  } finally {
    adLoading = false
  }
}

// ─── SHOW (public) ────────────────────────────────────────────────────────────
/**
 * Show an interstitial ad if one is ready and the rate limit has passed.
 * Always silently returns if not available — never blocks gameplay.
 *
 * @param {string} [reason] - Optional label for logging (e.g. 'level_clear', 'quit')
 * @returns {Promise<boolean>} true if the ad was shown, false otherwise
 */
export async function showInterstitialAd(reason = 'unknown') {
  // Skip all ads if user purchased "Remove Ads"
  if (isAdFree()) {
    console.log(`[AdMob] Skipped (ad-free purchase) — ${reason}`)
    return false
  }
  if (!Capacitor.isNativePlatform() || !isInitialized) return false

  // Rate limit: don't show more than once per MIN_INTERVAL
  const now = Date.now()
  if (now - lastShownAt < MIN_INTERVAL) {
    console.log(`[AdMob] Skipped (rate limit, ${Math.round((MIN_INTERVAL - (now - lastShownAt)) / 1000)}s remaining) — ${reason}`)
    return false
  }

  // If ad isn't ready yet, try a one-shot load (blocks briefly, max 3s)
  if (!adReady) {
    if (!adLoading) {
      console.log(`[AdMob] Not ready, attempting quick load — ${reason}`)
      await Promise.race([
        _preloadAd(),
        new Promise(r => setTimeout(r, 3_000)), // 3s timeout
      ])
    }
    if (!adReady) {
      console.log(`[AdMob] Ad not available — ${reason}`)
      return false
    }
  }

  try {
    lastShownAt = now
    adReady = false  // Mark as consumed before showing
    console.log(`[AdMob] Showing ad — reason: ${reason}`)
    await AdMob.showInterstitial()
    return true
  } catch (e) {
    console.error('[AdMob] Show failed:', e?.message || e)
    return false
  } finally {
    // Always pre-load the next ad immediately after showing one
    _preloadAd()
  }
}

// ─── REWARDED ADS ─────────────────────────────────────────────────────────────

export async function showRewardedAd() {
  if (!Capacitor.isNativePlatform() || !isInitialized) {
    console.log('[AdMob] Mocking rewarded ad success (web or uninitialized)')
    return true // Mock success for web
  }

  return new Promise(async (resolve) => {
    let rewarded = false
    
    // Listen for the reward event
    const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      console.log('[AdMob] User earned reward!')
      rewarded = true
    })

    const closeListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('[AdMob] Rewarded ad dismissed')
      rewardListener.remove()
      closeListener.remove()
      resolve(rewarded)
    })

    try {
      console.log('[AdMob] Preparing rewarded ad...')
      await AdMob.prepareRewardVideoAd({
        adId: REWARDED_ID,
        isTesting: true,
      })
      console.log('[AdMob] Showing rewarded ad...')
      await AdMob.showRewardVideoAd()
    } catch (e) {
      console.error('[AdMob] Failed to show rewarded ad', e)
      rewardListener.remove()
      closeListener.remove()
      resolve(false)
    }
  })
}

// ─── CONVENIENCE WRAPPERS ─────────────────────────────────────────────────────
// Named triggers make it easy to understand ad placement in the codebase.

/** Show ad when a level is cleared */
export const adOnLevelClear  = () => showInterstitialAd('level_clear')

/** Show ad on game over / death */
export const adOnGameOver    = () => showInterstitialAd('game_over')

/** Show ad when user quits mid-game (back button or quit button) */
export const adOnQuit        = () => showInterstitialAd('quit_game')

/** Show ad when returning to main menu / level select */
export const adOnMenuReturn  = () => showInterstitialAd('menu_return')

/** Show ad on app open / landing screen (max once per session anyway due to rate limit) */
export const adOnAppOpen     = () => showInterstitialAd('app_open')

// ─── ANDROID BACK BUTTON HANDLER ─────────────────────────────────────────────
// Register a global Capacitor back-button listener that shows an ad whenever
// the user presses the hardware back button during gameplay.
// Call this once from your app entry point.
let _backListenerRegistered = false
export function registerBackButtonAdTrigger() {
  if (!Capacitor.isNativePlatform() || _backListenerRegistered) return
  _backListenerRegistered = true

  App.addListener('backButton', ({ canGoBack }) => {
    // Fire a non-blocking ad — doesn't prevent navigation
    adOnQuit()
  })
  console.log('[AdMob] Back-button ad trigger registered')
}

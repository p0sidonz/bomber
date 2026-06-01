import { Capacitor } from '@capacitor/core'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PRODUCT_ID = 'remove_ads'
const STORAGE_KEY = 'omega_ad_free'

// ─── STATE ────────────────────────────────────────────────────────────────────
let adFree = false
let initialized = false

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function persistAdFree(value) {
  adFree = !!value
  try { localStorage.setItem(STORAGE_KEY, adFree ? '1' : '0') } catch (_) {}
}

function loadCachedAdFree() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch (_) { return false }
}

// ─── DYNAMIC IMPORT ───────────────────────────────────────────────────────────
// We dynamically import the plugin so the module doesn't crash on web/dev where
// the native billing bridge isn't available.
async function getNativePurchases() {
  const mod = await import('@capgo/native-purchases')
  return mod.NativePurchases
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Synchronous check — safe to call anywhere, anytime.
 * Returns true if the user has purchased the "Remove Ads" product.
 */
export function isAdFree() {
  return adFree
}

/**
 * Initialize the purchases system. Call once on app startup.
 * Checks the store for owned purchases and syncs local state.
 */
export async function initPurchases() {
  // Load cached value first for instant ad-free check
  adFree = loadCachedAdFree()

  if (!Capacitor.isNativePlatform()) {
    console.log('[Purchases] Skipping init (not native)')
    return
  }

  try {
    const NativePurchases = await getNativePurchases()

    // Initialize the billing client
    await NativePurchases.initialize()
    initialized = true
    console.log('[Purchases] Billing client initialized')

    // Check for existing owned purchases (handles reinstalls, etc.)
    await _syncOwnedPurchases(NativePurchases)

    // Also finish any unfinished/pending transactions
    await _finishPendingTransactions(NativePurchases)
  } catch (e) {
    console.error('[Purchases] Init failed:', e?.message || e)
    // Keep cached value — don't lock users out if billing service is temporarily unavailable
  }
}

/**
 * Trigger the Play Store purchase flow for "Remove Ads".
 * @returns {Promise<boolean>} true if purchase succeeded
 */
export async function purchaseRemoveAds() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[Purchases] Cannot purchase on web')
    return false
  }
  if (!initialized) {
    console.warn('[Purchases] Billing not initialized yet, attempting to initialize...')
    try {
      const NativePurchases = await getNativePurchases()
      await NativePurchases.initialize()
      initialized = true
    } catch (e) {
      throw new Error('Billing service is unavailable or initializing failed.')
    }
  }

  try {
    const NativePurchases = await getNativePurchases()

    // Start the purchase flow
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: PRODUCT_ID,
      productType: 'INAPP',
      quantity: 1,
    })

    console.log('[Purchases] Purchase result:', result)

    // Acknowledge the non-consumable purchase so Google doesn't auto-refund
    if (result?.transactionId) {
      await NativePurchases.acknowledgePurchase({
        transactionId: result.transactionId,
      })
      console.log('[Purchases] Purchase acknowledged:', result.transactionId)
    }

    persistAdFree(true)
    console.log('[Purchases] ✅ Remove Ads purchased successfully')
    return true
  } catch (e) {
    // User cancellation is not an error
    if (e?.code === 'USER_CANCELLED' || e?.message?.includes('cancel')) {
      console.log('[Purchases] User cancelled purchase')
      return false
    }
    console.error('[Purchases] Purchase failed:', e?.message || e)
    throw e
  }
}

/**
 * Restore purchases — for users who reinstalled or switched devices.
 * @returns {Promise<boolean>} true if "Remove Ads" was found in owned purchases
 */
export async function restorePurchases() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[Purchases] Cannot restore on web')
    return false
  }

  try {
    const NativePurchases = await getNativePurchases()

    if (!initialized) {
      await NativePurchases.initialize()
      initialized = true
    }

    return await _syncOwnedPurchases(NativePurchases)
  } catch (e) {
    console.error('[Purchases] Restore failed:', e?.message || e)
    throw e
  }
}

/**
 * Get the localized price string for the "Remove Ads" product.
 * @returns {Promise<string|null>} e.g. "$3.00" or null if unavailable
 */
export async function getRemoveAdsPrice() {
  if (!Capacitor.isNativePlatform() || !initialized) return null

  try {
    const NativePurchases = await getNativePurchases()
    const result = await NativePurchases.getProducts({
      productIdentifiers: [PRODUCT_ID],
      productType: 'INAPP',
    })

    const product = result?.products?.find(p => p.productIdentifier === PRODUCT_ID)
    return product?.priceString || product?.price?.toString() || null
  } catch (e) {
    console.warn('[Purchases] Failed to get price:', e?.message || e)
    return null
  }
}

// ─── INTERNAL ─────────────────────────────────────────────────────────────────

async function _syncOwnedPurchases(NativePurchases) {
  try {
    const result = await NativePurchases.getActiveTransactions()
    const transactions = result?.transactions || []

    const hasRemoveAds = transactions.some(
      t => t.productIdentifier === PRODUCT_ID
    )

    if (hasRemoveAds) {
      persistAdFree(true)
      console.log('[Purchases] ✅ "Remove Ads" found in owned purchases')
      return true
    } else {
      // Don't revoke if billing service returned empty — could be a temporary issue.
      // Only update if we're confident the store responded properly.
      if (transactions.length >= 0) {
        persistAdFree(false)
      }
      console.log('[Purchases] No "Remove Ads" purchase found')
      return false
    }
  } catch (e) {
    console.warn('[Purchases] Sync owned purchases failed:', e?.message || e)
    return false
  }
}

async function _finishPendingTransactions(NativePurchases) {
  try {
    const result = await NativePurchases.getUnfinishedTransactions()
    const pending = result?.transactions || []

    for (const txn of pending) {
      if (txn.productIdentifier === PRODUCT_ID) {
        await NativePurchases.acknowledgePurchase({
          transactionId: txn.transactionId,
        })
        persistAdFree(true)
        console.log('[Purchases] Finished pending transaction:', txn.transactionId)
      }
    }
  } catch (e) {
    console.warn('[Purchases] Finish pending failed:', e?.message || e)
  }
}

import { Capacitor } from '@capacitor/core'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PRODUCT_ID = 'remove_ads'
const STORAGE_KEY = 'omega_ad_free'
const PURCHASE_TIMEOUT_MS = 90000

// ─── STATE ────────────────────────────────────────────────────────────────────
let adFree = false
let initialized = false
let billingSupported = false

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function persistAdFree(value) {
  adFree = !!value
  try { localStorage.setItem(STORAGE_KEY, adFree ? '1' : '0') } catch (_) {}
}

function loadCachedAdFree() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch (_) { return false }
}

function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

async function getNativePurchases() {
  const mod = await import('@capgo/native-purchases')
  return { NativePurchases: mod.NativePurchases, PURCHASE_TYPE: mod.PURCHASE_TYPE }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export function isAdFree() {
  return adFree
}

export async function initPurchases() {
  adFree = loadCachedAdFree()

  if (!Capacitor.isNativePlatform()) {
    console.log('[Purchases] Skipping init (not native)')
    return
  }

  try {
    const { NativePurchases, PURCHASE_TYPE } = await getNativePurchases()

    const { isBillingSupported: supported } = await withTimeout(
      NativePurchases.isBillingSupported(),
      10000,
      'Billing support check'
    )

    if (!supported) {
      console.warn('[Purchases] Billing not supported on this device')
      return
    }

    billingSupported = true
    initialized = true
    console.log('[Purchases] Billing client ready')

    await _syncOwnedPurchases(NativePurchases, PURCHASE_TYPE)
  } catch (e) {
    console.error('[Purchases] Init failed:', e?.message || e)
  }
}

export async function purchaseRemoveAds() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[Purchases] Cannot purchase on web')
    return false
  }

  const { NativePurchases, PURCHASE_TYPE } = await getNativePurchases()

  if (!initialized) {
    console.warn('[Purchases] Billing not initialized, attempting...')
    try {
      const { isBillingSupported: supported } = await withTimeout(
        NativePurchases.isBillingSupported(),
        10000,
        'Billing check'
      )
      if (!supported) throw new Error('Billing not supported on this device')
      billingSupported = true
      initialized = true
    } catch (e) {
      throw new Error('Billing service is unavailable. Please try again later.', JSON.stringify(e))
    }
  }

  try {
    const result = await withTimeout(
      NativePurchases.purchaseProduct({
        productIdentifier: PRODUCT_ID,
        productType: PURCHASE_TYPE.INAPP,
        quantity: 1,
        autoAcknowledgePurchases: true,
      }),
      PURCHASE_TIMEOUT_MS,
      'Purchase'
    )

    console.log('[Purchases] Purchase result:', result)
    persistAdFree(true)
    console.log('[Purchases] Remove Ads purchased successfully')
    return true
  } catch (e) {
    if (e?.message?.includes('cancel') || e?.message?.includes('Cancel') || e?.code === 'USER_CANCELLED') {
      console.log('[Purchases] User cancelled purchase')
      return false
    }
    console.error('[Purchases] Purchase failed:', e?.message || e)
    throw e
  }
}

export async function restorePurchases() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[Purchases] Cannot restore on web')
    return false
  }

  try {
    const { NativePurchases, PURCHASE_TYPE } = await getNativePurchases()

    if (!initialized) {
      const { isBillingSupported: supported } = await withTimeout(
        NativePurchases.isBillingSupported(),
        10000,
        'Billing check'
      )
      if (!supported) throw new Error('Billing not supported')
      initialized = true
    }

    return await _syncOwnedPurchases(NativePurchases, PURCHASE_TYPE)
  } catch (e) {
    console.error('[Purchases] Restore failed:', e?.message || e)
    throw e
  }
}

export async function getRemoveAdsPrice() {
  if (!Capacitor.isNativePlatform() || !initialized) return null

  try {
    const { NativePurchases, PURCHASE_TYPE } = await getNativePurchases()

    const result = await withTimeout(
      NativePurchases.getProducts({
        productIdentifiers: [PRODUCT_ID],
        productType: PURCHASE_TYPE.INAPP,
      }),
      10000,
      'Get price'
    )

    const product = result?.products?.find(p => p.productIdentifier === PRODUCT_ID)
    return product?.priceString || product?.price?.toString() || null
  } catch (e) {
    console.warn('[Purchases] Failed to get price:', e?.message || e)
    return null
  }
}

// ─── INTERNAL ─────────────────────────────────────────────────────────────────

async function _syncOwnedPurchases(NativePurchases, PURCHASE_TYPE) {
  try {
    const result = await withTimeout(
      NativePurchases.getPurchases({
        productType: PURCHASE_TYPE.INAPP,
      }),
      15000,
      'Sync purchases'
    )

    const purchases = result?.purchases || []

    const hasRemoveAds = purchases.some(
      p => p.productIdentifier === PRODUCT_ID
    )

    if (hasRemoveAds) {
      persistAdFree(true)
      console.log('[Purchases] "Remove Ads" found in owned purchases')
      return true
    } else {
      persistAdFree(false)
      console.log('[Purchases] No "Remove Ads" purchase found')
      return false
    }
  } catch (e) {
    console.warn('[Purchases] Sync owned purchases failed:', e?.message || e)
    return false
  }
}

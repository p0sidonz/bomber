import { AdMob } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

// These are Google's official Test Ad Unit IDs for Interstitial ads.
// You must replace these with your actual Ad Unit IDs (which look like ca-app-pub-XXX/YYY) before publishing!
const INTERSTITIAL_TEST_ID = Capacitor.getPlatform() === 'ios'
  ? 'ca-app-pub-3940256099942544/4411468910'
  : 'ca-app-pub-3940256099942544/1033173712'

let isInitialized = false
let isPreparing = false

export async function initializeAdMob() {
  if (Capacitor.isNativePlatform()) {
    try {
      await AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: true, // TODO: Remove or set to false before publishing!
      })
      isInitialized = true
      console.log('AdMob initialized successfully')
    } catch (e) {
      console.error('AdMob initialization failed', e)
    }
  }
}

export async function showInterstitialAd() {
  if (!Capacitor.isNativePlatform() || !isInitialized || isPreparing) return
  try {
    isPreparing = true
    await AdMob.prepareInterstitial({
      adId: INTERSTITIAL_TEST_ID,
      isTesting: true, // TODO: Remove or set to false before publishing!
    })
    await AdMob.showInterstitial()
  } catch (e) {
    console.error('Failed to show interstitial ad', e)
  } finally {
    isPreparing = false
  }
}

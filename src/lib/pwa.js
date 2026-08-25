// Helper tombol "Install App" (PWA install prompt + fallback petunjuk iOS).

let deferredPrompt = null
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => fn(canInstall()))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function canInstall() {
  return Boolean(deferredPrompt)
}

export function onInstallAvailable(fn) {
  listeners.add(fn)
  fn(canInstall())
  return () => listeners.delete(fn)
}

export async function promptInstall() {
  if (!deferredPrompt) return 'tidak-tersedia'
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome // 'accepted' | 'dismissed'
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

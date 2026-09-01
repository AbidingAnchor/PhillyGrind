const listeners = new Set();

let deferredPrompt = null;
let installed = false;
let capturing = false;

function notify() {
  listeners.forEach((listener) => listener());
}

export function getPwaInstallContext(forcePreview = false) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }

  // Allow force-preview for QA testing
  if (forcePreview) {
    return 'preview';
  }

  const ua = navigator.userAgent || '';
  
  // iOS: rely on navigator.standalone (most reliable)
  const isIOSStandalone = window.navigator.standalone === true;
  
  // Other platforms: only check display-mode: standalone specifically
  // Don't include fullscreen or minimal-ui as they don't indicate PWA installation
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isIOSStandalone || isStandalone) return 'installed';

  const isIOS =
    /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';

  if (deferredPrompt) return 'native';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function capturePwaInstallPrompt() {
  if (typeof window === 'undefined' || capturing) return;
  capturing = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export function hasNativeInstallPrompt() {
  return Boolean(deferredPrompt);
}

export function isPwaInstalled() {
  return installed || getPwaInstallContext() === 'installed';
}

export function subscribeToPwaInstall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function promptNativeInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' };

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      installed = true;
    }
    notify();
    return choice || { outcome: 'dismissed' };
  } catch {
    return { outcome: 'dismissed' };
  }
}

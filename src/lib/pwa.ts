// src/lib/pwa.ts

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let readyCallback: (() => void) | null = null;

// THIS IS THE KEY: We start listening immediately when the JS file loads,
// not when the React component mounts.
if (typeof window !== 'undefined') {
  console.log('Listening for beforeinstallprompt event');
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    
    // If a component is already waiting for this, tell it!
    if (readyCallback) {
      readyCallback();
    }
  });
}

export const setupInstallPrompt = (onPromptReady: () => void): (() => void) => {
  readyCallback = onPromptReady;

  // If the event ALREADY happened before this function was called,
  // trigger the callback immediately.
  if (deferredPrompt) {
    onPromptReady();
  }

  return () => {
    readyCallback = null;
  };
};

export const promptInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) {
    return false;
  }

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  
  return outcome === 'accepted';
};

export const isStandalone = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
};
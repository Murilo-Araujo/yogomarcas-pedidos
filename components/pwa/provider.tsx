'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { getInstallPlatform, isEmbeddedBrowser } from '@/lib/pwa';
import type { InstallOutcome, InstallPlatform, InstallPromptEvent } from '@/lib/pwa';

type PwaState = {
  ready: boolean;
  installed: boolean;
  platform: InstallPlatform;
  embedded: boolean;
  canInstall: boolean;
  installing: boolean;
  install: () => Promise<InstallOutcome>;
};

const PwaContext = createContext<PwaState | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [embedded, setEmbedded] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [offline, setOffline] = useState(false);
  const promptRef = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    // The bio page is a public gateway, with no ordering/install flow.
    if (window.location.pathname === '/links' || window.location.hostname === 'link.yogomarkets.com.br') {
      setReady(true);
      return;
    }
    const standalone = window.matchMedia('(display-mode: standalone)');
    const syncDisplay = () => setInstalled(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const syncNetwork = () => setOffline(!navigator.onLine);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
      setCanInstall(true);
      setInstalled(false);
    };
    const onInstalled = () => {
      promptRef.current = null;
      setCanInstall(false);
      setInstalled(true);
    };
    syncDisplay();
    syncNetwork();
    setPlatform(getInstallPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setEmbedded(isEmbeddedBrowser(navigator.userAgent));
    setReady(true);
    standalone.addEventListener('change', syncDisplay);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', syncNetwork);
    window.addEventListener('offline', syncNetwork);

    // Static offline help only: never cache customer data, catalog prices or orders.
    // Production-only registration avoids stale workers during local development.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        // Browsing and manual installation remain available if registration is blocked.
      });
    }
    return () => {
      standalone.removeEventListener('change', syncDisplay);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', syncNetwork);
      window.removeEventListener('offline', syncNetwork);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const prompt = promptRef.current;
    if (!prompt) return 'unavailable';
    // A beforeinstallprompt event can only be used once, even after dismissal.
    promptRef.current = null;
    setCanInstall(false);
    setInstalling(true);
    try {
      await prompt.prompt();
      return (await prompt.userChoice).outcome;
    } catch {
      return 'error';
    } finally {
      setInstalling(false);
    }
  }, []);

  return (
    <PwaContext.Provider value={{ ready, installed, platform, embedded, canInstall, installing, install }}>
      {offline && <div className="pwa-offline-notice" role="status"><WifiOff size={18} aria-hidden="true"/><span>Sem conexão. Reconecte para atualizar os preços e enviar seu pedido.</span></div>}
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const state = useContext(PwaContext);
  if (!state) throw new Error('usePwa requires PwaProvider');
  return state;
}

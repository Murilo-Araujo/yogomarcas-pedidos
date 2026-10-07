export type InstallPlatform = 'ios' | 'android' | 'desktop';

export function getInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  return /Android/i.test(userAgent) ? 'android' : 'desktop';
}

export function isEmbeddedBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|; wv\)|\bwv\b/i.test(userAgent);
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'error';
export interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' } | void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

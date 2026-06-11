const STORAGE_KEY = 'zeon:viewport-nav-hint-dismissed';

export function isViewportNavHintDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markViewportNavHintDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

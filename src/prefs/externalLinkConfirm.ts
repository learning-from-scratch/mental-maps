const STORAGE_KEY = 'zeon:skip-external-link-confirm';

export function isExternalLinkConfirmSkipped(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setExternalLinkConfirmSkipped(skipped: boolean): void {
  try {
    if (skipped) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

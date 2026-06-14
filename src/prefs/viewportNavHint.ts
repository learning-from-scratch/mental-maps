const STORAGE_KEY = 'zeon:viewport-nav-hint-dismissed-sheets';
const LEGACY_STORAGE_KEY = 'zeon:viewport-nav-hint-dismissed';

function readDismissedSheetIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeDismissedSheetIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

/** @deprecated Legacy global dismiss — treated as dismissed for all sheets on first read. */
function consumeLegacyGlobalDismiss(): boolean {
  try {
    if (localStorage.getItem(LEGACY_STORAGE_KEY) !== '1') return false;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isSheetNavHintDismissed(sheetId: string): boolean {
  return readDismissedSheetIds().has(sheetId);
}

export function markSheetNavHintDismissed(sheetId: string): void {
  const ids = readDismissedSheetIds();
  if (ids.has(sheetId)) return;
  ids.add(sheetId);
  writeDismissedSheetIds(ids);
}

/** Mark every known sheet as dismissed (for legacy global dismiss migration). */
export function markAllSheetsNavHintDismissed(sheetIds: string[]): void {
  const ids = readDismissedSheetIds();
  for (const sheetId of sheetIds) {
    ids.add(sheetId);
  }
  writeDismissedSheetIds(ids);
}

export function wasLegacyNavHintGloballyDismissed(): boolean {
  return consumeLegacyGlobalDismiss();
}

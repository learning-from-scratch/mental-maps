import { applyPatches, enablePatches, type Patch } from 'immer';
import type { Sheet, SheetId } from './model/types';

enablePatches();

export interface SheetChangePatch {
  sheetId: SheetId;
  patches: Patch[];
  inversePatches: Patch[];
}

export interface SheetsByIdChangePatch {
  patches: Patch[];
  inversePatches: Patch[];
}

export interface SheetUndoEntry {
  sheetChanges?: SheetChangePatch[];
  sheetsByIdChange?: SheetsByIdChangePatch;
}

export interface SheetUndoState {
  undoStack: SheetUndoEntry[];
  redoStack: SheetUndoEntry[];
}

export function createSheetUndoState(): SheetUndoState {
  return { undoStack: [], redoStack: [] };
}

export function singleSheetChange(
  sheetId: SheetId,
  patches: Patch[],
  inversePatches: Patch[],
): SheetUndoEntry {
  return { sheetChanges: [{ sheetId, patches, inversePatches }] };
}

export function sheetsByIdChange(
  patches: Patch[],
  inversePatches: Patch[],
): SheetUndoEntry {
  return { sheetsByIdChange: { patches, inversePatches } };
}

export function recordSheetUndo(state: SheetUndoState, entry: SheetUndoEntry): void {
  const sheetChanges = entry.sheetChanges?.filter((change) => change.patches.length > 0) ?? [];
  const hasSheetsByIdChange =
    entry.sheetsByIdChange != null && entry.sheetsByIdChange.patches.length > 0;

  if (sheetChanges.length === 0 && !hasSheetsByIdChange) return;

  state.undoStack.push({
    sheetChanges: sheetChanges.length > 0 ? sheetChanges : undefined,
    sheetsByIdChange: hasSheetsByIdChange ? entry.sheetsByIdChange : undefined,
  });
  state.redoStack = [];
}

function applySheetEntry(
  sheetsById: Record<SheetId, Sheet>,
  entry: SheetUndoEntry,
  inverse: boolean,
): Record<SheetId, Sheet> {
  if (entry.sheetsByIdChange) {
    const patchSet = inverse
      ? entry.sheetsByIdChange.inversePatches
      : entry.sheetsByIdChange.patches;
    if (patchSet.length === 0) return sheetsById;
    return applyPatches(sheetsById, patchSet) as Record<SheetId, Sheet>;
  }

  let next = sheetsById;
  for (const change of entry.sheetChanges ?? []) {
    const sheet = next[change.sheetId];
    if (!sheet) continue;
    const patchSet = inverse ? change.inversePatches : change.patches;
    if (patchSet.length === 0) continue;
    next = {
      ...next,
      [change.sheetId]: applyPatches(sheet, patchSet) as Sheet,
    };
  }
  return next;
}

export function undoSheets(
  sheetsById: Record<SheetId, Sheet>,
  state: SheetUndoState,
): Record<SheetId, Sheet> | null {
  const entry = state.undoStack.pop();
  if (!entry) return null;

  const next = applySheetEntry(sheetsById, entry, true);
  state.redoStack.push(entry);
  return next;
}

export function redoSheets(
  sheetsById: Record<SheetId, Sheet>,
  state: SheetUndoState,
): Record<SheetId, Sheet> | null {
  const entry = state.redoStack.pop();
  if (!entry) return null;

  const next = applySheetEntry(sheetsById, entry, false);
  state.undoStack.push(entry);
  return next;
}

export function canUndoSheet(state: SheetUndoState): boolean {
  return state.undoStack.length > 0;
}

export function canRedoSheet(state: SheetUndoState): boolean {
  return state.redoStack.length > 0;
}

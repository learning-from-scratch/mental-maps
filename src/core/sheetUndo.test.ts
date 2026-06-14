import { produceWithPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { createSheet } from './model/factories';
import {
  canRedoSheet,
  canUndoSheet,
  createSheetUndoState,
  recordSheetUndo,
  redoSheets,
  singleSheetChange,
  undoSheets,
} from './sheetUndo';

describe('sheetUndo', () => {
  it('undoes and redoes sheet edits', () => {
    const sheet = createSheet({ title: 'Original' });
    const state = createSheetUndoState();

    const [nextSheet, patches, inversePatches] = produceWithPatches(sheet, (draft) => {
      draft.title = 'Updated';
    });
    recordSheetUndo(state, singleSheetChange(sheet.id, patches, inversePatches));

    expect(nextSheet.title).toBe('Updated');
    expect(canUndoSheet(state)).toBe(true);
    expect(canRedoSheet(state)).toBe(false);

    const undone = undoSheets({ [sheet.id]: nextSheet }, state);
    expect(undone?.[sheet.id]?.title).toBe('Original');
    expect(canUndoSheet(state)).toBe(false);
    expect(canRedoSheet(state)).toBe(true);

    const redone = redoSheets(undone!, state);
    expect(redone?.[sheet.id]?.title).toBe('Updated');
  });
});

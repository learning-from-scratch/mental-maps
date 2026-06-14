import type { Patch } from 'immer';
import { useCallback, useRef, useState } from 'react';
import {
  canRedoSheet,
  canUndoSheet,
  createSheetUndoState,
  recordSheetUndo,
  redoSheets,
  singleSheetChange,
  sheetsByIdChange,
  undoSheets,
  type SheetUndoEntry,
  type SheetUndoState,
} from '@/core/sheetUndo';
import type { Sheet, SheetId } from '@/core/model/types';

export function useSheetUndo() {
  const stacksRef = useRef<Map<string, SheetUndoState>>(new Map());
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((current) => current + 1), []);

  const getStack = useCallback((projectId: string): SheetUndoState => {
    let stack = stacksRef.current.get(projectId);
    if (!stack) {
      stack = createSheetUndoState();
      stacksRef.current.set(projectId, stack);
    }
    return stack;
  }, []);

  const recordSheetChange = useCallback(
    (
      projectId: string,
      sheetId: SheetId,
      patches: Patch[],
      inversePatches: Patch[],
    ) => {
      const stack = getStack(projectId);
      recordSheetUndo(stack, singleSheetChange(sheetId, patches, inversePatches));
      bump();
    },
    [bump, getStack],
  );

  const recordSheetChanges = useCallback(
    (projectId: string, entry: SheetUndoEntry) => {
      const stack = getStack(projectId);
      recordSheetUndo(stack, entry);
      bump();
    },
    [bump, getStack],
  );

  const recordSheetsByIdChange = useCallback(
    (projectId: string, patches: Patch[], inversePatches: Patch[]) => {
      const stack = getStack(projectId);
      recordSheetUndo(stack, sheetsByIdChange(patches, inversePatches));
      bump();
    },
    [bump, getStack],
  );

  const canUndo = useCallback(
    (projectId: string) => {
      void version;
      return canUndoSheet(getStack(projectId));
    },
    [getStack, version],
  );

  const canRedo = useCallback(
    (projectId: string) => {
      void version;
      return canRedoSheet(getStack(projectId));
    },
    [getStack, version],
  );

  const applyUndo = useCallback(
    (
      projectId: string,
      sheetsById: Record<SheetId, Sheet>,
    ): Record<SheetId, Sheet> | null => {
      const stack = getStack(projectId);
      const next = undoSheets(sheetsById, stack);
      if (next) bump();
      return next;
    },
    [bump, getStack],
  );

  const applyRedo = useCallback(
    (
      projectId: string,
      sheetsById: Record<SheetId, Sheet>,
    ): Record<SheetId, Sheet> | null => {
      const stack = getStack(projectId);
      const next = redoSheets(sheetsById, stack);
      if (next) bump();
      return next;
    },
    [bump, getStack],
  );

  return {
    recordSheetChange,
    recordSheetChanges,
    recordSheetsByIdChange,
    canUndo,
    canRedo,
    applyUndo,
    applyRedo,
  };
}

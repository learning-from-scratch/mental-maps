import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import type { MindMapDocument } from '../model/types';
import { assertValid } from '../model/validate';
import { commandHandlers } from './commands';
import type {
  CommandName,
  CommandPayloadMap,
  CommandResultMap,
} from './types';

enablePatches();

export interface UndoEntry {
  command: CommandName;
  payload: CommandPayloadMap[CommandName];
  result?: CommandResultMap[CommandName];
  patches: Patch[];
  inversePatches: Patch[];
}

export interface DocumentState {
  doc: MindMapDocument;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
}

export function createDocumentState(doc: MindMapDocument): DocumentState {
  return {
    doc,
    undoStack: [],
    redoStack: [],
  };
}

export function executeCommand<K extends CommandName>(
  state: DocumentState,
  command: K,
  payload: CommandPayloadMap[K],
  options: { validate?: boolean } = {},
): CommandResultMap[K] {
  let result: CommandResultMap[K];
  const [nextDoc, patches, inversePatches] = produceWithPatches(state.doc, (draft) => {
    const sheetId = draft.sheets[0];
    if (!sheetId) {
      throw new Error('Document has no sheets');
    }

    const ctx = { doc: draft, sheetId };
    switch (command) {
      case 'addChild':
        result = commandHandlers.addChild(
          ctx,
          payload as CommandPayloadMap['addChild'],
        ) as CommandResultMap[K];
        break;
      case 'addSibling':
        result = commandHandlers.addSibling(
          ctx,
          payload as CommandPayloadMap['addSibling'],
        ) as CommandResultMap[K];
        break;
      case 'addFloating':
        result = commandHandlers.addFloating(
          ctx,
          payload as CommandPayloadMap['addFloating'],
        ) as CommandResultMap[K];
        break;
      case 'setText':
        result = commandHandlers.setText(
          ctx,
          payload as CommandPayloadMap['setText'],
        ) as CommandResultMap[K];
        break;
      case 'deleteTopics':
        result = commandHandlers.deleteTopics(
          ctx,
          payload as CommandPayloadMap['deleteTopics'],
        ) as CommandResultMap[K];
        break;
      case 'duplicateBranch':
        result = commandHandlers.duplicateBranch(
          ctx,
          payload as CommandPayloadMap['duplicateBranch'],
        ) as CommandResultMap[K];
        break;
      case 'moveBranch':
        result = commandHandlers.moveBranch(
          ctx,
          payload as CommandPayloadMap['moveBranch'],
        ) as CommandResultMap[K];
        break;
      case 'reorderChild':
        result = commandHandlers.reorderChild(
          ctx,
          payload as CommandPayloadMap['reorderChild'],
        ) as CommandResultMap[K];
        break;
      case 'toggleCollapse':
        result = commandHandlers.toggleCollapse(
          ctx,
          payload as CommandPayloadMap['toggleCollapse'],
        ) as CommandResultMap[K];
        break;
      case 'detachAsFloating':
        result = commandHandlers.detachAsFloating(
          ctx,
          payload as CommandPayloadMap['detachAsFloating'],
        ) as CommandResultMap[K];
        break;
      case 'attachFloating':
        result = commandHandlers.attachFloating(
          ctx,
          payload as CommandPayloadMap['attachFloating'],
        ) as CommandResultMap[K];
        break;
      case 'setStyle':
        result = commandHandlers.setStyle(
          ctx,
          payload as CommandPayloadMap['setStyle'],
        ) as CommandResultMap[K];
        break;
      default: {
        const exhaustive: never = command;
        throw new Error(`Unknown command: ${exhaustive}`);
      }
    }
  });

  if (options.validate !== false) {
    assertValid(nextDoc);
  }

  state.doc = nextDoc;
  state.undoStack.push({
    command,
    payload,
    result: result!,
    patches,
    inversePatches,
  });
  state.redoStack = [];

  return result!;
}

export function undo(state: DocumentState, options: { validate?: boolean } = {}): boolean {
  const entry = state.undoStack.pop();
  if (!entry) return false;

  state.doc = applyPatches(state.doc, entry.inversePatches) as MindMapDocument;

  if (options.validate !== false) {
    assertValid(state.doc);
  }

  state.redoStack.push(entry);
  return true;
}

export function redo(state: DocumentState, options: { validate?: boolean } = {}): boolean {
  const entry = state.redoStack.pop();
  if (!entry) return false;

  state.doc = applyPatches(state.doc, entry.patches) as MindMapDocument;

  if (options.validate !== false) {
    assertValid(state.doc);
  }

  state.undoStack.push(entry);
  return true;
}

export function canUndo(state: DocumentState): boolean {
  return state.undoStack.length > 0;
}

export function canRedo(state: DocumentState): boolean {
  return state.redoStack.length > 0;
}

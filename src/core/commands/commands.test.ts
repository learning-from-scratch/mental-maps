import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createDocument, getSheet } from '../model/factories';
import { validate } from '../model/validate';
import { addBoundary, addRelationship, addSummary } from '../test/helpers';
import {
  canRedo,
  canUndo,
  createDocumentState,
  executeCommand,
  redo,
  undo,
} from './undo';

function sheetId(state: ReturnType<typeof createDocumentState>) {
  return state.doc.sheets[0]!;
}

function topicCount(state: ReturnType<typeof createDocumentState>) {
  const sheet = getSheet(state.doc, sheetId(state));
  return Object.keys(sheet.topicsById).length;
}

describe('commands + undo', () => {
  it('adds child topics and maintains parent/child symmetry', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const childId = executeCommand(state, 'addChild', {
      parentId: rootId,
      text: 'Main Topic 1',
      side: 'right',
    });

    const updated = getSheet(state.doc, sheetId(state));
    expect(updated.topicsById[childId]?.text).toBe('Main Topic 1');
    expect(updated.topicsById[rootId]?.childrenIds).toEqual([childId]);
    expect(updated.topicsById[childId]?.parentId).toBe(rootId);
    expect(validate(state.doc)).toEqual([]);
  });

  it('adds siblings after the selected topic', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const firstId = executeCommand(state, 'addChild', {
      parentId: rootId,
      text: 'First',
    });
    const siblingId = executeCommand(state, 'addSibling', {
      topicId: firstId,
      text: 'Second',
    });

    const updated = getSheet(state.doc, sheetId(state));
    expect(updated.topicsById[rootId]?.childrenIds).toEqual([firstId, siblingId]);
    expect(updated.topicsById[siblingId]?.parentId).toBe(rootId);
  });

  it('undoes and redoes text edits', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    executeCommand(state, 'setText', { topicId: rootId, text: 'Updated Root' });
    expect(getSheet(state.doc, sheetId(state)).topicsById[rootId]?.text).toBe('Updated Root');

    expect(undo(state)).toBe(true);
    expect(getSheet(state.doc, sheetId(state)).topicsById[rootId]?.text).toBe('Central Topic');

    expect(redo(state)).toBe(true);
    expect(getSheet(state.doc, sheetId(state)).topicsById[rootId]?.text).toBe('Updated Root');
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);
  });
});

describe('deleteTopics cascade', () => {
  it('deletes a branch and all descendants', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const branchId = executeCommand(state, 'addChild', {
      parentId: rootId,
      text: 'Branch',
    });
    const childId = executeCommand(state, 'addChild', {
      parentId: branchId,
      text: 'Child',
    });
    const grandchildId = executeCommand(state, 'addChild', {
      parentId: childId,
      text: 'Grandchild',
    });

    expect(topicCount(state)).toBe(4);

    const deleted = executeCommand(state, 'deleteTopics', { topicIds: [branchId] });
    expect(deleted.sort()).toEqual([branchId, childId, grandchildId].sort());
    expect(topicCount(state)).toBe(1);
    expect(getSheet(state.doc, sheetId(state)).topicsById[rootId]?.childrenIds).toEqual([]);
    expect(validate(state.doc)).toEqual([]);
  });

  it('cleans up relationships when topics are deleted', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const a = executeCommand(state, 'addChild', { parentId: rootId, text: 'A' });
    const b = executeCommand(state, 'addChild', { parentId: rootId, text: 'B' });

    addRelationship(state, {
      id: 'rel-1',
      fromId: a,
      toId: b,
    });

    executeCommand(state, 'deleteTopics', { topicIds: [a] });

    expect(getSheet(state.doc, sheetId(state)).relationships).toEqual([]);
  });

  it('removes topic links that point at deleted topics', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const target = executeCommand(state, 'addChild', { parentId: rootId, text: 'Target' });
    const linker = executeCommand(state, 'addChild', { parentId: rootId, text: 'Linker' });

    produce(state.doc, (draft) => {
      const draftSheet = draft.sheetsById[sheetId(state)]!;
      draftSheet.topicsById[linker]!.topicLink = {
        targetSheetId: draftSheet.id,
        targetTopicId: target,
      };
    });

    executeCommand(state, 'deleteTopics', { topicIds: [target] });

    expect(getSheet(state.doc, sheetId(state)).topicsById[linker]?.topicLink).toBeUndefined();
  });

  it('rejects deleting the root topic', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));

    expect(() =>
      executeCommand(state, 'deleteTopics', { topicIds: [sheet.rootTopicId] }),
    ).toThrow(/Cannot delete root topic/);
  });
});

describe('moveBranch', () => {
  it('reparents a branch while preserving descendants', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const sourceParent = executeCommand(state, 'addChild', {
      parentId: rootId,
      text: 'Source Parent',
    });
    const moving = executeCommand(state, 'addChild', {
      parentId: sourceParent,
      text: 'Moving',
    });
    const child = executeCommand(state, 'addChild', {
      parentId: moving,
      text: 'Child',
    });
    const targetParent = executeCommand(state, 'addChild', {
      parentId: rootId,
      text: 'Target Parent',
    });

    executeCommand(state, 'moveBranch', {
      topicId: moving,
      newParentId: targetParent,
      index: 0,
    });

    const updated = getSheet(state.doc, sheetId(state));
    expect(updated.topicsById[sourceParent]?.childrenIds).toEqual([]);
    expect(updated.topicsById[targetParent]?.childrenIds).toEqual([moving]);
    expect(updated.topicsById[moving]?.parentId).toBe(targetParent);
    expect(updated.topicsById[child]?.parentId).toBe(moving);
    expect(validate(state.doc)).toEqual([]);
  });

  it('rejects moving a topic into its own descendant', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const parent = executeCommand(state, 'addChild', { parentId: rootId, text: 'Parent' });
    const child = executeCommand(state, 'addChild', { parentId: parent, text: 'Child' });
    const grandchild = executeCommand(state, 'addChild', {
      parentId: child,
      text: 'Grandchild',
    });

    expect(() =>
      executeCommand(state, 'moveBranch', {
        topicId: parent,
        newParentId: grandchild,
      }),
    ).toThrow(/own descendant/);

    expect(getSheet(state.doc, sheetId(state)).topicsById[parent]?.parentId).toBe(rootId);
  });

  it('rejects moving the root topic', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;
    const child = executeCommand(state, 'addChild', { parentId: rootId, text: 'Child' });

    expect(() =>
      executeCommand(state, 'moveBranch', {
        topicId: rootId,
        newParentId: child,
      }),
    ).toThrow(/Cannot move root topic/);
  });
});

describe('boundary and summary range repair', () => {
  it('repairs boundary ranges when a child is inserted before the range', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    executeCommand(state, 'addChild', { parentId: rootId, text: 'A' });
    const b = executeCommand(state, 'addChild', { parentId: rootId, text: 'B' });
    const c = executeCommand(state, 'addChild', { parentId: rootId, text: 'C' });

    addBoundary(state, {
      id: 'boundary-1',
      parentId: rootId,
      range: [1, 2],
    });

    executeCommand(state, 'addChild', {
      parentId: rootId,
      text: 'Inserted',
      index: 0,
    });

    const after = getSheet(state.doc, sheetId(state));
    expect(after.topicsById[rootId]?.childrenIds).toHaveLength(4);
    expect(after.boundaries[0]?.range).toEqual([2, 3]);
    expect(after.topicsById[b]?.parentId).toBe(rootId);
    expect(after.topicsById[c]?.parentId).toBe(rootId);
    expect(validate(state.doc)).toEqual([]);
  });

  it('removes a boundary when its range collapses to a single removed child', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const only = executeCommand(state, 'addChild', { parentId: rootId, text: 'Only' });
    addBoundary(state, {
      id: 'boundary-1',
      parentId: rootId,
      range: [0, 0],
    });
    addSummary(state, {
      id: 'summary-1',
      parentId: rootId,
      range: [0, 0],
      summaryTopicId: only,
    });

    executeCommand(state, 'deleteTopics', { topicIds: [only] });

    const after = getSheet(state.doc, sheetId(state));
    expect(after.boundaries).toEqual([]);
    expect(after.summaries).toEqual([]);
    expect(validate(state.doc)).toEqual([]);
  });
});

describe('floating topics', () => {
  it('detaches and attaches floating topics', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const branch = executeCommand(state, 'addChild', { parentId: rootId, text: 'Branch' });

    executeCommand(state, 'detachAsFloating', {
      topicId: branch,
      position: { x: 100, y: 200 },
    });

    let updated = getSheet(state.doc, sheetId(state));
    expect(updated.topicsById[rootId]?.childrenIds).toEqual([]);
    expect(updated.floatingTopicIds).toEqual([branch]);
    expect(updated.topicsById[branch]?.position).toEqual({ x: 100, y: 200 });

    executeCommand(state, 'attachFloating', {
      topicId: branch,
      parentId: rootId,
      index: 0,
    });

    updated = getSheet(state.doc, sheetId(state));
    expect(updated.floatingTopicIds).toEqual([]);
    expect(updated.topicsById[rootId]?.childrenIds).toEqual([branch]);
    expect(updated.topicsById[branch]?.position).toBeUndefined();
    expect(validate(state.doc)).toEqual([]);
  });
});

describe('duplicateBranch', () => {
  it('deep-clones a branch with new ids', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const branch = executeCommand(state, 'addChild', { parentId: rootId, text: 'Branch' });
    const originalChildId = executeCommand(state, 'addChild', {
      parentId: branch,
      text: 'Child',
    });

    const cloneId = executeCommand(state, 'duplicateBranch', { topicId: branch });
    const updated = getSheet(state.doc, sheetId(state));
    const clonedChildId = updated.topicsById[cloneId]?.childrenIds[0];

    expect(cloneId).not.toBe(branch);
    expect(updated.topicsById[rootId]?.childrenIds).toEqual([branch, cloneId]);
    expect(updated.topicsById[cloneId]?.text).toBe('Branch');
    expect(clonedChildId).toBeDefined();
    expect(clonedChildId).not.toBe(originalChildId);
    expect(validate(state.doc)).toEqual([]);
  });
});

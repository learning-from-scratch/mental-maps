import { describe, expect, it } from 'vitest';
import { boundariesFromSelection, filterSelectionRoots } from '@/core/model/boundaries';
import { createDocument, getSheet } from '@/core/model/factories';
import { createDocumentState, executeCommand } from '@/core/commands/undo';
import {
  computeBoundaryContentRect,
  computeBoundaryRect,
  findTopicIdAtPoint,
  paddingBottomFromHandleY,
  paddingTopFromHandleY,
  snapBoundaryFromVerticalBand,
  verticalOverlapFraction,
} from '@/layout/boundaryGeometry';
import type { NodeLayout } from '@/layout/types';

function sheetId(state: ReturnType<typeof createDocumentState>) {
  return state.doc.sheets[0]!;
}

function nodeLayout(x: number, y: number, width: number, height: number): NodeLayout {
  return {
    x,
    y,
    width,
    height,
    side: 'right',
    lines: ['Topic'],
    fontSize: 14,
    lineHeight: 18,
    depth: 1,
    branchIndex: 0,
  };
}

describe('boundariesFromSelection', () => {
  it('creates a boundary for a single selected branch', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const branch = executeCommand(state, 'addChild', { parentId: rootId, text: 'Branch' });
    executeCommand(state, 'addChild', { parentId: branch, text: 'Child' });

    const after = getSheet(state.doc, sheetId(state));
    const boundaries = boundariesFromSelection(after, [branch]);

    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]).toMatchObject({
      parentId: rootId,
      range: [0, 0],
      topicIds: [branch],
    });
  });

  it('merges contiguous sibling selections into one boundary', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const first = executeCommand(state, 'addChild', { parentId: rootId, text: 'A' });
    const second = executeCommand(state, 'addChild', { parentId: rootId, text: 'B' });
    executeCommand(state, 'addChild', { parentId: rootId, text: 'C' });

    const after = getSheet(state.doc, sheetId(state));
    const boundaries = boundariesFromSelection(after, [first, second]);

    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]?.range).toEqual([0, 1]);
    expect(boundaries[0]?.topicIds).toEqual([first, second]);
  });

  it('does not create a boundary when only the root is selected', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    executeCommand(state, 'addChild', { parentId: rootId, text: 'Branch' });
    const after = getSheet(state.doc, sheetId(state));
    const boundaries = boundariesFromSelection(after, [rootId]);

    expect(boundaries).toHaveLength(0);
    expect(filterSelectionRoots(after, [rootId])).toEqual([]);
  });

  it('uses topicIds for geometry so only selected branches are included', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const branch = executeCommand(state, 'addChild', { parentId: rootId, text: 'Branch' });
    const child = executeCommand(state, 'addChild', { parentId: branch, text: 'Child' });

    const after = getSheet(state.doc, sheetId(state));
    expect(filterSelectionRoots(after, [branch, child])).toEqual([branch]);
    expect(boundariesFromSelection(after, [branch, child])).toHaveLength(1);
  });
});

describe('boundaryGeometry', () => {
  it('computes content and padded display rects', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;
    const branch = executeCommand(state, 'addChild', { parentId: rootId, text: 'Branch' });
    const child = executeCommand(state, 'addChild', { parentId: branch, text: 'Child' });
    const after = getSheet(state.doc, sheetId(state));

    const nodes = new Map<string, NodeLayout>([
      [branch, nodeLayout(100, 50, 80, 30)],
      [child, nodeLayout(40, 120, 70, 28)],
    ]);

    const boundary = {
      id: 'boundary-1',
      parentId: rootId,
      range: [0, 0] as [number, number],
      topicIds: [branch],
      paddingTop: 10,
      paddingBottom: 20,
    };

    const content = computeBoundaryContentRect(nodes, after, boundary);
    const display = computeBoundaryRect(nodes, after, boundary);

    expect(content).toEqual({ x: 28, y: 50, width: 164, height: 98 });
    expect(display).toEqual({ x: 28, y: 40, width: 164, height: 128 });
    expect(paddingTopFromHandleY(50, 35)).toBe(15);
    expect(paddingBottomFromHandleY(148, 170)).toBe(22);
  });

  it('finds the smallest topic under a point', () => {
    const nodes = new Map<string, NodeLayout>([
      ['large', nodeLayout(0, 0, 200, 200)],
      ['small', nodeLayout(50, 50, 40, 40)],
    ]);

    expect(findTopicIdAtPoint(nodes, { x: 60, y: 60 })).toBe('small');
    expect(findTopicIdAtPoint(nodes, { x: 10, y: 10 })).toBe('large');
    expect(findTopicIdAtPoint(nodes, { x: 300, y: 300 })).toBeNull();
  });

  it('measures vertical overlap fraction for a node', () => {
    const node = nodeLayout(0, 100, 80, 40);
    expect(verticalOverlapFraction(node, 120, 140)).toBe(0.5);
    expect(verticalOverlapFraction(node, 110, 140)).toBeGreaterThan(0.5);
    expect(verticalOverlapFraction(node, 130, 150)).toBeLessThan(0.5);
  });

  it('snaps sibling topics into a boundary when more than half overlaps', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const first = executeCommand(state, 'addChild', { parentId: rootId, text: 'A' });
    const second = executeCommand(state, 'addChild', { parentId: rootId, text: 'B' });
    const third = executeCommand(state, 'addChild', { parentId: rootId, text: 'C' });
    const after = getSheet(state.doc, sheetId(state));

    const nodes = new Map<string, NodeLayout>([
      [first, nodeLayout(100, 100, 80, 40)],
      [second, nodeLayout(100, 160, 80, 40)],
      [third, nodeLayout(100, 220, 80, 40)],
    ]);

    const boundary = {
      id: 'boundary-1',
      parentId: rootId,
      range: [0, 0] as [number, number],
      topicIds: [first],
      paddingTop: 40,
      paddingBottom: 40,
    };

    const snapped = snapBoundaryFromVerticalBand(after, nodes, boundary, 80, 205);

    expect(snapped.topicIds).toEqual([first, second]);
    expect(snapped.range).toEqual([0, 1]);
    expect(snapped.paddingTop).toBe(12);
    expect(snapped.paddingBottom).toBe(12);
  });

  it('keeps the best-overlap sibling when the band excludes every node', () => {
    const state = createDocumentState(createDocument());
    const sheet = getSheet(state.doc, sheetId(state));
    const rootId = sheet.rootTopicId;

    const first = executeCommand(state, 'addChild', { parentId: rootId, text: 'A' });
    const second = executeCommand(state, 'addChild', { parentId: rootId, text: 'B' });
    const after = getSheet(state.doc, sheetId(state));

    const nodes = new Map<string, NodeLayout>([
      [first, nodeLayout(100, 100, 80, 40)],
      [second, nodeLayout(100, 160, 80, 40)],
    ]);

    const boundary = {
      id: 'boundary-1',
      parentId: rootId,
      range: [0, 1] as [number, number],
      topicIds: [first, second],
      paddingTop: 12,
      paddingBottom: 12,
    };

    const snapped = snapBoundaryFromVerticalBand(after, nodes, boundary, 150, 165);

    expect(snapped.topicIds).toEqual([second]);
    expect(snapped.range).toEqual([1, 1]);
  });
});

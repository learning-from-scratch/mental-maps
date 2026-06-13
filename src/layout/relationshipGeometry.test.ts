import { describe, expect, it } from 'vitest';
import type { NodeLayout } from './types';
import {
  anchorToPoint,
  bestNodeAnchor,
  confirmRelationshipGeometry,
  controlOffsetsForAnchors,
  draftRelationshipGeometry,
  edgeNormalAtAnchor,
  initialRelationshipGeometry,
  projectToNodePerimeter,
  relationshipCurveEntersNodeInterior,
  relationshipMidpoint,
  relationshipPath,
  resolveRelationshipGeometry,
  snapAnchorToDirectedSide,
  snapRelationshipAnchors,
} from './relationshipGeometry';

function makeNode(overrides: Partial<NodeLayout> = {}): NodeLayout {
  return {
    x: 100,
    y: 80,
    width: 120,
    height: 40,
    depth: 1,
    side: 'right',
    branchIndex: 0,
    lines: ['Topic'],
    fontSize: 16,
    lineHeight: 20,
    ...overrides,
  };
}

describe('relationshipGeometry', () => {
  it('projects a point to the nearest node perimeter anchor', () => {
    const node = makeNode();
    const anchor = projectToNodePerimeter(node, { x: 220, y: 100 });
    expect(anchor.x).toBeCloseTo(1, 2);
    expect(anchor.y).toBeCloseTo(0.5, 2);
  });

  it('snaps anchors to the facing edge centers', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 40, width: 100, height: 40 });

    expect(snapRelationshipAnchors(fromNode, toNode)).toEqual({
      fromAnchor: { x: 1, y: 0.5 },
      toAnchor: { x: 0, y: 0.5 },
      fromSide: 'right',
      toSide: 'left',
    });
    expect(bestNodeAnchor(fromNode, { x: 300, y: 20 })).toEqual({ x: 1, y: 0.5 });
    expect(bestNodeAnchor(toNode, { x: 0, y: 20 })).toEqual({ x: 0, y: 0.5 });
  });

  it('snaps directed anchors to the chosen side', () => {
    const node = makeNode({ x: 0, y: 0, width: 100, height: 40 });

    expect(snapAnchorToDirectedSide(node, { x: 50, y: 70 })).toEqual({
      side: 'bottom',
      anchor: { x: 0.5, y: 1 },
    });
    expect(snapAnchorToDirectedSide(node, { x: 50, y: -20 })).toEqual({
      side: 'top',
      anchor: { x: 0.5, y: 0 },
    });
    expect(snapAnchorToDirectedSide(node, { x: -20, y: 20 })).toEqual({
      side: 'left',
      anchor: { x: 0, y: 0.5 },
    });
    expect(snapAnchorToDirectedSide(node, { x: 140, y: 20 })).toEqual({
      side: 'right',
      anchor: { x: 1, y: 0.5 },
    });
  });

  it('uses cardinal edge normals for border anchors', () => {
    expect(edgeNormalAtAnchor({ x: 0.5, y: 1 })).toEqual({ x: 0, y: 1 });
    expect(edgeNormalAtAnchor({ x: 0.5, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(edgeNormalAtAnchor({ x: 0, y: 0.5 })).toEqual({ x: -1, y: 0 });
    expect(edgeNormalAtAnchor({ x: 1, y: 0.5 })).toEqual({ x: 1, y: 0 });
    expect(edgeNormalAtAnchor({ x: 0.2, y: 1 })).toEqual({ x: 0, y: 1 });
  });

  it('builds a cubic path between two nodes', () => {
    const fromNode = makeNode({ x: 0, y: 0 });
    const toNode = makeNode({ x: 220, y: 40 });
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b' },
      fromNode,
      toNode,
    );

    expect(relationshipPath(geometry)).toMatch(/^M .* C .*, .*$/);
    expect(geometry.from.x).toBe(fromNode.x + fromNode.width);
    expect(geometry.to.x).toBe(toNode.x);
  });

  it('does not pass through destination interior for horizontal links', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 40, width: 100, height: 40 });
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b' },
      fromNode,
      toNode,
    );

    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
    expect(geometry.control2.x).toBeLessThan(toNode.x);
  });

  it('honors a locked destination side when routing', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 40, y: 120, width: 100, height: 40 });
    const geometry = resolveRelationshipGeometry(
      {
        id: 'r1',
        fromId: 'a',
        toId: 'b',
        toSide: 'top',
        toAnchor: { x: 0.5, y: 0 },
      },
      fromNode,
      toNode,
    );

    expect(geometry.toAnchor).toEqual({ x: 0.5, y: 0 });
    expect(geometry.to.y).toBe(toNode.y);
    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
  });

  it('prefers curves over straight horizontal lines', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 0, width: 100, height: 40 });
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b' },
      fromNode,
      toNode,
    );
    const lineY = (geometry.from.y + geometry.to.y) / 2;

    expect(Math.abs(geometry.control1.y - lineY)).toBeGreaterThan(8);
    expect(Math.abs(geometry.control2.y - lineY)).toBeGreaterThan(8);
    expect(geometry.control1.y).toBeGreaterThan(lineY);
    expect(geometry.control2.y).toBeLessThan(lineY);
  });

  it('does not pass through destination interior for vertical links', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 0, y: 120, width: 100, height: 40 });
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b' },
      fromNode,
      toNode,
    );

    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
  });

  it('does not pass through destination interior for diagonal links', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 150, y: 90, width: 100, height: 40 });
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b' },
      fromNode,
      toNode,
    );

    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
  });

  it('refines stored control offsets that would enter the destination interior', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 40, width: 100, height: 40 });
    const geometry = resolveRelationshipGeometry(
      {
        id: 'r1',
        fromId: 'a',
        toId: 'b',
        fromAnchor: { x: 1, y: 0.5 },
        toAnchor: { x: 0, y: 0.5 },
        fromSide: 'right',
        toSide: 'left',
        controlOffsets: [
          { x: 20, y: 0 },
          { x: 80, y: 0 },
        ],
      },
      fromNode,
      toNode,
    );

    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
    expect(geometry.control2.x).toBeLessThan(toNode.x);
  });

  it('keeps valid stored control offsets', () => {
    const fromNode = makeNode({ x: 0, y: 0 });
    const toNode = makeNode({ x: 200, y: 0 });
    const geometry = resolveRelationshipGeometry(
      {
        id: 'r1',
        fromId: 'a',
        toId: 'b',
        fromAnchor: { x: 0.5, y: 1 },
        toAnchor: { x: 0.5, y: 1 },
        fromSide: 'bottom',
        toSide: 'bottom',
        controlOffsets: [
          { x: 0, y: 60 },
          { x: 0, y: 60 },
        ],
      },
      fromNode,
      toNode,
    );

    expect(geometry.from).toEqual(anchorToPoint(fromNode, { x: 0.5, y: 1 }));
    expect(geometry.to).toEqual(anchorToPoint(toNode, { x: 0.5, y: 1 }));
    expect(geometry.control1.y).toBe(geometry.from.y + 60);
    expect(geometry.control2.y).toBe(geometry.to.y + 60);
    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
  });

  it('initializes geometry from destination position', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 40, width: 100, height: 40 });
    const initial = initialRelationshipGeometry(fromNode, toNode);
    const from = anchorToPoint(fromNode, initial.fromAnchor);
    const to = anchorToPoint(toNode, initial.toAnchor);
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b', ...initial },
      fromNode,
      toNode,
    );

    expect(initial.fromAnchor).toEqual({ x: 1, y: 0.5 });
    expect(initial.toAnchor).toEqual({ x: 0, y: 0.5 });
    expect(initial.fromSide).toBe('right');
    expect(initial.toSide).toBe('left');
    expect(initial.controlOffsets).toEqual(
      controlOffsetsForAnchors(from, to, initial.fromAnchor, initial.toAnchor),
    );
    expect(relationshipCurveEntersNodeInterior(toNode, geometry)).toBe(false);
  });

  it('creates draft geometry toward the cursor', () => {
    const fromNode = makeNode();
    const draft = draftRelationshipGeometry(fromNode, { x: 320, y: 180 });

    expect(draft.to).toEqual({ x: 320, y: 180 });
    expect(relationshipPath(draft)).toContain('C');
    expect(relationshipMidpoint(draft).x).toBeGreaterThan(fromNode.x);
  });

  it('snaps draft geometry to a hovered destination side without entering it', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 40, width: 100, height: 40 });
    const draft = draftRelationshipGeometry(fromNode, { x: 270, y: 90 }, toNode);

    expect(draft.toAnchor).toEqual({ x: 0.5, y: 1 });
    expect(draft.to.y).toBe(toNode.y + toNode.height);
    expect(relationshipCurveEntersNodeInterior(toNode, draft)).toBe(false);
  });

  it('persists the drafted preview path when confirming', () => {
    const fromNode = makeNode({ x: 0, y: 0, width: 100, height: 40 });
    const toNode = makeNode({ x: 220, y: 40, width: 100, height: 40 });
    const cursor = { x: 270, y: 90 };
    const draft = draftRelationshipGeometry(fromNode, cursor, toNode);
    const confirmed = confirmRelationshipGeometry(fromNode, toNode, cursor);
    const resolved = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b', ...confirmed },
      fromNode,
      toNode,
    );

    expect(confirmed.toSide).toBe('bottom');
    expect(resolved.toAnchor).toEqual(draft.toAnchor);
    expect(resolved.control1.x).toBeCloseTo(draft.control1.x, 4);
    expect(resolved.control1.y).toBeCloseTo(draft.control1.y, 4);
    expect(resolved.control2.x).toBeCloseTo(draft.control2.x, 4);
    expect(resolved.control2.y).toBeCloseTo(draft.control2.y, 4);
  });
});

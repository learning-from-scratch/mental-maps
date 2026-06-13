import { describe, expect, it } from 'vitest';
import type { NodeLayout } from './types';
import {
  anchorToPoint,
  draftRelationshipGeometry,
  projectToNodePerimeter,
  relationshipMidpoint,
  relationshipPath,
  resolveRelationshipGeometry,
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

  it('builds a cubic path between two nodes', () => {
    const fromNode = makeNode({ x: 0, y: 0 });
    const toNode = makeNode({ x: 220, y: 40 });
    const geometry = resolveRelationshipGeometry(
      { id: 'r1', fromId: 'a', toId: 'b' },
      fromNode,
      toNode,
    );

    expect(relationshipPath(geometry)).toMatch(/^M .* C .*, .*$/);
    expect(geometry.from.x).toBeGreaterThanOrEqual(fromNode.x);
    expect(geometry.to.x).toBeLessThanOrEqual(toNode.x + toNode.width);
  });

  it('uses stored anchors and control offsets when provided', () => {
    const fromNode = makeNode({ x: 0, y: 0 });
    const toNode = makeNode({ x: 200, y: 0 });
    const geometry = resolveRelationshipGeometry(
      {
        id: 'r1',
        fromId: 'a',
        toId: 'b',
        fromAnchor: { x: 0.5, y: 1 },
        toAnchor: { x: 0.5, y: 1 },
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
  });

  it('creates draft geometry toward the cursor', () => {
    const fromNode = makeNode();
    const draft = draftRelationshipGeometry(fromNode, { x: 320, y: 180 });

    expect(draft.to).toEqual({ x: 320, y: 180 });
    expect(relationshipPath(draft)).toContain('C');
    expect(relationshipMidpoint(draft).x).toBeGreaterThan(fromNode.x);
  });
});

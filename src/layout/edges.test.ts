import { describe, expect, it } from 'vitest';
import { createSampleDocument } from '@/demo/sampleDocument';
import { createTopic } from '@/core/model/factories';
import { bracketEdges, edgePath, rootEdgePath } from './edges';
import { layoutMindmap } from './mindmap';
import type { NodeLayout } from './types';

describe('edge anchoring', () => {
  it('roots connect to left branches from the left edge', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const leftBranch = result.nodes.get('b4')!;

    expect(leftBranch.x + leftBranch.width).toBeLessThan(root.x + root.width / 2);

    const path = edgePath(root, leftBranch);
    expect(path.startsWith(`M ${root.x} `)).toBe(true);
  });

  it('roots connect to right branches from the right edge', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const rightBranch = result.nodes.get('b2')!;

    expect(rightBranch.x).toBeGreaterThan(root.x + root.width / 2);

    const path = edgePath(root, rightBranch);
    expect(path).toContain(`${root.x + root.width} `);
  });

  it('left-branch brackets exit the parent left edge toward children', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const parent = result.nodes.get('b4')!;
    const children = sheet.topicsById['b4']!.childrenIds
      .map((id) => result.nodes.get(id)!)
      .filter(Boolean);

    expect(children.length).toBeGreaterThan(1);
    for (const child of children) {
      expect(child.x + child.width).toBeLessThanOrEqual(parent.x);
    }

    const edges = bracketEdges('b4', parent, children, parent.branchIndex);
    const stem = edges.find((edge) => edge.id.includes('stem'))!;
    expect(stem.path).toMatch(new RegExp(`M ${parent.x} `));
  });

  it('expanded branch child connectors use a trunk with rounded fillets', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const parent = result.nodes.get('b2')!;
    const children = sheet.topicsById['b2']!.childrenIds
      .map((id) => result.nodes.get(id)!)
      .filter(Boolean);

    const edges = bracketEdges('b2', parent, children, parent.branchIndex);
    const childEdges = edges.filter(
      (edge) => edge.id.startsWith('bracket-b2-') && !edge.id.includes('stem'),
    );
    const trunk = edges.find((edge) => edge.id.includes('trunk'))!;

    expect(trunk.path).toMatch(/^M [\d.-]+ [\d.-]+ V [\d.-]+$/);
    expect(childEdges.some((edge) => edge.path.includes(' Q '))).toBe(true);
    expect(childEdges.some((edge) => edge.path.includes(' H '))).toBe(true);

    const trunkStartY = Number(trunk.path.match(/^M [\d.-]+ ([\d.-]+) V/)?.[1]);
    const trunkEndY = Number(trunk.path.match(/ V ([\d.-]+)$/)?.[1]);
    const childYs = children.map((child) => child.y + child.height / 2);
    expect(trunkStartY).toBeGreaterThan(Math.min(...childYs));
    expect(trunkEndY).toBeLessThan(Math.max(...childYs));
  });

  it('root edges curve smoothly into upper and lower branches', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const topRight = result.nodes.get('b1')!;
    const path = rootEdgePath(root, topRight);

    expect(path).toContain(' C ');
    expect(path).not.toContain(' Q ');
    expect(path.startsWith('M ')).toBe(true);
  });

  it('root edges are straight when a branch aligns with the center', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const rootMidY = root.y + root.height / 2;

    const aligned = [...result.nodes.values()].find(
      (node) =>
        node.depth === 1 &&
        Math.abs(node.y + node.height / 2 - rootMidY) < 3,
    );

    if (!aligned) return;

    const path = rootEdgePath(root, aligned);
    expect(path).not.toContain(' C ');
    expect(path).toContain(' L ');
  });

  it('root edges use separate top, middle, and bottom exit heights per side', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const rightRootEdges = result.edges.filter(
      (edge) =>
        edge.id.startsWith('edge-root-') &&
        Number(edge.path.match(/^M ([-\d.]+) /)?.[1]) > root.x + root.width / 2,
    );

    const startYs = rightRootEdges
      .map((edge) => Number(edge.path.match(/^M [-\d.]+ ([-\d.]+)/)?.[1]))
      .sort((a, b) => a - b);

    expect(new Set(startYs).size).toBeGreaterThan(1);
    expect(startYs[0]).toBeLessThan(root.y + root.height / 2);
    expect(startYs.at(-1)).toBeGreaterThan(root.y + root.height / 2);
  });

  it('root edge anchors move to the top and bottom of the central topic when needed', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const topRight = result.nodes.get('b1')!;
    const middleRight = result.nodes.get('b2')!;
    const bottomRight = result.nodes.get('b3')!;

    const topPath = rootEdgePath(
      root,
      topRight,
      { x: root.x + root.width * 0.75, y: root.y },
      { side: 'right', rank: -1, normalizedRank: 1 },
    );
    const middlePath = rootEdgePath(root, middleRight, {
      x: root.x + root.width,
      y: root.y + root.height / 2,
    });
    const bottomPath = rootEdgePath(
      root,
      bottomRight,
      {
        x: root.x + root.width * 0.75,
        y: root.y + root.height,
      },
      { side: 'right', rank: 1, normalizedRank: 1 },
    );

    const start = (path: string) => {
      const match = path.match(/^M ([-\d.]+) ([-\d.]+)/);
      return {
        x: Number(match?.[1]),
        y: Number(match?.[2]),
      };
    };

    expect(start(middlePath).x).toBeCloseTo(root.x + root.width);
    expect(start(middlePath).y).toBeCloseTo(root.y + root.height / 2);
    expect(start(topPath).y).toBeCloseTo(root.y);
    expect(start(bottomPath).y).toBeCloseTo(root.y + root.height);
    expect(start(topPath).x).toBeGreaterThan(root.x + root.width / 2);
    expect(start(bottomPath).x).toBeGreaterThan(root.x + root.width / 2);

    const control = (path: string) => {
      const match = path.match(/ C ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+),/);
      return {
        x: Number(match?.[1]),
        y: Number(match?.[2]),
        x2: Number(match?.[3]),
        y2: Number(match?.[4]),
      };
    };

    expect(control(topPath).x).toBeGreaterThan(start(topPath).x);
    expect(control(bottomPath).x).toBeGreaterThan(start(bottomPath).x);
    expect(control(topPath).y).toBeLessThan(start(topPath).y);
    expect(control(bottomPath).y).toBeGreaterThan(start(bottomPath).y);
  });

  it('keeps root Bezier handles constrained away from the title corridor', () => {
    const root: NodeLayout = {
      x: -210,
      y: 100,
      width: 420,
      height: 88,
      side: 'center',
      lines: ['Clustering and', 'Distance Metrics'],
      fontSize: 34,
      lineHeight: 44,
      depth: 0,
      branchIndex: -1,
    };
    const topRight: NodeLayout = {
      x: 420,
      y: 0,
      width: 260,
      height: 54,
      side: 'right',
      lines: ['Top'],
      fontSize: 24,
      lineHeight: 30,
      depth: 1,
      branchIndex: 0,
    };
    const middleRight: NodeLayout = {
      ...topRight,
      y: 130,
      lines: ['Middle'],
    };
    const bottomRight: NodeLayout = {
      ...topRight,
      y: 300,
      lines: ['Bottom'],
    };
    const controls = (path: string) => {
      const match = path.match(/^M ([-\d.]+) ([-\d.]+) C ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+),/);
      return {
        start: { x: Number(match?.[1]), y: Number(match?.[2]) },
        c1: { x: Number(match?.[3]), y: Number(match?.[4]) },
      };
    };

    const top = controls(rootEdgePath(root, topRight, { x: -20, y: root.y }, {
      side: 'right',
      rank: -1,
      normalizedRank: 1,
    }));
    const middle = controls(rootEdgePath(root, middleRight, {
      x: root.x + root.width,
      y: root.y + root.height / 2,
    }, { side: 'right', rank: 0, normalizedRank: 0 }));
    const bottom = controls(rootEdgePath(root, bottomRight, {
      x: -20,
      y: root.y + root.height,
    }, { side: 'right', rank: 1, normalizedRank: 1 }));

    expect(top.c1.y).toBeLessThan(top.start.y);
    expect(top.c1.x).toBeGreaterThan(top.start.x);
    expect(middle.c1.y).toBeCloseTo(middle.start.y);
    expect(bottom.c1.y).toBeGreaterThan(bottom.start.y);
    expect(bottom.c1.x).toBeGreaterThan(bottom.start.x);
  });

  it('supports ordered root perimeter anchors by zone', () => {
    const root: NodeLayout = {
      x: -210,
      y: 260,
      width: 420,
      height: 88,
      side: 'center',
      lines: ['Clustering and', 'Distance Metrics'],
      fontSize: 34,
      lineHeight: 44,
      depth: 0,
      branchIndex: -1,
    };
    const makeChild = (y: number): NodeLayout => ({
      x: 420,
      y,
      width: 220,
      height: 54,
      side: 'right',
      lines: ['Topic'],
      fontSize: 21,
      lineHeight: 28,
      depth: 1,
      branchIndex: 0,
    });
    const start = (path: string) => {
      const match = path.match(/^M ([-\d.]+) ([-\d.]+)/);
      return {
        x: Number(match?.[1]),
        y: Number(match?.[2]),
      };
    };

    const slotGap = root.width / 4;
    const anchors = [1, 2, 3].map((slot) => ({
      x: root.x + root.width - slotGap * slot * 0.45,
      y: root.y,
    }));
    const upperStarts = [makeChild(-220), makeChild(-80), makeChild(40)].map((child, index) =>
      start(rootEdgePath(root, child, anchors[index])),
    );
    const lowerAnchors = anchors.map((anchor) => ({ ...anchor, y: root.y + root.height }));
    const lowerStarts = [makeChild(540), makeChild(660), makeChild(820)].map((child, index) =>
      start(rootEdgePath(root, child, lowerAnchors[index])),
    );

    expect(upperStarts.every((point) => point.y === root.y)).toBe(true);
    expect(lowerStarts.every((point) => point.y === root.y + root.height)).toBe(true);
    expect(upperStarts[0]!.x).toBeGreaterThan(upperStarts[1]!.x);
    expect(upperStarts[1]!.x).toBeGreaterThan(upperStarts[2]!.x);
    expect(lowerStarts[0]!.x).toBeGreaterThan(lowerStarts[1]!.x);
    expect(lowerStarts[1]!.x).toBeGreaterThan(lowerStarts[2]!.x);
  });

  it('top and bottom root curves do not pass through the central topic box', () => {
    const root: NodeLayout = {
      x: -210,
      y: 100,
      width: 420,
      height: 88,
      side: 'center',
      lines: ['Clustering and', 'Distance Metrics'],
      fontSize: 34,
      lineHeight: 44,
      depth: 0,
      branchIndex: -1,
    };
    const topRight: NodeLayout = {
      x: 420,
      y: 0,
      width: 260,
      height: 54,
      side: 'right',
      lines: ['Top'],
      fontSize: 24,
      lineHeight: 30,
      depth: 1,
      branchIndex: 0,
    };
    const bottomRight: NodeLayout = {
      ...topRight,
      y: 300,
      lines: ['Bottom'],
      branchIndex: 1,
    };

    const curvePoints = (path: string) => {
      const match = path.match(/^M ([-\d.]+) ([-\d.]+) C ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+)/);
      const start = { x: Number(match?.[1]), y: Number(match?.[2]) };
      const cp1 = { x: Number(match?.[3]), y: Number(match?.[4]) };
      const cp2 = { x: Number(match?.[5]), y: Number(match?.[6]) };
      const end = { x: Number(match?.[7]), y: Number(match?.[8]) };

      return Array.from({ length: 10 }, (_, index) => {
        const t = (index + 1) / 10;
        const inv = 1 - t;
        return {
          x:
            inv * inv * inv * start.x +
            3 * inv * inv * t * cp1.x +
            3 * inv * t * t * cp2.x +
            t * t * t * end.x,
          y:
            inv * inv * inv * start.y +
            3 * inv * inv * t * cp1.y +
            3 * inv * t * t * cp2.y +
            t * t * t * end.y,
        };
      });
    };

    const insideRootBox = (point: { x: number; y: number }) =>
      point.x > root.x &&
      point.x < root.x + root.width &&
      point.y > root.y &&
      point.y < root.y + root.height;

    expect(
      curvePoints(rootEdgePath(root, topRight, { x: root.x + root.width * 0.75, y: root.y }))
        .some(insideRootBox),
    ).toBe(false);
    expect(
      curvePoints(rootEdgePath(root, bottomRight, {
        x: root.x + root.width * 0.75,
        y: root.y + root.height,
      })).some(insideRootBox),
    ).toBe(false);
  });

  it('root edges remain smooth curves without elbow commands when more main topics are added', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const root = sheet.topicsById[sheet.rootTopicId]!;
    const extraTopics = [
      createTopic({ id: 'extra-left-1', text: 'Main Topic 7', side: 'left' }),
      createTopic({ id: 'extra-left-2', text: 'Main Topic 11', side: 'left' }),
      createTopic({ id: 'extra-right-1', text: 'Main Topic 8', side: 'right' }),
      createTopic({ id: 'extra-right-2', text: 'Main Topic 10', side: 'right' }),
    ];

    for (const topic of extraTopics) {
      topic.parentId = root.id;
      sheet.topicsById[topic.id] = topic;
      root.childrenIds.push(topic.id);
    }

    const result = layoutMindmap(sheet);
    const rootEdges = result.edges.filter((edge) => edge.id.startsWith('edge-root-'));

    expect(rootEdges.length).toBe(root.childrenIds.length);
    for (const edge of rootEdges) {
      expect(edge.path).not.toContain(' H ');
      expect(edge.path).not.toContain(' V ');
      if (!edge.path.includes(' L ')) {
        expect(edge.path.includes(' C ') || edge.path.includes(' A ')).toBe(true);
        expect(edge.path).not.toContain(' Q ');
      }
    }
  });

  it('right-branch brackets exit the parent right edge toward children', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const parent = result.nodes.get('b2')!;
    const children = sheet.topicsById['b2']!.childrenIds
      .map((id) => result.nodes.get(id)!)
      .filter(Boolean);

    for (const child of children) {
      expect(child.x).toBeGreaterThan(parent.x + parent.width);
    }

    const edges = bracketEdges('b2', parent, children, parent.branchIndex);
    const stem = edges.find((edge) => edge.id.includes('stem'))!;
    expect(stem.path).toMatch(new RegExp(`M ${parent.x + parent.width} `));
  });
});

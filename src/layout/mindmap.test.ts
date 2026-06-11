import { describe, expect, it } from 'vitest';
import { createSampleDocument } from '@/demo/sampleDocument';
import { createTopic } from '@/core/model/factories';
import { edgePath } from './edges';
import { layoutMindmap } from './mindmap';
import { MAX_TOPIC_WIDTH, ROOT_MAX_TOPIC_WIDTH, measureTopic } from './measure';
import { branchColorForIndex } from './theme';

describe('layout engine', () => {
  it('wraps the central topic within the root max width', () => {
    const measurement = measureTopic('Clustering and Distance Metrics', 0);

    expect(measurement.lines[0]).toBe('Clustering and');
    expect(measurement.lines[1]).toBe('Distance Metrics');
    expect(measurement.width).toBeLessThanOrEqual(ROOT_MAX_TOPIC_WIDTH);
  });

  it('measures wrapped topic text', () => {
    const measurement = measureTopic(
      'A very long topic label that should wrap onto multiple lines for layout',
      2,
    );

    expect(measurement.lines.length).toBeGreaterThan(1);
    expect(measurement.width).toBeLessThanOrEqual(MAX_TOPIC_WIDTH);
    expect(measurement.height).toBeGreaterThan(measurement.lineHeight);
  });

  it('lays out the clustering document with left and right branches', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    expect(result.nodes.size).toBeGreaterThan(30);
    expect(result.edges.length).toBeGreaterThan(0);

    const root = result.nodes.get('root')!;
    const distance = result.nodes.get('b2')!;
    const evalMetrics = result.nodes.get('b4')!;

    expect(root.side).toBe('center');
    expect(distance.side).toBe('right');
    expect(evalMetrics.side).toBe('left');
    expect(distance.x).toBeGreaterThan(root.x + root.width);
    expect(evalMetrics.x + evalMetrics.width).toBeLessThan(root.x);
    expect(distance.branchIndex).toBeGreaterThanOrEqual(0);
  });

  it('places left-branch children to the left of their parent', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    for (const branchId of ['b4', 'b5', 'b6']) {
      const parent = result.nodes.get(branchId)!;
      for (const childId of sheet.topicsById[branchId]!.childrenIds) {
        const child = result.nodes.get(childId)!;
        expect(child.x + child.width).toBeLessThanOrEqual(parent.x);
      }
    }
  });

  it('places right-branch children to the right of their parent', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    for (const branchId of ['b1', 'b2', 'b3']) {
      const parent = result.nodes.get(branchId)!;
      for (const childId of sheet.topicsById[branchId]!.childrenIds) {
        const child = result.nodes.get(childId)!;
        expect(child.x).toBeGreaterThanOrEqual(parent.x + parent.width);
      }
    }
  });

  it('assigns branch colors to edges', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const colored = result.edges.filter((edge) => edge.color !== '#b8bcc4');
    expect(colored.length).toBeGreaterThan(0);
  });

  it('keeps branch colors unique within each side as branches are added', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const root = sheet.topicsById[sheet.rootTopicId]!;

    const inserted = createTopic({
      id: 'inserted-root-child',
      text: 'Inserted',
      parentId: root.id,
      side: 'right',
    });
    sheet.topicsById[inserted.id] = inserted;
    root.childrenIds.splice(1, 0, inserted.id);

    const result = layoutMindmap(sheet);
    const rootCenterX = result.nodes.get('root')!.x + result.nodes.get('root')!.width / 2;

    const level1 = [...result.nodes.values()].filter((node) => node.depth === 1);
    const rightIndices = level1
      .filter((node) => node.x + node.width / 2 > rootCenterX)
      .map((node) => node.branchIndex);
    const leftIndices = level1
      .filter((node) => node.x + node.width / 2 < rootCenterX)
      .map((node) => node.branchIndex);

    expect(new Set(rightIndices).size).toBe(rightIndices.length);
    expect(new Set(leftIndices).size).toBe(leftIndices.length);
    // Right and left groups also avoid sharing colors while the palette lasts.
    expect(new Set([...rightIndices, ...leftIndices]).size).toBe(
      rightIndices.length + leftIndices.length,
    );
  });

  it('uses stable unique edge ids for root topics in the same column', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const root = sheet.topicsById[sheet.rootTopicId]!;

    for (let index = 0; index < 12; index += 1) {
      const topic = createTopic({
        id: `extra-right-${index}`,
        text: `Main Topic ${index + 7}`,
        parentId: root.id,
        side: 'right',
        style: { branchColor: branchColorForIndex(root.childrenIds.length + index) },
      });
      sheet.topicsById[topic.id] = topic;
      root.childrenIds.push(topic.id);
    }

    const result = layoutMindmap(sheet);
    const rootEdges = result.edges.filter((edge) => edge.id.startsWith(`edge-${root.id}-`));
    const rootEdgeIds = rootEdges.map((edge) => edge.id);

    expect(rootEdges).toHaveLength(root.childrenIds.length);
    expect(new Set(rootEdgeIds).size).toBe(rootEdgeIds.length);
  });

  it('keeps crowded root connector sources hidden under the central topic box', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;

    for (let index = 0; index < 12; index += 1) {
      const topic = createTopic({
        id: `zone-right-${index}`,
        text: `Main Topic ${index + 10}`,
        parentId: rootTopic.id,
        side: 'right',
        style: { branchColor: branchColorForIndex(rootTopic.childrenIds.length + index) },
      });
      sheet.topicsById[topic.id] = topic;
      rootTopic.childrenIds.push(topic.id);
    }

    const result = layoutMindmap(sheet);
    const root = result.nodes.get(sheet.rootTopicId)!;
    const rootEdges = result.edges.filter((edge) => edge.fromId === sheet.rootTopicId);
    const starts = rootEdges.map((edge) => {
      const match = edge.path.match(/^M ([-\d.]+) ([-\d.]+)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    });
    const compactRootWidth = Math.min(root.width * 0.68, 300);
    const compactRight = root.x + root.width / 2 + compactRootWidth / 2;
    const rootCenterY = root.y + root.height / 2;

    expect(starts.some((point) => point.y < rootCenterY)).toBe(true);
    expect(
      starts.some(
        (point) =>
          Math.abs(point.x - compactRight) < 0.001 &&
          Math.abs(point.y - rootCenterY) < 0.001,
      ),
    ).toBe(true);
    expect(starts.some((point) => point.y > rootCenterY)).toBe(true);

    // Every source anchor is tucked under the central topic box so the root
    // exclusion mask hides the start of the curve.
    for (const point of starts) {
      expect(point.x).toBeGreaterThanOrEqual(root.x);
      expect(point.x).toBeLessThanOrEqual(root.x + root.width);
      expect(point.y).toBeGreaterThanOrEqual(root.y);
      expect(point.y).toBeLessThanOrEqual(root.y + root.height);
    }
  });

  it('tucks sparse root connector sources under the central topic', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);
    const root = result.nodes.get(sheet.rootTopicId)!;
    const rootCenterX = root.x + root.width / 2;
    const rootCenterY = root.y + root.height / 2;
    const compactRootWidth = Math.min(root.width * 0.68, 300);
    const compactRight = root.x + root.width / 2 + compactRootWidth / 2;
    const startPoint = (path: string) => {
      const match = path.match(/^M ([-\d.]+) ([-\d.]+)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    };
    const rightEdges = result.edges
      .filter((edge) => {
        const target = edge.toId ? result.nodes.get(edge.toId) : null;
        return edge.fromId === sheet.rootTopicId && target && target.x > rootCenterX;
      })
      .map((edge) => ({
        start: startPoint(edge.path),
        path: edge.path,
      }))
      .sort((a, b) => a.start.y - b.start.y);
    const rightStarts = rightEdges.map((edge) => edge.start);

    expect(rightStarts).toHaveLength(3);
    expect(rightStarts[0]!.y).toBeLessThan(rootCenterY);
    expect(rightStarts[1]!.y).toBeCloseTo(rootCenterY);
    expect(rightStarts[2]!.y).toBeGreaterThan(rootCenterY);
    // Outer sources tuck under the root box (between its center and right edge).
    expect(rightStarts[0]!.x).toBeGreaterThan(rootCenterX);
    expect(rightStarts[0]!.x).toBeLessThanOrEqual(compactRight);
    expect(rightStarts[2]!.x).toBeGreaterThan(rootCenterX);
    expect(rightStarts[2]!.x).toBeLessThanOrEqual(compactRight);
    expect(rightEdges[0]!.path).toContain(' C ');
    expect(rightEdges[2]!.path).toContain(' C ');
    expect(rightEdges[0]!.path).not.toContain(' H ');
    expect(rightEdges[2]!.path).not.toContain(' V ');
  });

  it('nests top and bottom root connectors from outermost branches inward', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;

    for (let index = 0; index < 14; index += 1) {
      const topic = createTopic({
        id: `nested-right-${index}`,
        text: `Main Topic ${index + 20}`,
        parentId: rootTopic.id,
        side: 'right',
        style: { branchColor: branchColorForIndex(rootTopic.childrenIds.length + index) },
      });
      sheet.topicsById[topic.id] = topic;
      rootTopic.childrenIds.push(topic.id);
    }

    const result = layoutMindmap(sheet);
    const root = result.nodes.get(sheet.rootTopicId)!;
    const rootCenterX = root.x + root.width / 2;
    const startPoint = (path: string) => {
      const match = path.match(/^M ([-\d.]+) ([-\d.]+)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    };
    const rightRootEdges = result.edges
      .filter((edge) => {
        const target = edge.toId ? result.nodes.get(edge.toId) : null;
        return edge.fromId === sheet.rootTopicId && target && target.x > rootCenterX;
      })
      .map((edge) => ({
        target: result.nodes.get(edge.toId!)!,
        start: startPoint(edge.path),
        path: edge.path,
      }));

    const sorted = rightRootEdges.sort(
      (a, b) => a.target.y + a.target.height / 2 - (b.target.y + b.target.height / 2),
    );

    expect(sorted.length).toBeGreaterThan(3);

    // Sources tuck progressively further under the root box as branches move
    // away from the middle of the side group: x shrinks toward the ends and
    // grows back toward the middle.
    const middleIndex = (sorted.length - 1) / 2;
    const tolerance = 0.1;
    for (let index = 1; index < sorted.length; index += 1) {
      const previousDistance = Math.abs(index - 1 - middleIndex);
      const distance = Math.abs(index - middleIndex);
      if (distance > previousDistance) {
        expect(sorted[index]!.start.x).toBeLessThanOrEqual(
          sorted[index - 1]!.start.x + tolerance,
        );
      } else {
        expect(sorted[index]!.start.x).toBeGreaterThanOrEqual(
          sorted[index - 1]!.start.x - tolerance,
        );
      }
    }

    expect(sorted[0]!.path).toContain(' C ');
    expect(sorted.at(-1)!.path).toContain(' C ');
    expect(sorted[0]!.path).not.toContain(' H ');
    expect(sorted.at(-1)!.path).not.toContain(' V ');
  });

  it('skips collapsed subtrees', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    sheet.topicsById['b2']!.collapsed = true;

    const result = layoutMindmap(sheet);

    expect(result.nodes.has('d-0')).toBe(false);
    expect(result.edges.some((edge) => edge.fromId === 'b2')).toBe(false);
  });

  it('produces bezier edge paths from root to main topics', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    const root = result.nodes.get('root')!;
    const branch = result.nodes.get('b2')!;
    const path = edgePath(root, branch);

    expect(path.startsWith('M ')).toBe(true);
    expect(path).toContain('C ');
  });

  it('uses bracket connectors from level-2 onwards', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    sheet.topicsById['b2']!.collapsed = false;

    const grandchild = createTopic({ id: 'gc-1', text: 'Nested detail', parentId: 'd-0' });
    sheet.topicsById['gc-1'] = grandchild;
    sheet.topicsById['d-0']!.childrenIds.push('gc-1');

    const result = layoutMindmap(sheet);

    const level2Bracket = result.edges.filter((edge) => edge.id.startsWith('bracket-b2-'));
    expect(level2Bracket.length).toBeGreaterThan(0);
    expect(level2Bracket.some((edge) => edge.id.includes('trunk'))).toBe(true);
    expect(level2Bracket.some((edge) => edge.path.includes(' Q '))).toBe(true);

    const level3Bracket = result.edges.filter((edge) => edge.id.startsWith('bracket-d-0-'));
    expect(level3Bracket.length).toBeGreaterThan(0);
    expect(level3Bracket.some((edge) => edge.id.includes('stem'))).toBe(true);
  });

  it('returns non-empty bounds', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    expect(result.bounds.width).toBeGreaterThan(0);
    expect(result.bounds.height).toBeGreaterThan(0);
  });

  it('moves a lone pair of branches to the same side instead of splitting them', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;

    rootTopic.childrenIds = ['pair-a', 'pair-b'];
    for (const id of Object.keys(sheet.topicsById)) {
      if (id !== 'root' && id !== 'pair-a' && id !== 'pair-b') {
        delete sheet.topicsById[id];
      }
    }

    sheet.topicsById['pair-a'] = createTopic({
      id: 'pair-a',
      text: 'Main Topic 3',
      parentId: rootTopic.id,
      side: 'left',
    });
    sheet.topicsById['pair-b'] = createTopic({
      id: 'pair-b',
      text: 'Main Topic 4',
      parentId: rootTopic.id,
      side: 'right',
    });

    const result = layoutMindmap(sheet);
    const root = result.nodes.get('root')!;
    const a = result.nodes.get('pair-a')!;
    const b = result.nodes.get('pair-b')!;
    const rootCenterY = root.y + root.height / 2;

    // Both nodes end up right of the root, one above and one below center.
    expect(a.x).toBeGreaterThan(root.x + root.width);
    expect(b.x).toBeGreaterThan(root.x + root.width);
    const centers = [a.y + a.height / 2, b.y + b.height / 2].sort((p, q) => p - q);
    expect(centers[0]!).toBeLessThan(rootCenterY);
    expect(centers[1]!).toBeGreaterThan(rootCenterY);

    // Pair connectors fan as curves and colors stay unique.
    const edgeA = result.edges.find((edge) => edge.toId === 'pair-a')!;
    const edgeB = result.edges.find((edge) => edge.toId === 'pair-b')!;
    expect(edgeA.path).toContain(' C ');
    expect(edgeB.path).toContain(' C ');
    expect(a.branchIndex).not.toBe(b.branchIndex);
  });

  it('renders a visible solo connector for the only root child', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;
    const only = createTopic({ id: 'only', text: 'New Topic', side: 'right' });

    sheet.topicsById['only'] = only;
    rootTopic.childrenIds = ['only'];

    const result = layoutMindmap(sheet);
    const root = result.nodes.get('root')!;
    const edge = result.edges.find((e) => e.toId === 'only')!;

    expect(edge).toBeDefined();
    expect(edge.path).toContain(' L ');
    expect(edge.path).not.toContain(' C ');
    expect(edge.maskExempt).toBe(true);
    expect(Number(edge.path.match(/^M ([-\d.]+)/)?.[1])).toBeGreaterThan(
      root.x + root.width + 8,
    );
  });

  it('keeps root connectors when level-1 branches start collapsed', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;

    for (const childId of sheet.topicsById[sheet.rootTopicId]!.childrenIds) {
      const child = sheet.topicsById[childId];
      if (child?.childrenIds.length) child.collapsed = true;
    }

    const result = layoutMindmap(sheet);
    const rootEdges = result.edges.filter((edge) => edge.fromId === sheet.rootTopicId);

    expect(rootEdges).toHaveLength(sheet.topicsById[sheet.rootTopicId]!.childrenIds.length);
    expect(rootEdges.every((edge) => edge.path.length > 0)).toBe(true);
  });

  it('uses a solo connector when only one branch remains on a side', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;
    const visible = createTopic({ id: 'visible-right', text: 'New Topic', side: 'right' });

    sheet.topicsById['visible-right'] = visible;
    rootTopic.childrenIds = ['visible-right'];

    const result = layoutMindmap(sheet);
    const edge = result.edges.find((e) => e.toId === 'visible-right')!;

    expect(edge).toBeDefined();
    expect(edge.path).toContain(' L ');
    expect(edge.path).not.toContain(' C ');
    expect(edge.maskExempt).toBe(true);
  });

  it('renders a straight connector for a lone branch on one side', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;

    rootTopic.childrenIds = ['b4', 'b1', 'b2'];
    for (const id of Object.keys(sheet.topicsById)) {
      if (
        id !== 'root' &&
        id !== 'b4' &&
        id !== 'b1' &&
        id !== 'b2' &&
        !id.startsWith('e-') &&
        !id.startsWith('u-') &&
        !id.startsWith('d-')
      ) {
        delete sheet.topicsById[id];
      }
    }
    sheet.topicsById['b1']!.collapsed = true;
    sheet.topicsById['b2']!.collapsed = true;

    const result = layoutMindmap(sheet);
    const root = result.nodes.get('root')!;
    const leftEdge = result.edges.find((edge) => edge.toId === 'b4')!;

    // b4 is the only left branch: straight line starting outside the mask.
    expect(leftEdge.path).toContain(' L ');
    expect(leftEdge.path).not.toContain(' C ');
    expect(leftEdge.maskExempt).toBe(true);
    expect(Number(leftEdge.path.match(/^M ([-\d.]+)/)?.[1])).toBeLessThan(root.x - 8);
  });

  it('fans root connectors when each side has two branches', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;

    rootTopic.childrenIds = ['l-top', 'l-bottom', 'r-top', 'r-bottom'];
    for (const id of Object.keys(sheet.topicsById)) {
      if (
        id !== 'root' &&
        id !== 'l-top' &&
        id !== 'l-bottom' &&
        id !== 'r-top' &&
        id !== 'r-bottom'
      ) {
        delete sheet.topicsById[id];
      }
    }

    sheet.topicsById['l-top'] = createTopic({
      id: 'l-top',
      text: 'Main Topic 8',
      parentId: rootTopic.id,
      side: 'left',
    });
    sheet.topicsById['l-bottom'] = createTopic({
      id: 'l-bottom',
      text: 'Main Topic 7',
      parentId: rootTopic.id,
      side: 'left',
    });
    sheet.topicsById['r-top'] = createTopic({
      id: 'r-top',
      text: 'Main Topic 5',
      parentId: rootTopic.id,
      side: 'right',
    });
    sheet.topicsById['r-bottom'] = createTopic({
      id: 'r-bottom',
      text: 'Main Topic 6',
      parentId: rootTopic.id,
      side: 'right',
    });

    const result = layoutMindmap(sheet);
    const root = result.nodes.get('root')!;
    const rootCenterY = root.y + root.height / 2;
    const edges = ['l-top', 'l-bottom', 'r-top', 'r-bottom'].map((id) =>
      result.edges.find((edge) => edge.toId === id)!,
    );

    for (const edge of edges) {
      expect(edge.path).toContain(' C ');
      expect(edge.path).not.toContain(' L ');
    }

    const topStartY = (id: string) =>
      Number(result.edges.find((edge) => edge.toId === id)!.path.match(/^M [-\d.]+ ([-\d.]+)/)?.[1]);
    const controlY = (id: string) =>
      Number(
        result.edges.find((edge) => edge.toId === id)!.path.match(/ C [-\d.]+ ([-\d.]+),/)?.[1],
      );

    expect(topStartY('l-top')).toBeLessThan(rootCenterY);
    expect(topStartY('r-top')).toBeLessThan(rootCenterY);
    expect(topStartY('l-bottom')).toBeGreaterThan(rootCenterY);
    expect(topStartY('r-bottom')).toBeGreaterThan(rootCenterY);
    expect(controlY('l-top')).toBeLessThan(topStartY('l-top'));
    expect(controlY('r-top')).toBeLessThan(topStartY('r-top'));
    expect(controlY('l-bottom')).toBeGreaterThan(topStartY('l-bottom'));
    expect(controlY('r-bottom')).toBeGreaterThan(topStartY('r-bottom'));
  });

  it('lays out a two-node side as a symmetric pair around the root center', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const rootTopic = sheet.topicsById[sheet.rootTopicId]!;

    rootTopic.childrenIds = ['pair-top', 'pair-bottom'];
    for (const id of Object.keys(sheet.topicsById)) {
      if (id !== 'root' && id !== 'pair-top' && id !== 'pair-bottom') {
        delete sheet.topicsById[id];
      }
    }

    sheet.topicsById['pair-top'] = createTopic({
      id: 'pair-top',
      text: 'Main Topic 9',
      parentId: rootTopic.id,
      side: 'left',
    });
    sheet.topicsById['pair-bottom'] = createTopic({
      id: 'pair-bottom',
      text: 'Main Topic 8',
      parentId: rootTopic.id,
      side: 'left',
    });

    const result = layoutMindmap(sheet);
    const root = result.nodes.get('root')!;
    const top = result.nodes.get('pair-top')!;
    const bottom = result.nodes.get('pair-bottom')!;
    const rootCenterY = root.y + root.height / 2;
    const topCenterY = top.y + top.height / 2;
    const bottomCenterY = bottom.y + bottom.height / 2;

    expect(topCenterY).toBeLessThan(rootCenterY);
    expect(bottomCenterY).toBeGreaterThan(rootCenterY);
    expect(Math.abs(topCenterY - rootCenterY)).toBeGreaterThan(24);
    expect(Math.abs(bottomCenterY - rootCenterY)).toBeGreaterThan(24);
    expect(topCenterY + bottomCenterY).toBeCloseTo(2 * rootCenterY, 1);

    const topEdge = result.edges.find((edge) => edge.toId === 'pair-top')!;
    const bottomEdge = result.edges.find((edge) => edge.toId === 'pair-bottom')!;
    expect(topEdge.path).toContain(' C ');
    expect(bottomEdge.path).toContain(' C ');

    const controlY = (path: string) => {
      const match = path.match(/ C ([-\d.]+) ([-\d.]+),/);
      return Number(match?.[2]);
    };
    const startX = (path: string) => Number(path.match(/^M ([-\d.]+)/)?.[1]);
    const controlX = (path: string) => Number(path.match(/ C ([-\d.]+) /)?.[1]);
    const topStartY = Number(topEdge.path.match(/^M [-\d.]+ ([-\d.]+)/)?.[1]);
    const bottomStartY = Number(bottomEdge.path.match(/^M [-\d.]+ ([-\d.]+)/)?.[1]);

    expect(controlY(topEdge.path)).toBeLessThan(topStartY);
    expect(controlY(bottomEdge.path)).toBeGreaterThan(bottomStartY);
    expect(controlX(topEdge.path)).toBeLessThan(startX(topEdge.path));
    expect(controlX(bottomEdge.path)).toBeLessThan(startX(bottomEdge.path));
  });
});

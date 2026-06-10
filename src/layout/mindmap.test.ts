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

    expect(measurement.lines.length).toBeGreaterThan(1);
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

  it('keeps existing branch colors stable when a root child is inserted', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const root = sheet.topicsById[sheet.rootTopicId]!;

    root.childrenIds.forEach((childId, index) => {
      const child = sheet.topicsById[childId]!;
      child.style = {
        ...child.style,
        branchColor: branchColorForIndex(index),
      };
    });

    const before = layoutMindmap(sheet);
    const distanceBefore = before.nodes.get('b2')!.branchIndex;
    const evaluationBefore = before.nodes.get('b4')!.branchIndex;

    const inserted = createTopic({
      id: 'inserted-root-child',
      text: 'Inserted',
      parentId: root.id,
      side: 'right',
      style: { branchColor: branchColorForIndex(root.childrenIds.length) },
    });
    sheet.topicsById[inserted.id] = inserted;
    root.childrenIds.splice(1, 0, inserted.id);

    const after = layoutMindmap(sheet);

    expect(after.nodes.get('b2')!.branchIndex).toBe(distanceBefore);
    expect(after.nodes.get('b4')!.branchIndex).toBe(evaluationBefore);
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

  it('routes crowded root branches from top, side, and bottom perimeter zones', () => {
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

    expect(starts.some((point) => point.y < root.y)).toBe(true);
    expect(starts.some((point) => Math.abs(point.x - (compactRight + 18)) < 0.001)).toBe(true);
    expect(starts.some((point) => point.y > root.y + root.height)).toBe(true);
  });

  it('keeps sparse root connectors side-oriented instead of fully fanned', () => {
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
    const firstControlPoint = (path: string) => {
      const match = path.match(/ C ([-\d.]+) ([-\d.]+),/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    };

    const rightEdges = result.edges
      .filter((edge) => {
        const target = edge.toId ? result.nodes.get(edge.toId) : null;
        return edge.fromId === sheet.rootTopicId && target && target.x > rootCenterX;
      })
      .map((edge) => ({
        start: startPoint(edge.path),
        control: firstControlPoint(edge.path),
      }))
      .sort((a, b) => a.start.y - b.start.y);
    const rightStarts = rightEdges.map((edge) => edge.start);

    expect(rightStarts).toHaveLength(3);
    expect(rightStarts[0]!.y).toBeLessThan(rootCenterY);
    expect(rightStarts[1]!.y).toBeCloseTo(rootCenterY);
    expect(rightStarts[2]!.y).toBeGreaterThan(rootCenterY);
    expect(rightStarts[0]!.x).toBeGreaterThan(compactRight);
    expect(rightStarts[2]!.x).toBeGreaterThan(compactRight);
    expect(rightEdges[0]!.control.y).toBeCloseTo(rightEdges[0]!.start.y);
    expect(rightEdges[2]!.control.y).toBeCloseTo(rightEdges[2]!.start.y);
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
      }));

    const rootCenterY = root.y + root.height / 2;
    const topStarts = rightRootEdges
      .filter(({ target }) => target.y + target.height / 2 < rootCenterY)
      .sort((a, b) => a.target.y + a.target.height / 2 - (b.target.y + b.target.height / 2));
    const bottomStarts = rightRootEdges
      .filter(({ target }) => target.y + target.height / 2 > rootCenterY)
      .sort((a, b) => a.target.y + a.target.height / 2 - (b.target.y + b.target.height / 2));

    expect(topStarts.length).toBeGreaterThan(1);
    expect(bottomStarts.length).toBeGreaterThan(1);

    const tolerance = 0.1;
    for (let index = 1; index < topStarts.length; index += 1) {
      expect(topStarts[index - 1]!.start.x).toBeLessThanOrEqual(topStarts[index]!.start.x + tolerance);
    }

    for (let index = 1; index < bottomStarts.length; index += 1) {
      expect(bottomStarts[index - 1]!.start.x).toBeGreaterThanOrEqual(bottomStarts[index]!.start.x - tolerance);
    }
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

  it('returns non-empty bounds', () => {
    const doc = createSampleDocument();
    const sheet = doc.sheetsById[doc.sheets[0]!]!;
    const result = layoutMindmap(sheet);

    expect(result.bounds.width).toBeGreaterThan(0);
    expect(result.bounds.height).toBeGreaterThan(0);
  });
});

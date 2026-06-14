import { describe, expect, it } from 'vitest';
import { createTopic, createSheet } from '@/core/model/factories';
import { BOUNDARY_SIBLING_GAP, boundarySplitAfterIndices, gapBetweenSiblings } from './boundaryLayout';
import { layoutMindmap } from './mindmap';

describe('boundaryLayout', () => {
  it('marks only the split between included and excluded siblings', () => {
    const root = createTopic({ id: 'root', text: 'Root' });
    const branch = createTopic({ id: 'branch', text: 'Branch', parentId: 'root', side: 'right' });
    const siblings = ['a', 'b', 'c', 'd'].map((id) =>
      createTopic({ id, text: 'New Topic', parentId: 'branch' }),
    );

    root.childrenIds = ['branch'];
    branch.childrenIds = siblings.map((topic) => topic.id);

    const sheet = createSheet({
      title: 'Boundary spacing',
      rootTopicId: 'root',
      topicsById: { root, branch, ...Object.fromEntries(siblings.map((topic) => [topic.id, topic])) },
      boundaries: [
        {
          id: 'boundary-1',
          parentId: 'branch',
          range: [0, 1],
          topicIds: ['a', 'b'],
        },
      ],
    });

    expect([...boundarySplitAfterIndices(sheet, 'branch')]).toEqual([1]);
    expect(gapBetweenSiblings(sheet, 'branch', 0, 8)).toBe(8);
    expect(gapBetweenSiblings(sheet, 'branch', 1, 8)).toBe(BOUNDARY_SIBLING_GAP);
  });
});

describe('layout boundary spacing', () => {
  it('only enlarges the gap between the last included and first excluded sibling', () => {
    const root = createTopic({ id: 'root', text: 'Root' });
    const branch = createTopic({ id: 'branch', text: 'Branch', parentId: 'root', side: 'right' });
    const siblings = ['a', 'b', 'c', 'd'].map((id) =>
      createTopic({ id, text: 'New Topic', parentId: 'branch' }),
    );

    root.childrenIds = ['branch'];
    branch.childrenIds = siblings.map((topic) => topic.id);

    const withoutBoundary = createSheet({
      title: 'Boundary spacing',
      rootTopicId: 'root',
      topicsById: { root, branch, ...Object.fromEntries(siblings.map((topic) => [topic.id, topic])) },
    });

    const withBoundary = {
      ...withoutBoundary,
      boundaries: [
        {
          id: 'boundary-1',
          parentId: 'branch',
          range: [0, 1] as [number, number],
          topicIds: ['a', 'b'],
        },
      ],
    };

    const baseLayout = layoutMindmap(withoutBoundary);
    const spacedLayout = layoutMindmap(withBoundary);

    const gap = (layout: ReturnType<typeof layoutMindmap>, upperId: string, lowerId: string) => {
      const upper = layout.nodes.get(upperId)!;
      const lower = layout.nodes.get(lowerId)!;
      return lower.y - (upper.y + upper.height);
    };

    const insideGap = gap(spacedLayout, 'a', 'b') - gap(baseLayout, 'a', 'b');
    const splitGap = gap(spacedLayout, 'b', 'c');
    const farGap = gap(spacedLayout, 'c', 'd') - gap(baseLayout, 'c', 'd');

    expect(insideGap).toBeLessThanOrEqual(1);
    expect(splitGap).toBeGreaterThanOrEqual(BOUNDARY_SIBLING_GAP - 1);
    expect(farGap).toBeLessThanOrEqual(1);
  });
});

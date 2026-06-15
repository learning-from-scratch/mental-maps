import { describe, expect, it } from 'vitest';
import type { NodeLayout } from '@/layout/types';
import {
  mergeSelection,
  normalizeSelectionRect,
  toggleTopicInSelection,
  topicIdsInSelectionRect,
} from './selection';

function node(x: number, y: number, width: number, height: number): NodeLayout {
  return {
    x,
    y,
    width,
    height,
    depth: 1,
    side: 'right',
    branchIndex: 0,
    fontSize: 14,
    lineHeight: 18,
    lines: [''],
  };
}

describe('selection', () => {
  it('normalizes drag rectangles', () => {
    expect(normalizeSelectionRect({ x: 10, y: 20 }, { x: 30, y: 5 })).toEqual({
      x: 10,
      y: 5,
      width: 20,
      height: 15,
    });
  });

  it('finds topics intersecting a marquee', () => {
    const nodes = new Map([
      ['a', node(0, 0, 20, 20)],
      ['b', node(50, 50, 20, 20)],
      ['c', node(15, 15, 20, 20)],
    ]);

    const hits = topicIdsInSelectionRect(
      nodes,
      normalizeSelectionRect({ x: 5, y: 5 }, { x: 25, y: 25 }),
    );

    expect(hits.sort()).toEqual(['a', 'c']);
  });

  it('excludes listed topics from marquee hits', () => {
    const nodes = new Map([
      ['root', node(0, 0, 40, 40)],
      ['child', node(10, 10, 20, 20)],
    ]);

    const hits = topicIdsInSelectionRect(
      nodes,
      normalizeSelectionRect({ x: 0, y: 0 }, { x: 50, y: 50 }),
      ['root'],
    );

    expect(hits).toEqual(['child']);
  });

  it('toggles and merges topic selections', () => {
    expect(toggleTopicInSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleTopicInSelection(['a', 'b'], 'a')).toEqual(['b']);
    expect(mergeSelection(['a'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

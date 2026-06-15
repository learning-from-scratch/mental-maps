import type { TopicId } from '@/core/model/types';
import type { NodeLayout } from '@/layout/types';

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizeSelectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): SelectionRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function rectsIntersect(a: SelectionRect, b: SelectionRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function topicIdsInSelectionRect(
  nodes: Map<TopicId, NodeLayout>,
  rect: SelectionRect,
  excludeTopicIds: TopicId[] = [],
): TopicId[] {
  const excluded = new Set(excludeTopicIds);
  const hits: TopicId[] = [];
  for (const [topicId, node] of nodes) {
    if (excluded.has(topicId)) continue;
    const bounds: SelectionRect = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
    if (rectsIntersect(rect, bounds)) hits.push(topicId);
  }
  return hits;
}

export function toggleTopicInSelection(selected: TopicId[], topicId: TopicId): TopicId[] {
  if (selected.includes(topicId)) {
    return selected.filter((id) => id !== topicId);
  }
  return [...selected, topicId];
}

export function mergeSelection(selected: TopicId[], next: TopicId[]): TopicId[] {
  return [...new Set([...selected, ...next])];
}

import { collectDescendantIds } from '@/core/commands/tree';
import {
  DEFAULT_BOUNDARY_PADDING,
  MIN_BOUNDARY_PADDING,
} from '@/core/model/boundaries';
import type { Boundary, Sheet, TopicId, Vec2 } from '@/core/model/types';
import type { NodeLayout, Rect } from '@/layout/types';
import { nodeContainsPoint } from '@/layout/relationshipGeometry';

export const BOUNDARY_HORIZONTAL_PADDING = 12;

export function findTopicIdAtPoint(
  nodes: Map<TopicId, NodeLayout>,
  point: Vec2,
): TopicId | null {
  let hit: { id: TopicId; area: number } | null = null;

  for (const [id, node] of nodes) {
    if (!nodeContainsPoint(node, point)) continue;
    const area = node.width * node.height;
    if (!hit || area < hit.area) {
      hit = { id, area };
    }
  }

  return hit?.id ?? null;
}

export function collectBoundaryTopicIds(sheet: Sheet, boundary: Boundary): TopicId[] {
  if (boundary.topicIds?.length) {
    const result: TopicId[] = [];

    for (const topicId of boundary.topicIds) {
      if (topicId === sheet.rootTopicId) continue;
      result.push(topicId, ...collectDescendantIds(sheet, topicId));
    }

    return result;
  }

  const parent = sheet.topicsById[boundary.parentId];
  if (!parent) return [];

  const [start, end] = boundary.range;
  const childIds = parent.childrenIds.slice(start, end + 1);
  const result: TopicId[] = [];

  for (const childId of childIds) {
    result.push(childId, ...collectDescendantIds(sheet, childId));
  }

  return result;
}

export function computeBoundaryContentRect(
  nodes: Map<TopicId, NodeLayout>,
  sheet: Sheet,
  boundary: Boundary,
): Rect | null {
  const topicIds = collectBoundaryTopicIds(sheet, boundary);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const topicId of topicIds) {
    const node = nodes.get(topicId);
    if (!node) continue;

    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  if (!Number.isFinite(minX)) return null;

  return {
    x: minX - BOUNDARY_HORIZONTAL_PADDING,
    y: minY,
    width: maxX - minX + BOUNDARY_HORIZONTAL_PADDING * 2,
    height: maxY - minY,
  };
}

export function computeBoundaryRect(
  nodes: Map<TopicId, NodeLayout>,
  sheet: Sheet,
  boundary: Boundary,
): Rect | null {
  const content = computeBoundaryContentRect(nodes, sheet, boundary);
  if (!content) return null;

  const paddingTop = boundary.paddingTop ?? DEFAULT_BOUNDARY_PADDING;
  const paddingBottom = boundary.paddingBottom ?? DEFAULT_BOUNDARY_PADDING;

  return {
    x: content.x,
    y: content.y - paddingTop,
    width: content.width,
    height: content.height + paddingTop + paddingBottom,
  };
}

export function boundaryRectFromVerticalBand(
  nodes: Map<TopicId, NodeLayout>,
  sheet: Sheet,
  boundary: Boundary,
  bandTop: number,
  bandBottom: number,
): Rect | null {
  const content = computeBoundaryContentRect(nodes, sheet, boundary);
  if (!content) return null;

  return {
    x: content.x,
    y: bandTop,
    width: content.width,
    height: Math.max(bandBottom - bandTop, 1),
  };
}

export const MIN_BOUNDARY_BAND_HEIGHT = 16;

export function clampBoundaryPadding(value: number): number {
  return Math.max(MIN_BOUNDARY_PADDING, Math.round(value));
}

export function verticalOverlapFraction(
  node: NodeLayout,
  bandTop: number,
  bandBottom: number,
): number {
  if (node.height <= 0) return 0;

  const overlapTop = Math.max(node.y, bandTop);
  const overlapBottom = Math.min(node.y + node.height, bandBottom);
  return Math.max(0, overlapBottom - overlapTop) / node.height;
}

export function snapBoundaryFromVerticalBand(
  sheet: Sheet,
  nodes: Map<TopicId, NodeLayout>,
  boundary: Boundary,
  bandTop: number,
  bandBottom: number,
): Partial<Boundary> {
  const parent = sheet.topicsById[boundary.parentId];
  if (!parent) return {};

  const currentTopicIds = boundary.topicIds ?? [];
  const isRootOnlyBoundary =
    currentTopicIds.length === 1 && currentTopicIds[0] === sheet.rootTopicId;

  const included: TopicId[] = [];

  for (const childId of parent.childrenIds) {
    const node = nodes.get(childId);
    if (!node) continue;
    if (verticalOverlapFraction(node, bandTop, bandBottom) > 0.5) {
      included.push(childId);
    }
  }

  if (included.length === 0 && isRootOnlyBoundary) {
    const rootNode = nodes.get(sheet.rootTopicId);
    if (rootNode && verticalOverlapFraction(rootNode, bandTop, bandBottom) > 0.5) {
      included.push(sheet.rootTopicId);
    }
  }

  if (included.length === 0) {
    const fallbackCandidates =
      currentTopicIds.length > 0
        ? currentTopicIds
        : isRootOnlyBoundary
          ? [sheet.rootTopicId]
          : parent.childrenIds;

    let bestId: TopicId | null = null;
    let bestOverlap = -1;

    for (const topicId of fallbackCandidates) {
      const node = nodes.get(topicId);
      if (!node) continue;
      const overlap = verticalOverlapFraction(node, bandTop, bandBottom);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestId = topicId;
      }
    }

    if (bestId) {
      included.push(bestId);
    }
  }

  const nextTopicIds = [...included].sort(
    (a, b) => parent.childrenIds.indexOf(a) - parent.childrenIds.indexOf(b),
  );

  if (nextTopicIds.length === 1 && nextTopicIds[0] === sheet.rootTopicId) {
    return {
      topicIds: [sheet.rootTopicId],
      range: [0, 0],
      paddingTop: DEFAULT_BOUNDARY_PADDING,
      paddingBottom: DEFAULT_BOUNDARY_PADDING,
    };
  }

  const indices = nextTopicIds
    .map((topicId) => parent.childrenIds.indexOf(topicId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (indices.length === 0) {
    return {
      paddingTop: DEFAULT_BOUNDARY_PADDING,
      paddingBottom: DEFAULT_BOUNDARY_PADDING,
    };
  }

  return {
    topicIds: nextTopicIds,
    range: [indices[0]!, indices[indices.length - 1]!] as [number, number],
    paddingTop: DEFAULT_BOUNDARY_PADDING,
    paddingBottom: DEFAULT_BOUNDARY_PADDING,
  };
}

export function paddingTopFromHandleY(contentTop: number, handleY: number): number {
  return clampBoundaryPadding(contentTop - handleY);
}

export function paddingBottomFromHandleY(
  contentBottom: number,
  handleY: number,
): number {
  return clampBoundaryPadding(handleY - contentBottom);
}

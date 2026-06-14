import { DEFAULT_BOUNDARY_PADDING } from '@/core/model/boundaries';
import type { Boundary, Sheet, Topic, TopicId } from '@/core/model/types';

/** Room for boundary padding plus a small visible strip at the split edge. */
export const BOUNDARY_SIBLING_GAP = DEFAULT_BOUNDARY_PADDING + 4;

function includedIndicesForBoundary(parent: Topic, boundary: Boundary): number[] {
  if (boundary.topicIds?.length) {
    return boundary.topicIds
      .map((topicId) => parent.childrenIds.indexOf(topicId))
      .filter((index) => index >= 0);
  }

  const [start, end] = boundary.range;
  const indices: number[] = [];
  for (let index = start; index <= end; index++) {
    indices.push(index);
  }
  return indices;
}

/** Child indices after which an enlarged sibling gap is required. */
export function boundarySplitAfterIndices(sheet: Sheet, parentId: TopicId): Set<number> {
  const parent = sheet.topicsById[parentId];
  if (!parent) return new Set();

  const splits = new Set<number>();

  for (const boundary of sheet.boundaries ?? []) {
    if (boundary.parentId !== parentId) continue;

    const indices = includedIndicesForBoundary(parent, boundary);
    if (indices.length === 0) continue;

    const minIndex = Math.min(...indices);
    const maxIndex = Math.max(...indices);

    if (minIndex > 0) {
      splits.add(minIndex - 1);
    }
    if (maxIndex < parent.childrenIds.length - 1) {
      splits.add(maxIndex);
    }
  }

  return splits;
}

export function gapBetweenSiblings(
  sheet: Sheet,
  parentId: TopicId,
  afterChildIndex: number,
  defaultSpacing: number,
): number {
  return boundarySplitAfterIndices(sheet, parentId).has(afterChildIndex)
    ? Math.max(defaultSpacing, BOUNDARY_SIBLING_GAP)
    : defaultSpacing;
}

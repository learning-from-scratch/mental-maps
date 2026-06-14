import { isDescendant } from '../commands/tree';
import type { Boundary, Sheet, TopicId } from './types';

export const DEFAULT_BOUNDARY_PADDING = 12;
export const MIN_BOUNDARY_PADDING = 4;
export const DEFAULT_BOUNDARY_LABEL = 'This is a label';

export function filterSelectionRoots(sheet: Sheet, selectedTopicIds: TopicId[]): TopicId[] {
  return selectedTopicIds.filter(
    (id) => !selectedTopicIds.some((otherId) => otherId !== id && isDescendant(sheet, otherId, id)),
  );
}

function indexInParent(sheet: Sheet, topicId: TopicId): { parentId: TopicId; index: number } | null {
  const topic = sheet.topicsById[topicId];
  if (!topic || topic.parentId === null) return null;

  const parent = sheet.topicsById[topic.parentId];
  if (!parent) return null;

  const index = parent.childrenIds.indexOf(topicId);
  if (index < 0) return null;

  return { parentId: topic.parentId, index };
}

function mergeContiguousRanges(indices: number[]): [number, number][] {
  if (indices.length === 0) return [];

  const sorted = [...indices].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  let start = sorted[0]!;
  let end = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const index = sorted[i]!;
    if (index === end + 1) {
      end = index;
    } else {
      ranges.push([start, end]);
      start = index;
      end = index;
    }
  }

  ranges.push([start, end]);
  return ranges;
}

export function boundariesFromSelection(
  sheet: Sheet,
  selectedTopicIds: TopicId[],
): Omit<Boundary, 'id'>[] {
  const roots = filterSelectionRoots(sheet, selectedTopicIds);
  if (roots.length === 0) return [];

  const byParent = new Map<TopicId, { index: number; topicId: TopicId }[]>();

  for (const topicId of roots) {
    if (topicId === sheet.rootTopicId) {
      return [
        {
          parentId: sheet.rootTopicId,
          range: [0, 0],
          topicIds: [sheet.rootTopicId],
          paddingTop: DEFAULT_BOUNDARY_PADDING,
          paddingBottom: DEFAULT_BOUNDARY_PADDING,
        },
      ];
    }

    const placement = indexInParent(sheet, topicId);
    if (!placement) continue;

    const existing = byParent.get(placement.parentId) ?? [];
    existing.push({ index: placement.index, topicId });
    byParent.set(placement.parentId, existing);
  }

  const result: Omit<Boundary, 'id'>[] = [];

  for (const [parentId, items] of byParent) {
    const sorted = [...items].sort((a, b) => a.index - b.index);
    const indices = sorted.map((item) => item.index);

    for (const range of mergeContiguousRanges(indices)) {
      const topicIds = sorted
        .filter((item) => item.index >= range[0] && item.index <= range[1])
        .map((item) => item.topicId);

      result.push({
        parentId,
        range,
        topicIds,
        paddingTop: DEFAULT_BOUNDARY_PADDING,
        paddingBottom: DEFAULT_BOUNDARY_PADDING,
      });
    }
  }

  return result;
}

export function boundaryMatchesSelection(
  boundary: Boundary,
  candidate: Pick<Boundary, 'parentId' | 'range' | 'topicIds'>,
): boolean {
  if (boundary.parentId !== candidate.parentId) return false;
  if (boundary.range[0] !== candidate.range[0] || boundary.range[1] !== candidate.range[1]) {
    return false;
  }

  const existingIds = [...(boundary.topicIds ?? [])].sort();
  const candidateIds = [...(candidate.topicIds ?? [])].sort();
  if (existingIds.length !== candidateIds.length) return false;
  return existingIds.every((id, index) => id === candidateIds[index]);
}

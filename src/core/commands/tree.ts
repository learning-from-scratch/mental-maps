import type { Boundary, Sheet, Summary, Topic, TopicId } from '../model/types';

export function isDescendant(sheet: Sheet, ancestorId: TopicId, topicId: TopicId): boolean {
  if (ancestorId === topicId) return true;

  const topic = sheet.topicsById[ancestorId];
  if (!topic) return false;

  for (const childId of topic.childrenIds) {
    if (isDescendant(sheet, childId, topicId)) return true;
  }

  return false;
}

export function collectDescendantIds(sheet: Sheet, topicId: TopicId): TopicId[] {
  const result: TopicId[] = [];
  const topic = sheet.topicsById[topicId];
  if (!topic) return result;

  for (const childId of topic.childrenIds) {
    result.push(childId, ...collectDescendantIds(sheet, childId));
  }

  return result;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

function repairRangeOnInsert(
  range: [number, number],
  insertIndex: number,
): [number, number] {
  const [start, end] = range;
  if (insertIndex <= start) {
    return [start + 1, end + 1];
  }
  if (insertIndex <= end) {
    return [start, end + 1];
  }
  return range;
}

function repairRangeOnRemove(
  range: [number, number],
  removeIndex: number,
): [number, number] | null {
  const [start, end] = range;
  if (removeIndex < start) {
    return [start - 1, end - 1];
  }
  if (removeIndex > end) {
    return range;
  }
  if (start === end) {
    return null;
  }
  return [start, end - 1];
}

function repairBoundariesOnInsert(
  boundaries: Boundary[],
  parentId: TopicId,
  insertIndex: number,
): Boundary[] {
  return boundaries.map((boundary) => {
    if (boundary.parentId !== parentId) return boundary;
    return {
      ...boundary,
      range: repairRangeOnInsert(boundary.range, insertIndex),
    };
  });
}

function repairSummariesOnInsert(
  summaries: Summary[],
  parentId: TopicId,
  insertIndex: number,
): Summary[] {
  return summaries.map((summary) => {
    if (summary.parentId !== parentId) return summary;
    return {
      ...summary,
      range: repairRangeOnInsert(summary.range, insertIndex),
    };
  });
}

function repairBoundariesOnRemove(
  boundaries: Boundary[],
  parentId: TopicId,
  removeIndex: number,
): Boundary[] {
  const next: Boundary[] = [];

  for (const boundary of boundaries) {
    if (boundary.parentId !== parentId) {
      next.push(boundary);
      continue;
    }

    const repaired = repairRangeOnRemove(boundary.range, removeIndex);
    if (repaired) {
      next.push({ ...boundary, range: repaired });
    }
  }

  return next;
}

function repairSummariesOnRemove(
  summaries: Summary[],
  parentId: TopicId,
  removeIndex: number,
): Summary[] {
  const next: Summary[] = [];

  for (const summary of summaries) {
    if (summary.parentId !== parentId) {
      next.push(summary);
      continue;
    }

    const repaired = repairRangeOnRemove(summary.range, removeIndex);
    if (repaired) {
      next.push({ ...summary, range: repaired });
    }
  }

  return next;
}

export function insertChildAt(
  sheet: Sheet,
  parentId: TopicId,
  childId: TopicId,
  index?: number,
): void {
  const parent = sheet.topicsById[parentId];
  const child = sheet.topicsById[childId];
  if (!parent || !child) {
    throw new Error('insertChildAt: parent or child not found');
  }

  if (child.parentId && child.parentId !== parentId) {
    removeChildAt(sheet, child.parentId, childId);
  } else if (child.parentId === parentId) {
    const currentIndex = parent.childrenIds.indexOf(childId);
    if (currentIndex !== -1) {
      parent.childrenIds.splice(currentIndex, 1);
      sheet.boundaries = repairBoundariesOnRemove(sheet.boundaries, parentId, currentIndex);
      sheet.summaries = repairSummariesOnRemove(sheet.summaries, parentId, currentIndex);
    }
  }

  const insertIndex = clampIndex(index ?? parent.childrenIds.length, parent.childrenIds.length);
  parent.childrenIds.splice(insertIndex, 0, childId);
  child.parentId = parentId;

  sheet.boundaries = repairBoundariesOnInsert(sheet.boundaries, parentId, insertIndex);
  sheet.summaries = repairSummariesOnInsert(sheet.summaries, parentId, insertIndex);

  const floatingIndex = sheet.floatingTopicIds.indexOf(childId);
  if (floatingIndex !== -1) {
    sheet.floatingTopicIds.splice(floatingIndex, 1);
    delete child.position;
  }
}

export function removeChildAt(
  sheet: Sheet,
  parentId: TopicId,
  childId: TopicId,
): number {
  const parent = sheet.topicsById[parentId];
  const child = sheet.topicsById[childId];
  if (!parent || !child) {
    throw new Error('removeChildAt: parent or child not found');
  }

  const removeIndex = parent.childrenIds.indexOf(childId);
  if (removeIndex === -1) {
    throw new Error('removeChildAt: child is not in parent childrenIds');
  }

  parent.childrenIds.splice(removeIndex, 1);
  child.parentId = null;

  sheet.boundaries = repairBoundariesOnRemove(sheet.boundaries, parentId, removeIndex);
  sheet.summaries = repairSummariesOnRemove(sheet.summaries, parentId, removeIndex);

  return removeIndex;
}

export function deleteTopicSubtree(sheet: Sheet, rootTopicId: TopicId): TopicId[] {
  const toDelete = [rootTopicId, ...collectDescendantIds(sheet, rootTopicId)];
  const deleteSet = new Set(toDelete);

  for (const topicId of toDelete) {
    const topic = sheet.topicsById[topicId];
    if (!topic) continue;

    if (topic.parentId) {
      const parent = sheet.topicsById[topic.parentId];
      if (parent) {
        const index = parent.childrenIds.indexOf(topicId);
        if (index !== -1) {
          parent.childrenIds.splice(index, 1);
          sheet.boundaries = repairBoundariesOnRemove(sheet.boundaries, topic.parentId, index);
          sheet.summaries = repairSummariesOnRemove(sheet.summaries, topic.parentId, index);
        }
      }
    }

    const floatingIndex = sheet.floatingTopicIds.indexOf(topicId);
    if (floatingIndex !== -1) {
      sheet.floatingTopicIds.splice(floatingIndex, 1);
    }

    delete sheet.topicsById[topicId];
  }

  sheet.relationships = sheet.relationships.filter(
    (rel) => !deleteSet.has(rel.fromId) && !deleteSet.has(rel.toId),
  );

  sheet.boundaries = sheet.boundaries.filter((boundary) => !deleteSet.has(boundary.parentId));

  sheet.summaries = sheet.summaries.filter((summary) => {
    if (deleteSet.has(summary.parentId) || deleteSet.has(summary.summaryTopicId)) {
      return false;
    }
    return true;
  });

  return toDelete;
}

export function cloneTopicBranch(
  sheet: Sheet,
  sourceTopicId: TopicId,
  idFactory: () => string,
): { rootId: TopicId; topics: Topic[] } {
  const source = sheet.topicsById[sourceTopicId];
  if (!source) {
    throw new Error(`cloneTopicBranch: topic not found: ${sourceTopicId}`);
  }

  const idMap = new Map<TopicId, TopicId>();
  const topics: Topic[] = [];

  function cloneRecursive(topicId: TopicId, parentNewId: TopicId | null): TopicId {
    const original = sheet.topicsById[topicId];
    if (!original) {
      throw new Error(`cloneTopicBranch: topic not found: ${topicId}`);
    }

    const newId = idFactory();
    idMap.set(topicId, newId);

    const cloned: Topic = {
      id: newId,
      parentId: parentNewId,
      childrenIds: [],
      text: original.text,
      collapsed: original.collapsed,
      side: original.side,
      position: original.position ? { ...original.position } : undefined,
      notes: original.notes,
      link: original.link ? { ...original.link } : undefined,
      labels: [...original.labels],
      labelsAutoSort: original.labelsAutoSort,
      markers: [...original.markers],
      style: original.style ? { ...original.style } : undefined,
    };

    topics.push(cloned);

    for (const childId of original.childrenIds) {
      const clonedChildId = cloneRecursive(childId, newId);
      cloned.childrenIds.push(clonedChildId);
    }

    return newId;
  }

  const rootId = cloneRecursive(sourceTopicId, null);

  return { rootId, topics };
}

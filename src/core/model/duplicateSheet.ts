import { nanoid } from 'nanoid';
import { migrateLegacyTopicLink } from './link';
import type { Sheet, TopicId } from './types';

export function duplicateSheet(source: Sheet, title?: string): Sheet {
  const idMap = new Map<TopicId, TopicId>();

  for (const topicId of Object.keys(source.topicsById)) {
    idMap.set(topicId, nanoid());
  }

  const remap = (id: TopicId): TopicId => {
    const next = idMap.get(id);
    if (!next) throw new Error(`duplicateSheet: missing id mapping for ${id}`);
    return next;
  };

  const topicsById: Sheet['topicsById'] = {};
  for (const [oldId, topic] of Object.entries(source.topicsById)) {
    const newId = remap(oldId);
    const cloned = structuredClone(topic);
    migrateLegacyTopicLink(cloned);
    if (cloned.topicLink?.targetSheetId === source.id) {
      cloned.topicLink = {
        ...cloned.topicLink,
        targetTopicId: remap(cloned.topicLink.targetTopicId),
      };
    }
    topicsById[newId] = {
      ...cloned,
      id: newId,
      parentId: topic.parentId ? remap(topic.parentId) : null,
      childrenIds: topic.childrenIds.map(remap),
    };
  }

  return {
    ...structuredClone(source),
    id: nanoid(),
    title: title ?? `${source.title} copy`,
    rootTopicId: remap(source.rootTopicId),
    floatingTopicIds: (source.floatingTopicIds ?? []).map(remap),
    topicsById,
    relationships: (source.relationships ?? []).map((relationship) => ({
      ...structuredClone(relationship),
      id: nanoid(),
      fromId: remap(relationship.fromId),
      toId: remap(relationship.toId),
    })),
    boundaries: (source.boundaries ?? []).map((boundary) => ({
      ...structuredClone(boundary),
      id: nanoid(),
      parentId: remap(boundary.parentId),
    })),
    summaries: (source.summaries ?? []).map((summary) => ({
      ...structuredClone(summary),
      id: nanoid(),
      parentId: remap(summary.parentId),
      summaryTopicId: remap(summary.summaryTopicId),
    })),
  };
}

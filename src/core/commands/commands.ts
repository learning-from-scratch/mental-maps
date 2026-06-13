import { nanoid } from 'nanoid';
import { clearTopicLinksToTargets } from '../model/link';
import { createTopic, getSheet, getTopic } from '../model/factories';
import type { MindMapDocument, Sheet, TopicId } from '../model/types';
import {
  cloneTopicBranch,
  deleteTopicSubtree,
  insertChildAt,
  isDescendant,
  removeChildAt,
} from './tree';
import type {
  AttachFloatingPayload,
  AddChildPayload,
  AddFloatingPayload,
  AddSiblingPayload,
  CommandContext,
  DeleteTopicsPayload,
  DetachAsFloatingPayload,
  DuplicateBranchPayload,
  MoveBranchPayload,
  ReorderChildPayload,
  SetStylePayload,
  SetTextPayload,
  ToggleCollapsePayload,
} from './types';

function touchDocument(doc: MindMapDocument): void {
  doc.modifiedAt = Date.now();
}

function requireSheet(ctx: CommandContext): Sheet {
  return getSheet(ctx.doc, ctx.sheetId);
}

function requireTopic(sheet: Sheet, topicId: TopicId) {
  return getTopic(sheet, topicId);
}

export function addChild(ctx: CommandContext, payload: AddChildPayload): TopicId {
  const sheet = requireSheet(ctx);
  requireTopic(sheet, payload.parentId);

  const topic = createTopic({
    text: payload.text,
    side: payload.side,
  });

  sheet.topicsById[topic.id] = topic;
  insertChildAt(sheet, payload.parentId, topic.id, payload.index);
  touchDocument(ctx.doc);
  return topic.id;
}

export function addSibling(ctx: CommandContext, payload: AddSiblingPayload): TopicId {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);

  if (!topic.parentId) {
    throw new Error('Cannot add sibling to root or floating topic without parent');
  }

  const parent = requireTopic(sheet, topic.parentId);
  const index = parent.childrenIds.indexOf(payload.topicId);
  if (index === -1) {
    throw new Error('Topic is not listed in parent childrenIds');
  }

  const sibling = createTopic({
    text: payload.text,
    side: topic.side,
  });

  sheet.topicsById[sibling.id] = sibling;
  insertChildAt(sheet, topic.parentId, sibling.id, index + 1);
  touchDocument(ctx.doc);
  return sibling.id;
}

export function addFloating(ctx: CommandContext, payload: AddFloatingPayload): TopicId {
  const sheet = requireSheet(ctx);
  const topic = createTopic({
    text: payload.text,
    position: payload.position,
  });

  sheet.topicsById[topic.id] = topic;
  sheet.floatingTopicIds.push(topic.id);
  touchDocument(ctx.doc);
  return topic.id;
}

export function setText(ctx: CommandContext, payload: SetTextPayload): void {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);
  topic.text = payload.text;
  touchDocument(ctx.doc);
}

export function deleteTopics(ctx: CommandContext, payload: DeleteTopicsPayload): TopicId[] {
  const sheet = requireSheet(ctx);
  const deleted: TopicId[] = [];

  for (const topicId of payload.topicIds) {
    if (!sheet.topicsById[topicId]) continue;
    if (topicId === sheet.rootTopicId) {
      throw new Error('Cannot delete root topic');
    }
    deleted.push(...deleteTopicSubtree(sheet, topicId));
  }

  const uniqueDeleted = [...new Set(deleted)];
  if (uniqueDeleted.length > 0) {
    clearTopicLinksToTargets(ctx.doc.sheetsById, ctx.sheetId, uniqueDeleted);
  }

  touchDocument(ctx.doc);
  return deleted;
}

export function duplicateBranch(ctx: CommandContext, payload: DuplicateBranchPayload): TopicId {
  const sheet = requireSheet(ctx);
  const source = requireTopic(sheet, payload.topicId);

  if (!source.parentId) {
    throw new Error('Cannot duplicate root or floating topic as a branch');
  }

  const parent = requireTopic(sheet, source.parentId);
  const sourceIndex = parent.childrenIds.indexOf(payload.topicId);
  if (sourceIndex === -1) {
    throw new Error('Topic is not listed in parent childrenIds');
  }

  const { rootId, topics } = cloneTopicBranch(sheet, payload.topicId, nanoid);
  for (const topic of topics) {
    sheet.topicsById[topic.id] = topic;
  }

  insertChildAt(sheet, source.parentId, rootId, sourceIndex + 1);
  touchDocument(ctx.doc);
  return rootId;
}

export function moveBranch(ctx: CommandContext, payload: MoveBranchPayload): void {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);
  requireTopic(sheet, payload.newParentId);

  if (payload.topicId === payload.newParentId) {
    throw new Error('Cannot move topic onto itself');
  }

  if (payload.topicId === sheet.rootTopicId) {
    throw new Error('Cannot move root topic');
  }

  if (isDescendant(sheet, payload.topicId, payload.newParentId)) {
    throw new Error('Cannot move topic into its own descendant');
  }

  if (!topic.parentId) {
    throw new Error('Use attachFloating for floating topics');
  }

  removeChildAt(sheet, topic.parentId, payload.topicId);
  insertChildAt(sheet, payload.newParentId, payload.topicId, payload.index);
  touchDocument(ctx.doc);
}

export function reorderChild(ctx: CommandContext, payload: ReorderChildPayload): void {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);

  if (!topic.parentId) {
    throw new Error('Cannot reorder topic without parent');
  }

  const parent = requireTopic(sheet, topic.parentId);
  const currentIndex = parent.childrenIds.indexOf(payload.topicId);
  if (currentIndex === -1) {
    throw new Error('Topic is not listed in parent childrenIds');
  }

  if (currentIndex === payload.newIndex) return;

  removeChildAt(sheet, topic.parentId, payload.topicId);

  const adjustedIndex =
    payload.newIndex > currentIndex ? payload.newIndex - 1 : payload.newIndex;
  insertChildAt(sheet, topic.parentId, payload.topicId, adjustedIndex);
  touchDocument(ctx.doc);
}

export function toggleCollapse(ctx: CommandContext, payload: ToggleCollapsePayload): void {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);
  topic.collapsed = !topic.collapsed;
  touchDocument(ctx.doc);
}

export function detachAsFloating(
  ctx: CommandContext,
  payload: DetachAsFloatingPayload,
): void {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);

  if (topic.id === sheet.rootTopicId) {
    throw new Error('Cannot detach root topic');
  }

  if (topic.parentId) {
    removeChildAt(sheet, topic.parentId, topic.id);
  }

  topic.position = payload.position;
  if (!sheet.floatingTopicIds.includes(topic.id)) {
    sheet.floatingTopicIds.push(topic.id);
  }

  touchDocument(ctx.doc);
}

export function attachFloating(ctx: CommandContext, payload: AttachFloatingPayload): void {
  const sheet = requireSheet(ctx);
  const topic = requireTopic(sheet, payload.topicId);
  requireTopic(sheet, payload.parentId);

  if (!sheet.floatingTopicIds.includes(topic.id)) {
    throw new Error('Topic is not floating');
  }

  topic.position = undefined;
  insertChildAt(sheet, payload.parentId, topic.id, payload.index);
  touchDocument(ctx.doc);
}

export function setStyle(ctx: CommandContext, payload: SetStylePayload): void {
  const sheet = requireSheet(ctx);

  for (const topicId of payload.topicIds) {
    const topic = requireTopic(sheet, topicId);
    topic.style = { ...topic.style, ...payload.patch };
  }

  touchDocument(ctx.doc);
}

export const commandHandlers = {
  addChild,
  addSibling,
  addFloating,
  setText,
  deleteTopics,
  duplicateBranch,
  moveBranch,
  reorderChild,
  toggleCollapse,
  detachAsFloating,
  attachFloating,
  setStyle,
} as const;

import { addChild } from '@/core/commands/commands';
import type { Sheet, TopicId } from '@/core/model/types';
import { branchColorForIndex } from '@/layout/theme';
import type { OutlineNode } from './parseOutline';

function chooseRootBranchSide(
  sheet: Sheet,
  preferredSide: 'left' | 'right' = 'right',
): 'left' | 'right' {
  const root = sheet.topicsById[sheet.rootTopicId];
  if (!root) return preferredSide;

  const branchWeight = (topicId: TopicId): number => {
    const topic = sheet.topicsById[topicId];
    if (!topic) return 0;
    if (topic.collapsed) return 1;
    return 1 + topic.childrenIds.reduce((sum, childId) => sum + branchWeight(childId), 0);
  };

  let leftWeight = 0;
  let rightWeight = 0;

  for (const childId of root.childrenIds) {
    const child = sheet.topicsById[childId];
    if (child?.side === 'left') leftWeight += branchWeight(childId);
    else rightWeight += branchWeight(childId);
  }

  if (leftWeight < rightWeight) return 'left';
  if (rightWeight < leftWeight) return 'right';
  return preferredSide;
}

function buildSheetCommandCtx(draft: Sheet) {
  return {
    doc: {
      formatVersion: 1 as const,
      id: 'outline-session',
      title: draft.title,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      sheets: [draft.id],
      sheetsById: { [draft.id]: draft },
    },
    sheetId: draft.id,
  };
}

function insertChildWithTextInDraft(
  draft: Sheet,
  parentId: TopicId,
  text: string,
  themeId: string,
): TopicId | null {
  const parent = draft.topicsById[parentId];
  if (!parent) return null;

  const root = draft.topicsById[draft.rootTopicId];
  const nextRootBranchColor = () =>
    branchColorForIndex(root?.childrenIds.length ?? 0, themeId);
  const applyRootBranchColor = (topicId: TopicId, color: string) => {
    const topic = draft.topicsById[topicId];
    if (!topic) return;
    topic.style = { ...topic.style, branchColor: color };
  };

  if (parent.collapsed) parent.collapsed = false;

  const side =
    parent.id === draft.rootTopicId
      ? chooseRootBranchSide(draft, parent.side ?? 'right')
      : (parent.side ?? 'right');
  const branchColor =
    parent.id === draft.rootTopicId ? nextRootBranchColor() : parent.style?.branchColor;

  const insertedTopicId = addChild(buildSheetCommandCtx(draft), {
    parentId,
    text,
    side,
  });
  if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
  return insertedTopicId;
}

export function insertOutlineInDraft(
  draft: Sheet,
  parentId: TopicId,
  outline: OutlineNode[],
  themeId: string,
): TopicId | null {
  const parent = draft.topicsById[parentId];
  if (!parent || outline.length === 0) return null;

  if (parent.collapsed) parent.collapsed = false;

  let firstInsertedId: TopicId | null = null;

  const insertNode = (anchorId: TopicId, node: OutlineNode): TopicId | null => {
    const topicId = insertChildWithTextInDraft(draft, anchorId, node.text, themeId);
    if (!topicId) return null;

    if (!firstInsertedId) firstInsertedId = topicId;

    for (const child of node.children) {
      insertNode(topicId, child);
    }

    return topicId;
  };

  for (const root of outline) {
    insertNode(parentId, root);
  }

  return firstInsertedId;
}

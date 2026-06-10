import { produce } from 'immer';
import { useEffect, useMemo, useState } from 'react';
import { addChild, addSibling, deleteTopics } from '@/core/commands/commands';
import type { Sheet, TopicId } from '@/core/model/types';
import { createSampleDocument } from '@/demo/sampleDocument';
import { branchColorForIndex } from '@/layout/theme';
import { MindMapCanvas } from '@/view/canvas/MindMapCanvas';
import { Viewport } from '@/view/canvas/Viewport';
import { FloatingToolbar } from '@/view/toolbar/FloatingToolbar';

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

function nextSelectionAfterDelete(sheet: Sheet, topicId: TopicId): TopicId | null {
  const topic = sheet.topicsById[topicId];
  if (!topic || topic.id === sheet.rootTopicId) return topic?.id ?? null;

  if (!topic.parentId) return sheet.rootTopicId;

  const parent = sheet.topicsById[topic.parentId];
  if (!parent) return sheet.rootTopicId;

  const index = parent.childrenIds.indexOf(topicId);
  if (index === -1) return parent.id;

  return parent.childrenIds[index + 1] ?? parent.childrenIds[index - 1] ?? parent.id;
}

export function App() {
  const initialDoc = useMemo(() => createSampleDocument(), []);
  const sheetId = initialDoc.sheets[0]!;

  const [sheet, setSheet] = useState<Sheet>(
    () => {
      const initialSheet = structuredClone(initialDoc.sheetsById[sheetId]!);
      const root = initialSheet.topicsById[initialSheet.rootTopicId];

      for (const [index, childId] of (root?.childrenIds ?? []).entries()) {
        const child = initialSheet.topicsById[childId];
        if (!child) continue;

        child.style = {
          ...child.style,
          branchColor: child.style?.branchColor ?? branchColorForIndex(index),
        };
        if (child.childrenIds.length) child.collapsed = true;
      }

      return initialSheet;
    },
  );
  const [selectedTopicId, setSelectedTopicId] = useState<TopicId | null>('b2');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedTopicId || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Delete') return;

      event.preventDefault();

      if (event.key === 'Delete') {
        const selectedTopic = sheet.topicsById[selectedTopicId];
        if (!selectedTopic) return;
        if (selectedTopic.id === sheet.rootTopicId) {
          setSelectedTopicId(selectedTopic.id);
          return;
        }

        const nextSelectedTopicId = nextSelectionAfterDelete(sheet, selectedTopicId);

        setSheet((current) =>
          produce(current, (draft) => {
            if (!draft.topicsById[selectedTopicId]) return;

            const doc = {
              formatVersion: 1 as const,
              id: 'keyboard-session',
              title: draft.title,
              createdAt: Date.now(),
              modifiedAt: Date.now(),
              sheets: [draft.id],
              sheetsById: { [draft.id]: draft },
            };
            const ctx = { doc, sheetId: draft.id };
            deleteTopics(ctx, { topicIds: [selectedTopicId] });
          }),
        );

        setSelectedTopicId(nextSelectedTopicId);
        return;
      }

      let insertedTopicId: TopicId | null = null;
      setSheet((current) =>
        produce(current, (draft) => {
          const selectedTopic = draft.topicsById[selectedTopicId];
          if (!selectedTopic) return;

          const root = draft.topicsById[draft.rootTopicId];
          const nextRootBranchColor = () =>
            branchColorForIndex(root?.childrenIds.length ?? 0);
          const applyRootBranchColor = (topicId: TopicId, color: string) => {
            const topic = draft.topicsById[topicId];
            if (!topic) return;
            topic.style = {
              ...topic.style,
              branchColor: color,
            };
          };

          const doc = {
            formatVersion: 1 as const,
            id: 'keyboard-session',
            title: draft.title,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            sheets: [draft.id],
            sheetsById: { [draft.id]: draft },
          };
          const ctx = { doc, sheetId: draft.id };

          if (event.key === 'Tab') {
            if (selectedTopic.collapsed) selectedTopic.collapsed = false;
            const side =
              selectedTopic.id === draft.rootTopicId
                ? chooseRootBranchSide(draft, selectedTopic.side ?? 'right')
                : selectedTopic.side;
            const branchColor =
              selectedTopic.id === draft.rootTopicId
                ? nextRootBranchColor()
                : selectedTopic.style?.branchColor;

            insertedTopicId = addChild(ctx, {
              parentId: selectedTopicId,
              text: 'New Topic',
              side,
            });
            if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
            return;
          }

          if (selectedTopic.parentId) {
            const parent = draft.topicsById[selectedTopic.parentId];
            const side =
              parent?.id === draft.rootTopicId
                ? chooseRootBranchSide(draft, selectedTopic.side ?? 'right')
                : selectedTopic.side;
            const branchColor =
              parent?.id === draft.rootTopicId
                ? nextRootBranchColor()
                : selectedTopic.style?.branchColor;

            insertedTopicId = addSibling(ctx, {
              topicId: selectedTopicId,
              text: 'New Topic',
            });
            const insertedTopic = draft.topicsById[insertedTopicId];
            if (insertedTopic) insertedTopic.side = side;
            if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
          } else {
            const branchColor = nextRootBranchColor();
            const side = chooseRootBranchSide(draft, 'right');
            insertedTopicId = addChild(ctx, {
              parentId: selectedTopicId,
              text: 'New Topic',
              side,
            });
            applyRootBranchColor(insertedTopicId, branchColor);
          }
        }),
      );

      if (insertedTopicId) setSelectedTopicId(insertedTopicId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTopicId, sheet]);

  const toggleCollapse = (topicId: TopicId) => {
    setSheet((current) =>
      produce(current, (draft) => {
        const topic = draft.topicsById[topicId];
        if (topic) topic.collapsed = !topic.collapsed;
      }),
    );
  };

  return (
    <main className="app">
      <FloatingToolbar selectedTopicId={selectedTopicId} />
      <Viewport
        initialViewport={{ x: window.innerWidth / 2 - 64, y: window.innerHeight / 2, zoom: 1 }}
      >
        <MindMapCanvas
          sheet={sheet}
          selectedTopicId={selectedTopicId}
          onSelectTopic={setSelectedTopicId}
          onToggleCollapse={toggleCollapse}
        />
      </Viewport>
    </main>
  );
}

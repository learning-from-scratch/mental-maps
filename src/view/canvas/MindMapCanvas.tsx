import { useCallback, useMemo, useState } from 'react';
import type { Sheet, TopicId } from '@/core/model/types';
import { collectDescendantIds } from '@/core/commands/tree';
import { layoutSheet } from '@/layout';
import { DEFAULT_MAP_THEME_ID } from '@/layout/theme';
import { EdgeLayer } from '@/view/edge/EdgeLayer';
import { CollapseHandle } from '@/view/topic/CollapseHandle';
import { TopicView } from '@/view/topic/TopicView';

interface MindMapCanvasProps {
  sheet: Sheet;
  selectedTopicId: TopicId | null;
  /** Active map theme id — included so layout (edge colors) recomputes on change. */
  themeId?: string;
  onSelectTopic: (topicId: TopicId) => void;
  onTopicTextChange: (topicId: TopicId, text: string) => void;
  onInsertChild: (topicId: TopicId, pendingText?: string) => void;
  onInsertSibling: (topicId: TopicId, pendingText?: string) => void;
  onOpenNotesPanel: (topicId: TopicId) => void;
  onToggleCollapse: (topicId: TopicId) => void;
}

export function MindMapCanvas({
  sheet,
  selectedTopicId,
  themeId = DEFAULT_MAP_THEME_ID,
  onSelectTopic,
  onTopicTextChange,
  onInsertChild,
  onInsertSibling,
  onOpenNotesPanel,
  onToggleCollapse,
}: MindMapCanvasProps) {
  const [liveEdit, setLiveEdit] = useState<{ topicId: TopicId; text: string } | null>(null);

  const handleLiveTextChange = useCallback((topicId: TopicId, text: string | null) => {
    setLiveEdit(text === null ? null : { topicId, text });
  }, []);

  const layoutSheetInput = useMemo(() => {
    if (!liveEdit) return sheet;

    const topic = sheet.topicsById[liveEdit.topicId];
    if (!topic) return sheet;

    return {
      ...sheet,
      topicsById: {
        ...sheet.topicsById,
        [liveEdit.topicId]: { ...topic, text: liveEdit.text },
      },
    };
  }, [sheet, liveEdit]);

  const layout = useMemo(
    () => layoutSheet(layoutSheetInput, liveEdit?.topicId, themeId),
    [layoutSheetInput, themeId, liveEdit?.topicId],
  );

  const topicNodes = useMemo(
    () => Array.from(layout.nodes.entries()),
    [layout.nodes],
  );

  const collapseHandles = useMemo(() => {
    return topicNodes
      .map(([topicId, nodeLayout]) => {
        const topic = sheet.topicsById[topicId];
        if (!topic || topic.childrenIds.length === 0 || nodeLayout.depth !== 1) return null;

        const descendantCount = collectDescendantIds(sheet, topicId).length;

        return {
          topicId,
          nodeLayout,
          topic,
          descendantCount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [sheet, topicNodes]);

  const localOffset = {
    x: -layout.bounds.x,
    y: -layout.bounds.y,
  };
  const rootLayout = layout.nodes.get(sheet.rootTopicId);
  return (
    <div
      className="mindmap-canvas"
      style={{
        left: layout.bounds.x,
        top: layout.bounds.y,
        width: layout.bounds.width,
        height: layout.bounds.height,
      }}
    >
      <EdgeLayer
        edges={layout.edges}
        bounds={layout.bounds}
        rootExclusion={rootLayout}
      />
      <div
        className="mindmap-canvas__topics"
        style={{
          transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
        }}
      >
        {topicNodes.map(([topicId, nodeLayout]) => (
          <TopicView
            key={topicId}
            topicId={topicId}
            text={sheet.topicsById[topicId]?.text ?? ''}
            notes={sheet.topicsById[topicId]?.notes}
            layout={nodeLayout}
            themeId={themeId}
            selected={topicId === selectedTopicId}
            onSelect={onSelectTopic}
            onTextChange={onTopicTextChange}
            onLiveTextChange={handleLiveTextChange}
            onInsertChild={onInsertChild}
            onInsertSibling={onInsertSibling}
            onOpenNotes={onOpenNotesPanel}
          />
        ))}
        {collapseHandles.map(({ topicId, nodeLayout, topic, descendantCount }) => (
          <CollapseHandle
            key={`collapse-${topicId}`}
            collapsed={topic.collapsed}
            descendantCount={descendantCount}
            side={nodeLayout.side}
            top={nodeLayout.y}
            left={nodeLayout.x}
            width={nodeLayout.width}
            height={nodeLayout.height}
            branchIndex={nodeLayout.branchIndex}
            themeId={themeId}
            onToggle={() => onToggleCollapse(topicId)}
          />
        ))}
      </div>
    </div>
  );
}

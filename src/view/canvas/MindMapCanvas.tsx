import { useMemo } from 'react';
import type { Sheet, TopicId } from '@/core/model/types';
import { collectDescendantIds } from '@/core/commands/tree';
import { layoutSheet } from '@/layout';
import { EdgeLayer } from '@/view/edge/EdgeLayer';
import { CollapseHandle } from '@/view/topic/CollapseHandle';
import { TopicView } from '@/view/topic/TopicView';

interface MindMapCanvasProps {
  sheet: Sheet;
  selectedTopicId: TopicId | null;
  onSelectTopic: (topicId: TopicId) => void;
  onToggleCollapse: (topicId: TopicId) => void;
}

export function MindMapCanvas({
  sheet,
  selectedTopicId,
  onSelectTopic,
  onToggleCollapse,
}: MindMapCanvasProps) {
  const layout = useMemo(() => layoutSheet(sheet), [sheet]);

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
            layout={nodeLayout}
            selected={topicId === selectedTopicId}
            onSelect={onSelectTopic}
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
            onToggle={() => onToggleCollapse(topicId)}
          />
        ))}
      </div>
    </div>
  );
}

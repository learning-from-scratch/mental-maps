import type { CSSProperties } from 'react';
import type { TopicId } from '@/core/model/types';
import { getBranchTheme } from '@/layout/theme';
import type { NodeLayout } from '@/layout/types';

interface TopicViewProps {
  topicId: TopicId;
  layout: NodeLayout;
  selected?: boolean;
  onSelect?: (topicId: TopicId) => void;
}

export function TopicView({
  topicId,
  layout,
  selected = false,
  onSelect,
}: TopicViewProps) {
  const isRoot = layout.depth === 0;
  const isMain = layout.depth === 1;
  const isChild = layout.depth >= 2;
  const branch = getBranchTheme(layout.branchIndex);

  const className = [
    'topic-view',
    isRoot && 'topic-view--root',
    isMain && 'topic-view--main',
    isChild && 'topic-view--child',
    selected && 'topic-view--selected',
  ]
    .filter(Boolean)
    .join(' ');

  const style: CSSProperties = {
    left: layout.x,
    top: layout.y,
    width: layout.width,
    height: layout.height,
    fontSize: layout.fontSize,
    lineHeight: `${layout.lineHeight}px`,
    ...(isMain
      ? {
          backgroundColor: branch.color,
          color: branch.textOnMain,
          borderColor: branch.color,
        }
      : {}),
    ...(isRoot
      ? {
          backgroundColor: '#f7f7f8',
          boxShadow: 'none',
        }
      : {}),
    ...(isChild
      ? {
          backgroundColor: branch.light,
          borderColor: branch.color,
          color: '#2d2d2d',
        }
      : {}),
    ...(selected && !isRoot
      ? {
          boxShadow: isMain
            ? `0 0 0 1px rgba(255,255,255,0.9), 0 0 0 7px rgba(40,191,242,0.2), 0 7px 18px rgba(22,79,112,0.18)`
            : `0 0 0 1px rgba(255,255,255,0.95), 0 0 0 6px rgba(40,191,242,0.2), 0 5px 14px rgba(22,79,112,0.14)`,
        }
      : {}),
  };

  return (
    <div
      className={className}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(topicId);
      }}
    >
      <div className="topic-view__content">
        <div className="topic-view__text">
          {layout.lines.map((line, index) => (
            <div key={index} className="topic-view__line">
              {line}
            </div>
          ))}
        </div>
        {isMain && <span className="topic-view__menu" aria-hidden="true">≡</span>}
      </div>
    </div>
  );
}

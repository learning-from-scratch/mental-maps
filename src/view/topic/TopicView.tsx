import { AlignLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { topicHasNotes } from '@/core/model/notes';
import type { TopicId } from '@/core/model/types';
import { getBranchTheme } from '@/layout/theme';
import type { NodeLayout } from '@/layout/types';
import { appIcon } from '@/view/icons';

interface TopicViewProps {
  topicId: TopicId;
  text: string;
  notes?: string;
  layout: NodeLayout;
  selected?: boolean;
  onSelect?: (topicId: TopicId) => void;
  onTextChange?: (topicId: TopicId, text: string) => void;
  onOpenNotes?: (topicId: TopicId) => void;
}

export function TopicView({
  topicId,
  text,
  notes,
  layout,
  selected = false,
  onSelect,
  onTextChange,
  onOpenNotes,
}: TopicViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const draftTextRef = useRef(draftText);
  draftTextRef.current = draftText;

  const commitEdit = useCallback(() => {
    setIsEditing((editing) => {
      if (!editing) return false;
      const nextText = draftTextRef.current.trim() || text;
      if (nextText !== text) onTextChange?.(topicId, nextText);
      return false;
    });
  }, [text, topicId, onTextChange]);

  useEffect(() => {
    if (!isEditing) setDraftText(text);
  }, [text, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.select();
  }, [isEditing]);

  useEffect(() => {
    if (!selected && isEditing) commitEdit();
  }, [selected, isEditing, commitEdit]);

  useEffect(() => {
    if (!selected || isEditing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Delete') return;

      if (event.key === 'Backspace') {
        event.preventDefault();
        setDraftText('');
        setIsEditing(true);
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        setDraftText(event.key);
        setIsEditing(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, isEditing]);

  const hasNotes = topicHasNotes(notes);
  const isRoot = layout.depth === 0;
  const isMain = layout.depth === 1;
  const isLevel2 = layout.depth === 2;
  const isDeepChild = layout.depth >= 3;
  const branch = getBranchTheme(layout.branchIndex);

  const className = [
    'topic-view',
    isRoot && 'topic-view--root',
    isMain && 'topic-view--main',
    isLevel2 && 'topic-view--child',
    isDeepChild && 'topic-view--deep',
    selected && 'topic-view--selected',
  ]
    .filter(Boolean)
    .join(' ');

  const cancelEdit = () => {
    setDraftText(text);
    setIsEditing(false);
  };

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
          backgroundColor: 'transparent',
          boxShadow: 'none',
        }
      : {}),
    ...(isLevel2
      ? {
          backgroundColor: branch.light,
          borderColor: branch.color,
          color: '#2d2d2d',
        }
      : {}),
    ...(isDeepChild
      ? {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          color: '#2d2d2d',
        }
      : {}),
    ...(selected && !isRoot
      ? {
          outline: 'none',
          boxShadow: `0 0 0 1px rgba(255,255,255,0.95), 0 0 0 3px ${branch.color}`,
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
        if (!isEditing) onSelect?.(topicId);
      }}
    >
      <div className="topic-view__content">
        {isEditing ? (
          <textarea
            ref={editorRef}
            className="topic-view__editor"
            value={draftText}
            rows={layout.lines.length}
            onChange={(event) => setDraftText(event.target.value)}
            onBlur={commitEdit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                commitEdit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        ) : (
          <div className="topic-view__text">
            {layout.lines.map((line, index) => (
              <div key={index} className="topic-view__line">
                {line}
              </div>
            ))}
          </div>
        )}
        {hasNotes && !isEditing && !isRoot && (
          <button
            type="button"
            className="topic-view__notes-button"
            aria-label="Open notes"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(topicId);
              onOpenNotes?.(topicId);
            }}
          >
            <AlignLeft {...appIcon('topic-view__notes-icon')} />
          </button>
        )}
      </div>
    </div>
  );
}

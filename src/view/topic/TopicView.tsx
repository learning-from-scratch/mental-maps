import { AlignLeft } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { topicHasNotes } from '@/core/model/notes';
import type { TopicId } from '@/core/model/types';
import { horizontalPadForDepth, measureTopicForEdit } from '@/layout/measure';
import { DEFAULT_MAP_THEME_ID, getBranchTheme } from '@/layout/theme';
import type { NodeLayout } from '@/layout/types';
import { appIcon } from '@/view/icons';

interface TopicViewProps {
  topicId: TopicId;
  text: string;
  notes?: string;
  layout: NodeLayout;
  themeId?: string;
  selected?: boolean;
  autoFocusEdit?: boolean;
  onAutoFocusEditConsumed?: () => void;
  onEditingChange?: (editing: boolean) => void;
  onSelect?: (topicId: TopicId) => void;
  onTextChange?: (topicId: TopicId, text: string) => void;
  onLiveTextChange?: (topicId: TopicId, text: string | null) => void;
  onOpenNotes?: (topicId: TopicId) => void;
}

export function TopicView({
  topicId,
  text,
  notes,
  layout,
  themeId = DEFAULT_MAP_THEME_ID,
  selected = false,
  autoFocusEdit = false,
  onAutoFocusEditConsumed,
  onEditingChange,
  onSelect,
  onTextChange,
  onLiveTextChange,
  onOpenNotes,
}: TopicViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [editWidthExtra, setEditWidthExtra] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const draftTextRef = useRef(draftText);
  const isEditingRef = useRef(isEditing);
  draftTextRef.current = draftText;
  isEditingRef.current = isEditing;

  const commitEdit = useCallback(() => {
    if (!isEditingRef.current) return;
    const nextText = draftTextRef.current.trim() || text;
    isEditingRef.current = false;
    setIsEditing(false);
    onEditingChange?.(false);
    if (nextText !== text) onTextChange?.(topicId, nextText);
  }, [text, topicId, onTextChange, onEditingChange]);

  useEffect(() => {
    if (!isEditing) setDraftText(text);
  }, [text, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      onLiveTextChange?.(topicId, null);
      return;
    }
    onLiveTextChange?.(topicId, draftText);
  }, [isEditing, draftText, topicId, onLiveTextChange]);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  const selectAllOnEditRef = useRef(false);

  useLayoutEffect(() => {
    if (!autoFocusEdit || !selected || isEditing) return;
    setDraftText(text);
    selectAllOnEditRef.current = true;
    setIsEditing(true);
  }, [autoFocusEdit, selected, isEditing, text]);

  useLayoutEffect(() => {
    if (!autoFocusEdit || !isEditing) return;
    onAutoFocusEditConsumed?.();
  }, [autoFocusEdit, isEditing, onAutoFocusEditConsumed]);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (selectAllOnEditRef.current) {
      selectAllOnEditRef.current = false;
      editor.setSelectionRange(0, editor.value.length);
      return;
    }
    const end = editor.value.length;
    editor.setSelectionRange(end, end);
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
  const branch = getBranchTheme(layout.branchIndex, themeId);

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
    isEditingRef.current = false;
    setIsEditing(false);
    onEditingChange?.(false);
  };

  const editMeasurement = useMemo(() => {
    if (!isEditing) return null;
    return measureTopicForEdit(draftText, layout.depth, undefined);
  }, [isEditing, draftText, layout.depth]);

  const measuredEditWidth = editMeasurement?.width ?? layout.width;
  const boxWidth = measuredEditWidth + editWidthExtra;
  const boxHeight = editMeasurement?.height ?? layout.height;
  const boxLineHeight = editMeasurement?.lineHeight ?? layout.lineHeight;
  const isSingleLineEdit =
    isEditing && (editMeasurement?.lines.length ?? 1) === 1 && !draftText.includes('\n');

  useLayoutEffect(() => {
    if (!isEditing) {
      setEditWidthExtra(0);
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    editor.scrollLeft = 0;
    editor.scrollTop = 0;

    const padX = horizontalPadForDepth(layout.depth);
    const neededOuter = editor.scrollWidth + padX * 2;
    setEditWidthExtra(Math.max(0, neededOuter - measuredEditWidth));

    if (!isSingleLineEdit) {
      editor.style.height = 'auto';
      editor.style.height = `${editor.scrollHeight}px`;
    }
  }, [isEditing, isSingleLineEdit, draftText, measuredEditWidth, boxHeight, layout.depth]);

  const style: CSSProperties = {
    left: layout.x,
    top: layout.y,
    width: boxWidth,
    height: boxHeight,
    fontSize: layout.fontSize,
    lineHeight: `${boxLineHeight}px`,
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
      className={`${className}${isEditing ? ' topic-view--editing' : ''}`}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (!isEditing) onSelect?.(topicId);
      }}
    >
      <div className={`topic-view__content${isEditing ? ' topic-view__content--editing' : ''}`}>
        {isEditing ? (
          <textarea
            ref={editorRef}
            className={`topic-view__editor${
              isSingleLineEdit ? ' topic-view__editor--single-line' : ''
            }`}
            value={draftText}
            rows={isSingleLineEdit ? 1 : Math.max(editMeasurement?.lines.length ?? 1, 1)}
            wrap={isSingleLineEdit ? 'off' : 'soft'}
            onChange={(event) => setDraftText(event.target.value)}
            onBlur={commitEdit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
                event.preventDefault();
                commitEdit();
                editorRef.current?.blur();
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

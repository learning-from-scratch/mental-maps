import { AlignLeft, Cloud, ExternalLink, MoreHorizontal } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { getTopicAttachmentIndicator } from '@/core/model/attachments';
import {
  equationPlacement,
  equationScale,
  equationLayoutAreaStyle,
  textLayoutAreaStyle,
  topicHasEquation,
  topicHasVisibleText,
  topicIsEquationOnly,
} from '@/core/model/equation';
import { topicHasLabels } from '@/core/model/labels';
import { topicLinkKind, type TopicLink } from '@/core/model/link';
import type { TopicEquation, TopicId } from '@/core/model/types';
import { TopicAttachmentsMenu } from '@/view/topic/TopicAttachmentsMenu';
import { TopicEquationDisplay } from '@/view/topic/TopicEquationDisplay';
import type { EquationDragOverlay } from '@/view/topic/equationDropTarget';
import { TopicEquationGrid } from '@/view/topic/TopicEquationGrid';
import { renderLatex } from '@/lib/katexRender';
import { horizontalPadForDepth, measureTopic, measureTopicForEdit } from '@/layout/measure';
import { DEFAULT_MAP_THEME_ID, getBranchTheme } from '@/layout/theme';
import type { NodeLayout } from '@/layout/types';
import { appIcon } from '@/view/icons';

function caretOffsetFromStaticText(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): number | null {
  const doc = document;
  const range =
    doc.caretRangeFromPoint?.(clientX, clientY) ??
    (() => {
      const position = doc.caretPositionFromPoint?.(clientX, clientY);
      if (!position) return null;
      const next = doc.createRange();
      next.setStart(position.offsetNode, position.offset);
      next.setEnd(position.offsetNode, position.offset);
      return next;
    })();

  if (!range || !container.contains(range.startContainer)) return null;

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (node === range.startContainer) {
      return offset + range.startOffset;
    }
    offset += node.length;
    node = walker.nextNode() as Text | null;
  }

  return null;
}

interface TopicViewProps {
  topicId: TopicId;
  text: string;
  notes?: string;
  link?: TopicLink;
  equation?: TopicEquation;
  labels?: string[];
  layout: NodeLayout;
  themeId?: string;
  selected?: boolean;
  autoFocusEdit?: boolean;
  onAutoFocusEditConsumed?: () => void;
  onEditingChange?: (editing: boolean) => void;
  onSelect?: (topicId: TopicId) => void;
  onTextChange?: (topicId: TopicId, text: string) => void;
  onInsertChildAfterEdit?: (topicId: TopicId, text: string) => void;
  onInsertSiblingAfterEdit?: (topicId: TopicId, text: string) => void;
  onLiveTextChange?: (topicId: TopicId, text: string | null) => void;
  onOpenNotes?: (topicId: TopicId) => void;
  onOpenLabels?: (topicId: TopicId) => void;
  onOpenLink?: (topicId: TopicId, url: string) => void;
  onOpenWebLinkEditor?: (topicId: TopicId) => void;
  onDeleteNote?: (topicId: TopicId) => void;
  onDeleteLink?: (topicId: TopicId) => void;
  equationSelected?: boolean;
  onEquationSelect?: (topicId: TopicId) => void;
  onEquationDeselect?: () => void;
  onOpenEquationEditor?: (topicId: TopicId) => void;
  onEquationScaleChange?: (topicId: TopicId, scale: number) => void;
  onLiveEquationScaleChange?: (topicId: TopicId, scale: number | null) => void;
  onEquationDragMove?: (topicId: TopicId, clientX: number, clientY: number) => void;
  onEquationDragEnd?: (topicId: TopicId, clientX: number, clientY: number) => void;
  equationDragOverlay?: EquationDragOverlay | null;
  onDeleteEquation?: (topicId: TopicId) => void;
  onDismissTopicPanels?: () => void;
  showsCollapseHandle?: boolean;
  onCollapseHandleHoverChange?: (hovered: boolean) => void;
}

export function TopicView({
  topicId,
  text,
  notes,
  link,
  equation,
  labels = [],
  layout,
  themeId = DEFAULT_MAP_THEME_ID,
  selected = false,
  autoFocusEdit = false,
  onAutoFocusEditConsumed,
  onEditingChange,
  onSelect,
  onTextChange,
  onInsertChildAfterEdit,
  onInsertSiblingAfterEdit,
  onLiveTextChange,
  onOpenNotes,
  onOpenLabels,
  onOpenLink,
  onOpenWebLinkEditor,
  onDeleteNote,
  onDeleteLink,
  equationSelected = false,
  onEquationSelect,
  onEquationDeselect,
  onOpenEquationEditor,
  onEquationScaleChange,
  onLiveEquationScaleChange,
  onEquationDragMove,
  onEquationDragEnd,
  equationDragOverlay = null,
  onDeleteEquation,
  onDismissTopicPanels,
  showsCollapseHandle = false,
  onCollapseHandleHoverChange,
}: TopicViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [attachmentsMenuOpen, setAttachmentsMenuOpen] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [editWidthExtra, setEditWidthExtra] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dropTargetRef = useRef<HTMLDivElement>(null);
  const editCaretRef = useRef<number | null>(null);
  const draftTextRef = useRef(draftText);
  const isEditingRef = useRef(isEditing);
  draftTextRef.current = draftText;
  isEditingRef.current = isEditing;

  const commitEdit = useCallback(() => {
    if (!isEditingRef.current) return;
    const nextText = draftTextRef.current.trim();
    isEditingRef.current = false;
    setIsEditing(false);
    onEditingChange?.(false);
    if (nextText !== text) onTextChange?.(topicId, nextText);
  }, [text, topicId, onTextChange, onEditingChange]);

  const commitTextForInsert = useCallback(() => {
    return draftTextRef.current.trim();
  }, []);

  const finishEditAndInsert = useCallback(
    (insert: ((topicId: TopicId, text: string) => void) | undefined) => {
      if (!insert) return;
      const nextText = commitTextForInsert();
      isEditingRef.current = false;
      setIsEditing(false);
      onEditingChange?.(false);
      insert(topicId, nextText);
    },
    [commitTextForInsert, onEditingChange, topicId],
  );

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

  useEffect(() => {
    if (!selected) setAttachmentsMenuOpen(false);
  }, [selected]);

  const selectAllOnEditRef = useRef(false);

  const beginEdit = useCallback(
    (options?: { selectAll?: boolean; caretIndex?: number }) => {
      onSelect?.(topicId);
      onDismissTopicPanels?.();
      setAttachmentsMenuOpen(false);
      setDraftText(text);
      selectAllOnEditRef.current = options?.selectAll ?? false;
      editCaretRef.current = options?.caretIndex ?? null;
      setIsEditing(true);
    },
    [topicId, text, onSelect, onDismissTopicPanels],
  );

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
    const caret = editCaretRef.current;
    editCaretRef.current = null;
    if (caret != null) {
      const index = Math.max(0, Math.min(caret, editor.value.length));
      editor.setSelectionRange(index, index);
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

  const hasEquation = topicHasEquation(equation);
  const hasVisibleText = topicHasVisibleText(text);
  const equationOnly = topicIsEquationOnly(text, equation);
  const showSplitLayout = hasEquation && (hasVisibleText || isEditing);
  const eqPlacement = equationPlacement(equation);
  const equationLayoutStyle = useMemo(() => equationLayoutAreaStyle(), []);
  const textLayoutStyle = useMemo(() => textLayoutAreaStyle(), []);
  const equationReadOnlyHtml = useMemo(() => {
    if (!equation?.latex) return null;
    const rendered = renderLatex(equation.latex);
    return rendered.ok ? rendered.html : null;
  }, [equation?.latex]);
  const isEquationDragHover = equationDragOverlay?.targetTopicId === topicId;
  const showEquationDragGrid = isEquationDragHover;
  const showEquationDragGhost =
    isEquationDragHover && Boolean(equationDragOverlay?.canDrop);
  const isEquationDragSource =
    equationDragOverlay?.sourceTopicId === topicId &&
    equationDragOverlay.targetTopicId !== topicId;
  const equationDragGhostHtml = useMemo(() => {
    if (!showEquationDragGhost || !equationDragOverlay) return null;
    const rendered = renderLatex(equationDragOverlay.equation.latex);
    return rendered.ok ? rendered.html : null;
  }, [equationDragOverlay, showEquationDragGhost]);
  const equationDragGhostStyle = useMemo((): CSSProperties | null => {
    if (!showEquationDragGhost || !equationDragOverlay) return null;
    const dropTarget = dropTargetRef.current;
    if (!dropTarget) return null;
    const rect = dropTarget.getBoundingClientRect();
    return {
      left: equationDragOverlay.clientX - rect.left,
      top: equationDragOverlay.clientY - rect.top,
      transform: 'translate(-50%, -50%)',
      fontSize: `${equationScale(equationDragOverlay.equation)}em`,
    };
  }, [equationDragOverlay, showEquationDragGhost]);
  const attachmentIndicator = getTopicAttachmentIndicator(notes, link);
  const linkKind = topicLinkKind(link);
  const hasLabels = topicHasLabels(labels);
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
    if (hasEquation && equation) {
      return measureTopic(draftText, layout.depth, undefined, false, equation);
    }
    return measureTopicForEdit(draftText, layout.depth, undefined);
  }, [isEditing, hasEquation, equation, draftText, layout.depth]);

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

  const wrapClassName = [
    'topic-view-wrap',
    hasLabels && 'topic-view-wrap--has-labels',
    selected && 'topic-view-wrap--selected',
  ]
    .filter(Boolean)
    .join(' ');

  const handleCollapseHoverLeave = (relatedTarget: EventTarget | null) => {
    if (!showsCollapseHandle) return;
    const related = relatedTarget as HTMLElement | null;
    if (related?.closest(`[data-collapse-topic="${topicId}"]`)) return;
    onCollapseHandleHoverChange?.(false);
  };

  const style: CSSProperties = {
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
      className={wrapClassName}
      data-collapse-topic={showsCollapseHandle ? topicId : undefined}
      style={{ left: layout.x, top: layout.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={() => {
        if (showsCollapseHandle) onCollapseHandleHoverChange?.(true);
      }}
      onPointerLeave={(event) => handleCollapseHoverLeave(event.relatedTarget)}
    >
      <div
        ref={dropTargetRef}
        data-equation-drop-target
        data-topic-id={topicId}
        className={`${className}${isEditing ? ' topic-view--editing' : ''}${showEquationDragGrid || isEquationDragSource ? ' topic-view--equation-dragging' : ''}`}
        style={style}
        onClick={(event) => {
          event.stopPropagation();
          if (!isEditing) {
            onEquationDeselect?.();
            onSelect?.(topicId);
          }
        }}
      >
        {showEquationDragGrid ? (
          <TopicEquationGrid
            highlightZone={equationDragOverlay?.snap ?? null}
            variant={equationDragOverlay?.gridVariant ?? 'single'}
          />
        ) : null}
        {showEquationDragGhost && equationDragGhostHtml && equationDragGhostStyle ? (
          <div
            className="topic-view__equation-ghost"
            style={equationDragGhostStyle}
            aria-hidden
          >
            <span
              className="topic-view__equation-math"
              dangerouslySetInnerHTML={{ __html: equationDragGhostHtml }}
            />
          </div>
        ) : null}
      <div
        ref={contentRef}
        className={`topic-view__content${isEditing ? ' topic-view__content--editing' : ''}${showSplitLayout ? ` topic-view__content--has-equation topic-view__content--grid topic-view__content--eq-${eqPlacement}` : ''}${equationOnly && !isEditing ? ' topic-view__content--equation-only' : ''}`}
        onDoubleClick={(event) => {
          if (isEditing || isRoot || equationSelected) return;
          if (event.target instanceof HTMLElement && event.target.closest('.topic-view__text')) {
            return;
          }
          if (!hasEquation) return;
          event.stopPropagation();
          event.preventDefault();
          beginEdit({ caretIndex: 0 });
        }}
      >
        {hasEquation && equation && isEditing && equationReadOnlyHtml ? (
          <div
            className={`topic-view__equation topic-view__equation--grid topic-view__equation--readonly${showSplitLayout ? '' : ' topic-view__equation--solo'}`}
            style={{
              ...(showSplitLayout ? equationLayoutStyle : undefined),
              fontSize: `${equationScale(equation)}em`,
            }}
            aria-hidden
          >
            <span
              className="topic-view__equation-math"
              dangerouslySetInnerHTML={{ __html: equationReadOnlyHtml }}
            />
          </div>
        ) : null}
        {hasEquation && equation && !isEditing ? (
          <TopicEquationDisplay
            equation={equation}
            topicSelected={selected}
            selected={equationSelected}
            contentRef={dropTargetRef}
            onTopicSelect={() => onSelect?.(topicId)}
            onEquationActivate={() => onEquationSelect?.(topicId)}
            onOpenEditor={() => onOpenEquationEditor?.(topicId)}
            onScaleChange={(scale) => onEquationScaleChange?.(topicId, scale)}
            onLiveScaleChange={(scale) => onLiveEquationScaleChange?.(topicId, scale)}
            onDragMove={(clientX, clientY) => onEquationDragMove?.(topicId, clientX, clientY)}
            onDragEnd={(clientX, clientY) => onEquationDragEnd?.(topicId, clientX, clientY)}
            onDelete={() => onDeleteEquation?.(topicId)}
            onDeselect={() => onEquationDeselect?.()}
            gridStyle={showSplitLayout ? equationLayoutStyle : undefined}
          />
        ) : null}
        {isEditing ? (
          hasEquation && showSplitLayout ? (
            <div className="topic-view__text-cell topic-view__text-cell--editing" style={textLayoutStyle}>
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
                  if (event.key === 'Tab') {
                    event.preventDefault();
                    finishEditAndInsert(onInsertChildAfterEdit);
                  } else if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    finishEditAndInsert(onInsertSiblingAfterEdit);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              />
            </div>
          ) : (
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
              if (event.key === 'Tab') {
                event.preventDefault();
                finishEditAndInsert(onInsertChildAfterEdit);
              } else if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                finishEditAndInsert(onInsertSiblingAfterEdit);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          />
          )
        ) : hasEquation && hasVisibleText ? (
          <div className="topic-view__text-cell" style={textLayoutStyle}>
            <div
              ref={textRef}
              className="topic-view__text"
              onDoubleClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                const caretIndex = textRef.current
                  ? caretOffsetFromStaticText(textRef.current, event.clientX, event.clientY)
                  : null;
                beginEdit({
                  caretIndex: caretIndex ?? text.length,
                });
              }}
            >
              {layout.lines.map((line, index) => (
                <div key={index} className="topic-view__line">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : !hasEquation ? (
          <div
            ref={textRef}
            className="topic-view__text"
            onDoubleClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              const caretIndex = textRef.current
                ? caretOffsetFromStaticText(textRef.current, event.clientX, event.clientY)
                : null;
              beginEdit({
                caretIndex: caretIndex ?? text.length,
              });
            }}
          >
            {layout.lines.map((line, index) => (
              <div key={index} className="topic-view__line">
                {line}
              </div>
            ))}
          </div>
        ) : null}
        {attachmentIndicator !== 'none' && !isEditing && !isRoot && !hasEquation ? (
          <button
            type="button"
            className={`topic-view__attachment-button${
              attachmentIndicator === 'multiple' ? ' topic-view__attachment-button--multiple' : ''
            }`}
            aria-label={
              attachmentIndicator === 'multiple'
                ? 'View attachments'
                : attachmentIndicator === 'link'
                  ? linkKind === 'cloud'
                    ? 'Open cloud storage link'
                    : 'Open webpage link'
                  : 'Open notes'
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(topicId);
              if (attachmentIndicator === 'multiple') {
                setAttachmentsMenuOpen((open) => {
                  if (!open) onDismissTopicPanels?.();
                  return !open;
                });
                return;
              }
              if (attachmentIndicator === 'notes') {
                onOpenNotes?.(topicId);
                return;
              }
              if (link?.url) onOpenLink?.(topicId, link.url);
            }}
          >
            {attachmentIndicator === 'multiple' ? (
              <MoreHorizontal {...appIcon('topic-view__attachment-icon')} />
            ) : attachmentIndicator === 'link' ? (
              linkKind === 'cloud' ? (
                <Cloud {...appIcon('topic-view__attachment-icon')} />
              ) : (
                <ExternalLink {...appIcon('topic-view__attachment-icon')} />
              )
            ) : (
              <AlignLeft {...appIcon('topic-view__attachment-icon')} />
            )}
          </button>
        ) : null}
      </div>
      </div>
      {attachmentsMenuOpen && attachmentIndicator === 'multiple' && !isEditing && !isRoot ? (
        <TopicAttachmentsMenu
          notes={notes}
          link={link}
          onEditNote={() => {
            setAttachmentsMenuOpen(false);
            onOpenNotes?.(topicId);
          }}
          onEditLink={() => {
            setAttachmentsMenuOpen(false);
            onOpenWebLinkEditor?.(topicId);
          }}
          onOpenLink={(url) => {
            setAttachmentsMenuOpen(false);
            onOpenLink?.(topicId, url);
          }}
          onDeleteNote={() => onDeleteNote?.(topicId)}
          onDeleteLink={() => onDeleteLink?.(topicId)}
          onClose={() => setAttachmentsMenuOpen(false)}
        />
      ) : null}
      {hasLabels && !isEditing && !isRoot ? (
        <div className="topic-view__labels">
          {labels.map((label, index) => (
            <button
              key={`${label}-${index}`}
              type="button"
              className="topic-view__label-pill"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(topicId);
                onOpenLabels?.(topicId);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

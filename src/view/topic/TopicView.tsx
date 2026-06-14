import { AlignLeft, Cloud, ExternalLink, Link2, MoreHorizontal } from 'lucide-react';
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
  soleLinkKind,
  type TopicLinkKind,
  type TopicRefLink,
  type UrlLink,
} from '@/core/model/link';
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
import { sortTopicStickers, stickerRowWidth, topicHasStickers } from '@/core/model/stickers';
import type { TopicEquation, TopicId, MarkerId } from '@/core/model/types';
import { TopicAttachmentsMenu } from '@/view/topic/TopicAttachmentsMenu';
import { TopicEquationDisplay } from '@/view/topic/TopicEquationDisplay';
import { TopicStickerMenu } from '@/view/topic/TopicStickerMenu';
import { TopicStickers } from '@/view/topic/TopicStickers';
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
  webLink?: UrlLink;
  cloudLink?: UrlLink;
  topicLink?: TopicRefLink;
  equation?: TopicEquation;
  labels?: string[];
  markers?: MarkerId[];
  layout: NodeLayout;
  themeId?: string;
  selected?: boolean;
  autoFocusEdit?: boolean;
  onAutoFocusEditConsumed?: () => void;
  onEditingChange?: (editing: boolean) => void;
  onSelect?: (topicId: TopicId, options?: { additive?: boolean }) => void;
  onTextChange?: (topicId: TopicId, text: string) => void;
  onLiveTextChange?: (topicId: TopicId, text: string | null) => void;
  onOpenNotes?: (topicId: TopicId) => void;
  onOpenLabels?: (topicId: TopicId) => void;
  onOpenLink?: (topicId: TopicId, url: string) => void;
  onFollowTopicLink?: (topicId: TopicId) => void;
  onOpenWebLinkEditor?: (topicId: TopicId, kind?: TopicLinkKind) => void;
  onOpenTopicLinkEditor?: (topicId: TopicId) => void;
  onDeleteNote?: (topicId: TopicId) => void;
  onDeleteWebLink?: (topicId: TopicId) => void;
  onDeleteCloudLink?: (topicId: TopicId) => void;
  onDeleteTopicLink?: (topicId: TopicId) => void;
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
  linkLabel?: string;
  onDismissTopicPanels?: () => void;
  onSelectSticker?: (topicId: TopicId, stickerId: MarkerId) => void;
  onInsertChild?: (topicId: TopicId, commitText: string) => void;
  onInsertSibling?: (topicId: TopicId, commitText: string) => void;
  showsCollapseHandle?: boolean;
  onCollapseHandleHoverChange?: (hovered: boolean) => void;
}

export function TopicView({
  topicId,
  text,
  notes,
  webLink,
  cloudLink,
  topicLink,
  equation,
  labels = [],
  markers = [],
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
  onOpenLabels,
  linkLabel,
  onOpenLink,
  onFollowTopicLink,
  onOpenWebLinkEditor,
  onOpenTopicLinkEditor,
  onDeleteNote,
  onDeleteWebLink,
  onDeleteCloudLink,
  onDeleteTopicLink,
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
  onSelectSticker,
  onInsertChild,
  onInsertSibling,
  showsCollapseHandle = false,
  onCollapseHandleHoverChange,
}: TopicViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [attachmentsMenuOpen, setAttachmentsMenuOpen] = useState(false);
  const [stickerMenu, setStickerMenu] = useState<{
    markerId: MarkerId;
    caretLeft: number;
  } | null>(null);
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

  const cancelEdit = useCallback(() => {
    setDraftText(text);
    isEditingRef.current = false;
    setIsEditing(false);
    onEditingChange?.(false);
  }, [text, onEditingChange]);

  const finishEditingForInsert = useCallback(() => {
    isEditingRef.current = false;
    setIsEditing(false);
    onEditingChange?.(false);
  }, [onEditingChange]);

  const handleEditorKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      event.stopPropagation();

      if (event.key === 'Tab') {
        event.preventDefault();
        const commitText = draftTextRef.current.trim();
        finishEditingForInsert();
        onInsertChild?.(topicId, commitText);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const commitText = draftTextRef.current.trim();
        finishEditingForInsert();
        onInsertSibling?.(topicId, commitText);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      }
    },
    [topicId, finishEditingForInsert, onInsertChild, onInsertSibling, cancelEdit],
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
    if (!selected) {
      setAttachmentsMenuOpen(false);
      setStickerMenu(null);
    }
  }, [selected]);

  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const topicWrapRef = useRef<HTMLDivElement>(null);
  const [attachmentsMenuCaretLeft, setAttachmentsMenuCaretLeft] = useState<number | null>(null);

  const updateAttachmentsMenuCaret = useCallback(() => {
    const button = attachmentButtonRef.current;
    const wrap = topicWrapRef.current;
    if (!button || !wrap) return;
    const buttonRect = button.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    setAttachmentsMenuCaretLeft(
      buttonRect.left + buttonRect.width / 2 - wrapRect.left,
    );
  }, []);

  const openStickerMenu = useCallback(
    (markerId: MarkerId, element: HTMLElement) => {
      const wrap = topicWrapRef.current;
      if (!wrap) return;
      const stickerRect = element.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      onSelect?.(topicId);
      setAttachmentsMenuOpen(false);
      setStickerMenu({
        markerId,
        caretLeft: stickerRect.left + stickerRect.width / 2 - wrapRect.left,
      });
    },
    [onSelect, topicId],
  );

  const selectAllOnEditRef = useRef(false);

  const beginEdit = useCallback(
    (options?: { selectAll?: boolean; caretIndex?: number }) => {
      onSelect?.(topicId);
      onDismissTopicPanels?.();
      setAttachmentsMenuOpen(false);
      setStickerMenu(null);
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
  const linkAttachments = useMemo(
    () => ({ webLink, cloudLink, topicLink }),
    [webLink, cloudLink, topicLink],
  );
  const attachmentIndicator = getTopicAttachmentIndicator(notes, linkAttachments);
  const singleLinkKind = soleLinkKind(linkAttachments);
  const isRoot = layout.depth === 0;
  const hasLabels = topicHasLabels(labels);
  const hasStickers = !isRoot && topicHasStickers(markers);
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

  const stickerCount = hasStickers ? sortTopicStickers(markers).length : 0;
  const showAttachmentForMeasure =
    attachmentIndicator !== 'none' && !isRoot && !hasEquation;

  const editMeasurement = useMemo(() => {
    if (!isEditing) return null;
    if (hasEquation && equation) {
      return measureTopic(
        draftText,
        layout.depth,
        undefined,
        showAttachmentForMeasure,
        equation,
        stickerCount,
      );
    }
    return measureTopicForEdit(
      draftText,
      layout.depth,
      undefined,
      showAttachmentForMeasure,
      stickerCount,
    );
  }, [
    isEditing,
    hasEquation,
    equation,
    draftText,
    layout.depth,
    showAttachmentForMeasure,
    stickerCount,
  ]);

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
    const stickerAffordance = stickerCount > 0 ? stickerRowWidth(stickerCount) : 0;
    const neededOuter = editor.scrollWidth + padX * 2 + stickerAffordance;
    setEditWidthExtra(Math.max(0, neededOuter - measuredEditWidth));

    if (!isSingleLineEdit) {
      editor.style.height = 'auto';
      editor.style.height = `${editor.scrollHeight}px`;
    }
  }, [isEditing, isSingleLineEdit, draftText, measuredEditWidth, boxHeight, layout.depth, stickerCount]);

  useLayoutEffect(() => {
    if (!attachmentsMenuOpen) {
      setAttachmentsMenuCaretLeft(null);
      return;
    }
    updateAttachmentsMenuCaret();
  }, [attachmentsMenuOpen, updateAttachmentsMenuCaret, boxWidth, layout.width]);

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
      ref={topicWrapRef}
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
            onSelect?.(topicId, { additive: event.shiftKey });
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
        {hasStickers ? (
          <TopicStickers
            markers={markers}
            themeId={themeId}
            onStickerClick={!isEditing && !isRoot ? openStickerMenu : undefined}
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
                onKeyDown={(event) => handleEditorKeyDown(event.nativeEvent)}
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
            onKeyDown={(event) => handleEditorKeyDown(event.nativeEvent)}
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
            ref={attachmentButtonRef}
            type="button"
            className={`topic-view__attachment-button${
              attachmentIndicator === 'multiple' ? ' topic-view__attachment-button--multiple' : ''
            }`}
            aria-label={
              attachmentIndicator === 'multiple'
                ? 'View attachments'
                : attachmentIndicator === 'link'
                  ? singleLinkKind === 'topic'
                    ? 'Go to linked topic'
                    : singleLinkKind === 'cloud'
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
              if (singleLinkKind === 'topic') {
                onFollowTopicLink?.(topicId);
                return;
              }
              if (singleLinkKind === 'cloud' && cloudLink?.url) {
                onOpenLink?.(topicId, cloudLink.url);
                return;
              }
              if (singleLinkKind === 'webpage' && webLink?.url) {
                onOpenLink?.(topicId, webLink.url);
              }
            }}
          >
            {attachmentIndicator === 'multiple' ? (
              <MoreHorizontal {...appIcon('topic-view__attachment-icon')} />
            ) : attachmentIndicator === 'link' ? (
              singleLinkKind === 'cloud' ? (
                <Cloud {...appIcon('topic-view__attachment-icon')} />
              ) : singleLinkKind === 'topic' ? (
                <Link2 {...appIcon('topic-view__attachment-icon')} />
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
      {stickerMenu && !isEditing && !isRoot && onSelectSticker ? (
        <TopicStickerMenu
          activeMarkerId={stickerMenu.markerId}
          themeId={themeId}
          caretLeft={stickerMenu.caretLeft}
          onSelectSticker={(stickerId) => onSelectSticker(topicId, stickerId)}
          onDelete={() => onSelectSticker(topicId, stickerMenu.markerId)}
          onClose={() => setStickerMenu(null)}
        />
      ) : null}
      {attachmentsMenuOpen && attachmentIndicator === 'multiple' && !isEditing && !isRoot ? (
        <TopicAttachmentsMenu
          notes={notes}
          webLink={webLink}
          cloudLink={cloudLink}
          topicLink={topicLink}
          topicLinkLabel={linkLabel}
          caretLeft={attachmentsMenuCaretLeft ?? undefined}
          onEditNote={() => {
            setAttachmentsMenuOpen(false);
            onOpenNotes?.(topicId);
          }}
          onEditWebLink={() => {
            setAttachmentsMenuOpen(false);
            onOpenWebLinkEditor?.(topicId, 'webpage');
          }}
          onEditCloudLink={() => {
            setAttachmentsMenuOpen(false);
            onOpenWebLinkEditor?.(topicId, 'cloud');
          }}
          onEditTopicLink={() => {
            setAttachmentsMenuOpen(false);
            onOpenTopicLinkEditor?.(topicId);
          }}
          onOpenWebLink={(url) => {
            setAttachmentsMenuOpen(false);
            onOpenLink?.(topicId, url);
          }}
          onOpenCloudLink={(url) => {
            setAttachmentsMenuOpen(false);
            onOpenLink?.(topicId, url);
          }}
          onFollowTopicLink={() => {
            setAttachmentsMenuOpen(false);
            onFollowTopicLink?.(topicId);
          }}
          onDeleteNote={() => onDeleteNote?.(topicId)}
          onDeleteWebLink={() => onDeleteWebLink?.(topicId)}
          onDeleteCloudLink={() => onDeleteCloudLink?.(topicId)}
          onDeleteTopicLink={() => onDeleteTopicLink?.(topicId)}
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

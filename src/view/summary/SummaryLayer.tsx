import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_SUMMARY_TEXT } from '@/core/model/summaries';
import type { Sheet, Summary, TopicId } from '@/core/model/types';
import { MIN_BOUNDARY_BAND_HEIGHT } from '@/layout/boundaryGeometry';
import { findTopicIdAtPoint } from '@/layout/boundaryGeometry';
import {
  buildSummaryBracePath,
  buildSummaryConnectorLine,
  computeSummaryGroupRect,
  computeSummaryLayout,
  snapSummaryFromVerticalBand,
  snapSummaryResizeBand,
  SUMMARY_HOOK_LENGTH,
  summaryConnectorSvgWidth,
  summaryGroupRectFromVerticalBand,
} from '@/layout/summaryGeometry';
import type { NodeLayout, Rect } from '@/layout/types';

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

interface SummaryLayerProps {
  sheet: Sheet;
  summaries: Summary[];
  nodes: Map<string, NodeLayout>;
  bounds: Rect;
  selectedSummaryId: string | null;
  zoom: number;
  onSelectSummary: (summaryId: string | null) => void;
  onUpdateSummary: (summaryId: string, patch: Partial<Summary>) => void;
  onUpdateSummaryText: (summaryId: string, text: string) => void;
  onSelectTopic: (topicId: TopicId, options?: { additive?: boolean }) => void;
}

function SummaryConnector({ height }: { height: number }) {
  const svgWidth = summaryConnectorSvgWidth();
  const hook = SUMMARY_HOOK_LENGTH;
  const viewWidth = svgWidth - hook;

  return (
    <svg
      className="summary-layer__connector-svg"
      width={svgWidth}
      height={height}
      viewBox={`${-hook} 0 ${viewWidth + hook} ${height}`}
      aria-hidden="true"
    >
      <path
        d={buildSummaryBracePath(height)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={buildSummaryConnectorLine(height)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function SummaryBoxText({
  displayText,
  draftText,
  selected,
  editing,
  singleLine,
  editCaretRef,
  onCommit,
  onCancel,
  onDeselect,
  onDraftChange,
}: {
  displayText: string;
  draftText: string;
  selected: boolean;
  editing: boolean;
  singleLine: boolean;
  editCaretRef: React.MutableRefObject<number | null>;
  onCommit: (text: string) => void;
  onCancel: () => void;
  onDeselect: () => void;
  onDraftChange: (text: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const prevEditingRef = useRef(false);
  const ignoreBlurRef = useRef(false);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const draftTextRef = useRef(draftText);
  draftTextRef.current = draftText;

  const commit = useCallback(() => {
    if (!editingRef.current) return;
    const next = draftTextRef.current.trim();
    onCommit(next || DEFAULT_SUMMARY_TEXT);
  }, [onCommit]);

  const cancel = useCallback(() => {
    if (!editingRef.current) return;
    onCancel();
  }, [onCancel]);

  useLayoutEffect(() => {
    const justStarted = editing && !prevEditingRef.current;
    prevEditingRef.current = editing;
    if (!justStarted) return;

    ignoreBlurRef.current = true;

    const placeCaret = () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus({ preventScroll: true });

      const caret = editCaretRef.current;
      editCaretRef.current = null;
      if (caret != null) {
        const index = Math.max(0, Math.min(caret, editor.value.length));
        editor.setSelectionRange(index, index);
        return;
      }
      const end = editor.value.length;
      editor.setSelectionRange(end, end);
    };

    placeCaret();
    requestAnimationFrame(placeCaret);
    window.setTimeout(() => {
      placeCaret();
      ignoreBlurRef.current = false;
    }, 250);
  }, [editing, editCaretRef]);

  useEffect(() => {
    if (!editing) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapRef.current?.contains(target)) return;
      const next = draftTextRef.current.trim();
      onCommit(next || DEFAULT_SUMMARY_TEXT);
      onDeselect();
    };

    // Defer so the double-click pointer sequence cannot immediately close the editor.
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [editing, onCommit, onDeselect]);

  const editRows = singleLine ? 1 : Math.max(1, draftText.split('\n').length);

  return (
    <div
      ref={wrapRef}
      className={`summary-layer__box-text${selected ? ' summary-layer__box-text--selected' : ''}${
        editing ? ' summary-layer__box-text--editing' : ''
      }`}
      onPointerDown={(event) => {
        if (editing) event.stopPropagation();
      }}
    >
      {editing ? (
        <textarea
          ref={editorRef}
          className={`summary-layer__editor${
            singleLine ? ' summary-layer__editor--single-line' : ''
          }`}
          value={draftText}
          rows={editRows}
          wrap={singleLine ? 'off' : 'soft'}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => {
            if (ignoreBlurRef.current) return;
            commit();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      ) : (
        <span
          className={`summary-layer__box-text-inner${
            singleLine ? ' summary-layer__box-text-inner--single-line' : ''
          }`}
        >
          {displayText}
        </span>
      )}
    </div>
  );
}

type ResizeHandle = 'top' | 'bottom';

function SummaryBackgroundItem({
  summary,
  sheet,
  nodes,
}: {
  summary: Summary;
  sheet: Sheet;
  nodes: Map<string, NodeLayout>;
}) {
  const summaryText = sheet.topicsById[summary.summaryTopicId]?.text ?? DEFAULT_SUMMARY_TEXT;
  const layout = computeSummaryLayout(nodes, sheet, summary, summaryText);
  if (!layout) return null;

  const { connectorWrap, boxRect, boxSingleLine } = layout;

  return (
    <>
      <div
        className="summary-layer__connector-wrap"
        style={{
          left: connectorWrap.x,
          top: connectorWrap.y,
          width: connectorWrap.width,
          height: connectorWrap.height,
        }}
      >
        <SummaryConnector height={connectorWrap.height} />
      </div>

      <div
        className={`summary-layer__box summary-layer__box--display${
          boxSingleLine ? ' summary-layer__box--single-line' : ''
        }`}
        style={{
          left: boxRect.x,
          top: boxRect.y,
          width: boxRect.width,
          height: boxRect.height,
        }}
      >
        <span className="summary-layer__box-text-inner">{summaryText}</span>
      </div>
    </>
  );
}

function SummaryInteractionTarget({
  summary,
  sheet,
  nodes,
  selected,
  zoom,
  onSelect,
  onUpdate,
  onUpdateText,
  onDeselect,
  onSelectTopic,
}: {
  summary: Summary;
  sheet: Sheet;
  nodes: Map<string, NodeLayout>;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onUpdate: (patch: Partial<Summary>) => void;
  onUpdateText: (text: string) => void;
  onDeselect: () => void;
  onSelectTopic: (topicId: TopicId, options?: { additive?: boolean }) => void;
}) {
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [hovered, setHovered] = useState(false);
  const [resizeBand, setResizeBand] = useState<{ top: number; bottom: number } | null>(null);
  const prevSelectedRef = useRef(selected);
  const editCaretRef = useRef<number | null>(null);
  const draftTextRef = useRef(draftText);
  draftTextRef.current = draftText;
  const dragRef = useRef<{
    handle: ResizeHandle;
    pointerId: number;
    startClientY: number;
    bandTop: number;
    bandBottom: number;
  } | null>(null);

  const settledRect = computeSummaryGroupRect(nodes, sheet, summary);
  const displayRect =
    resizeBand && settledRect
      ? summaryGroupRectFromVerticalBand(nodes, sheet, summary, resizeBand.top, resizeBand.bottom)
      : settledRect;

  const summaryText = sheet.topicsById[summary.summaryTopicId]?.text ?? DEFAULT_SUMMARY_TEXT;

  useEffect(() => {
    if (!editingText) {
      setDraftText(summaryText);
    }
  }, [summaryText, editingText]);

  const startTextEdit = useCallback(
    (options?: { initialText?: string; caretIndex?: number }) => {
      const nextText = options?.initialText ?? summaryText;
      editCaretRef.current = options?.caretIndex ?? nextText.length;
      setDraftText(nextText);
      onSelect();
      setEditingText(true);
    },
    [summaryText, onSelect],
  );

  useEffect(() => {
    if (!selected || editingText) return;

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
        onSelect();
        editCaretRef.current = 0;
        setDraftText('');
        setEditingText(true);
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        onSelect();
        editCaretRef.current = event.key.length;
        setDraftText(event.key);
        setEditingText(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, editingText, onSelect]);

  useEffect(() => {
    const wasSelected = prevSelectedRef.current;
    prevSelectedRef.current = selected;

    if (wasSelected && !selected) {
      if (editingText) {
        onUpdateText(draftTextRef.current.trim() || DEFAULT_SUMMARY_TEXT);
      }
      setHovered(false);
      setEditingText(false);
    }
  }, [selected, editingText, onUpdateText]);

  if (!displayRect) return null;

  const boxText = editingText ? draftText : summaryText;
  const layout = computeSummaryLayout(nodes, sheet, summary, boxText, displayRect);
  if (!layout) return null;

  const { connectorWrap, boxRect, groupRect, boxSingleLine } = layout;

  const showHighlight = selected || hovered;

  const handlePadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = {
      x: groupRect.x + event.nativeEvent.offsetX,
      y: groupRect.y + event.nativeEvent.offsetY,
    };
    const topicId = findTopicIdAtPoint(nodes, point);

    event.stopPropagation();

    if (topicId) {
      onSelectTopic(topicId, { additive: event.shiftKey });
      return;
    }

    onDeselect();
  };

  const selectSummary = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (editingText) return;
    onSelect();
  };

  const handleBoxDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (editingText) return;
    event.stopPropagation();
    event.preventDefault();
    const inner = event.currentTarget.querySelector('.summary-layer__box-text-inner');
    const caretIndex =
      inner instanceof HTMLElement
        ? caretOffsetFromStaticText(inner, event.clientX, event.clientY)
        : null;
    startTextEdit({ caretIndex: caretIndex ?? summaryText.length });
  };

  const startResize = (handle: ResizeHandle, event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    onSelect();

    const bandTop = displayRect.y;
    const bandBottom = displayRect.y + displayRect.height;

    dragRef.current = {
      handle,
      pointerId: event.pointerId,
      startClientY: event.clientY,
      bandTop,
      bandBottom,
    };
    setResizeBand({ top: bandTop, bottom: bandBottom });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = (event.clientY - drag.startClientY) / zoom;

    let nextTop = drag.bandTop;
    let nextBottom = drag.bandBottom;

    if (drag.handle === 'top') {
      nextTop = Math.min(drag.bandTop + deltaY, drag.bandBottom - MIN_BOUNDARY_BAND_HEIGHT);
    } else {
      nextBottom = Math.max(drag.bandBottom + deltaY, drag.bandTop + MIN_BOUNDARY_BAND_HEIGHT);
    }

    const snapped = snapSummaryResizeBand(
      nodes,
      sheet,
      summary,
      nextTop,
      nextBottom,
      drag.handle,
      zoom,
    );

    setResizeBand({ top: snapped.top, bottom: snapped.bottom });
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const band = resizeBand ?? { top: drag.bandTop, bottom: drag.bandBottom };

    dragRef.current = null;
    setResizeBand(null);
    event.currentTarget.releasePointerCapture(event.pointerId);

    const snapped = snapSummaryFromVerticalBand(sheet, nodes, summary, band.top, band.bottom);
    onUpdate(snapped);
  };

  return (
    <div className="summary-layer__interaction-item">
      {showHighlight ? (
        <div
          className={`summary-layer__group summary-layer__group--interactive${
            selected ? ' summary-layer__group--selected' : ' summary-layer__group--hover'
          }`}
          style={{
            left: groupRect.x,
            top: groupRect.y,
            width: groupRect.width,
            height: groupRect.height,
          }}
        >
          {selected ? (
            <div className="summary-layer__pad-hit" onPointerDown={handlePadPointerDown} />
          ) : null}

          <div
            className={`summary-layer__group-outline${resizeBand ? ' summary-layer__group-outline--preview' : ''}`}
            aria-hidden="true"
          />

          <div
            className="summary-layer__handle summary-layer__handle--top"
            onPointerDown={(event) => startResize('top', event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
          <div
            className="summary-layer__handle summary-layer__handle--bottom"
            onPointerDown={(event) => startResize('bottom', event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        </div>
      ) : null}

      <div
        className="summary-layer__connector-wrap"
        style={{
          left: connectorWrap.x,
          top: connectorWrap.y,
          width: connectorWrap.width,
          height: connectorWrap.height,
          pointerEvents: 'none',
        }}
      >
        <SummaryConnector height={connectorWrap.height} />
      </div>

      {!selected && hovered ? (
        <div
          className="summary-layer__box-highlight"
          style={{
            left: boxRect.x,
            top: boxRect.y,
            width: boxRect.width,
            height: boxRect.height,
          }}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`summary-layer__box${selected ? ' summary-layer__box--selected' : ''}${
          editingText ? ' summary-layer__box--editing' : ''
        }${boxSingleLine ? ' summary-layer__box--single-line' : ''}`}
        style={{
          left: boxRect.x,
          top: boxRect.y,
          width: boxRect.width,
          height: boxRect.height,
        }}
        onPointerDown={selectSummary}
        onDoubleClick={handleBoxDoubleClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <SummaryBoxText
          displayText={summaryText}
          draftText={draftText}
          selected={selected}
          editing={editingText}
          singleLine={boxSingleLine}
          editCaretRef={editCaretRef}
          onCommit={(next) => {
            onUpdateText(next);
            setEditingText(false);
          }}
          onCancel={() => {
            setDraftText(summaryText);
            setEditingText(false);
          }}
          onDraftChange={setDraftText}
          onDeselect={onDeselect}
        />
      </div>
    </div>
  );
}

export function SummaryBackgroundLayer({
  sheet,
  summaries,
  nodes,
  bounds,
  selectedSummaryId,
}: Omit<
  SummaryLayerProps,
  'zoom' | 'onUpdateSummary' | 'onUpdateSummaryText' | 'onSelectSummary' | 'onSelectTopic'
>) {
  if (summaries.length === 0) return null;

  const localOffset = {
    x: -bounds.x,
    y: -bounds.y,
  };

  const inactiveSummaries = summaries.filter((summary) => summary.id !== selectedSummaryId);

  return (
    <div
      className="summary-layer summary-layer--background"
      style={{
        transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
      }}
    >
      {inactiveSummaries.map((summary) => (
        <SummaryBackgroundItem key={summary.id} summary={summary} sheet={sheet} nodes={nodes} />
      ))}
    </div>
  );
}

function summaryInteractionArea(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  summary: Summary,
): number {
  const rect = computeSummaryGroupRect(nodes, sheet, summary);
  return rect ? rect.width * rect.height : 0;
}

export function SummaryInteractionLayer({
  sheet,
  summaries,
  nodes,
  bounds,
  selectedSummaryId,
  zoom,
  onSelectSummary,
  onUpdateSummary,
  onUpdateSummaryText,
  onSelectTopic,
}: SummaryLayerProps) {
  if (summaries.length === 0) return null;

  const localOffset = {
    x: -bounds.x,
    y: -bounds.y,
  };

  const orderedSummaries = [...summaries].sort(
    (a, b) => summaryInteractionArea(nodes, sheet, a) - summaryInteractionArea(nodes, sheet, b),
  );

  return (
    <div
      className="summary-layer summary-layer--interaction"
      style={{
        transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
      }}
    >
      {orderedSummaries.map((summary) => (
        <SummaryInteractionTarget
          key={summary.id}
          summary={summary}
          sheet={sheet}
          nodes={nodes}
          selected={summary.id === selectedSummaryId}
          zoom={zoom}
          onSelect={() => onSelectSummary(summary.id)}
          onUpdate={(patch) => onUpdateSummary(summary.id, patch)}
          onUpdateText={(text) => onUpdateSummaryText(summary.id, text)}
          onDeselect={() => onSelectSummary(null)}
          onSelectTopic={onSelectTopic}
        />
      ))}
    </div>
  );
}

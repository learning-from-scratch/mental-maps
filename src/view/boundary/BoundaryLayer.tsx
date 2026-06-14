import { Plus } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_BOUNDARY_LABEL } from '@/core/model/boundaries';
import type { Boundary, Sheet, TopicId } from '@/core/model/types';
import {
  boundaryRectFromVerticalBand,
  computeBoundaryRect,
  findTopicIdAtPoint,
  MIN_BOUNDARY_BAND_HEIGHT,
  snapBoundaryFromVerticalBand,
} from '@/layout/boundaryGeometry';
import type { NodeLayout, Rect } from '@/layout/types';
import { appIcon } from '@/view/icons';

interface BoundaryLayerProps {
  sheet: Sheet;
  boundaries: Boundary[];
  nodes: Map<string, NodeLayout>;
  bounds: Rect;
  selectedBoundaryId: string | null;
  zoom: number;
  onSelectBoundary: (boundaryId: string | null) => void;
  onUpdateBoundary: (boundaryId: string, patch: Partial<Boundary>) => void;
  onSelectTopic: (topicId: TopicId, options?: { additive?: boolean }) => void;
}

function BoundaryLabel({
  label,
  left,
  top,
  selected,
  editing,
  onStartEdit,
  onCommit,
  onDeselect,
}: {
  label: string;
  left: number;
  top: number;
  selected: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (label: string) => void;
  onDeselect: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLSpanElement>(null);

  const commit = useCallback(() => {
    if (!editing) return;
    const next = editorRef.current?.textContent?.trim() ?? '';
    onCommit(next);
  }, [editing, onCommit]);

  useLayoutEffect(() => {
    if (!editing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = label;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing, label]);

  useLayoutEffect(() => {
    if (!editing) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapRef.current?.contains(target)) return;
      commit();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [editing, commit]);

  return (
    <div
      ref={wrapRef}
      className={`boundary-layer__label${selected ? ' boundary-layer__label--selected' : ''}`}
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (!editing) onStartEdit();
      }}
    >
      {editing ? (
        <span
          ref={editorRef}
          className="boundary-layer__label-text boundary-layer__label-text--editing"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
              onDeselect();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCommit(label);
            }
          }}
        />
      ) : (
        <span
          className="boundary-layer__label-text"
          onDoubleClick={(event) => {
            event.stopPropagation();
            onStartEdit();
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

type ResizeHandle = 'top' | 'bottom';

function BoundaryItem({
  boundary,
  sheet,
  nodes,
}: {
  boundary: Boundary;
  sheet: Sheet;
  nodes: Map<string, NodeLayout>;
}) {
  const displayRect = computeBoundaryRect(nodes, sheet, boundary);
  if (!displayRect) return null;

  const showLabel = Boolean(boundary.label);

  return (
    <div
      className="boundary-layer__item"
      style={{
        left: displayRect.x,
        top: displayRect.y,
        width: displayRect.width,
        height: displayRect.height,
      }}
    >
      <div className="boundary-layer__fill" aria-hidden="true" />
      <div className="boundary-layer__outline" aria-hidden="true" />
      {showLabel ? (
        <div className="boundary-layer__label boundary-layer__label--display" style={{ left: 0, top: -2 }}>
          <span className="boundary-layer__label-text">{boundary.label}</span>
        </div>
      ) : null}
    </div>
  );
}

function BoundaryInteractionTarget({
  boundary,
  sheet,
  nodes,
  selected,
  zoom,
  onSelect,
  onUpdate,
  onDeselect,
  onSelectTopic,
}: {
  boundary: Boundary;
  sheet: Sheet;
  nodes: Map<string, NodeLayout>;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onUpdate: (patch: Partial<Boundary>) => void;
  onDeselect: () => void;
  onSelectTopic: (topicId: TopicId, options?: { additive?: boolean }) => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [resizeBand, setResizeBand] = useState<{ top: number; bottom: number } | null>(null);
  const dragRef = useRef<{
    handle: ResizeHandle;
    pointerId: number;
    startClientY: number;
    bandTop: number;
    bandBottom: number;
  } | null>(null);

  const settledRect = computeBoundaryRect(nodes, sheet, boundary);
  const displayRect =
    resizeBand && settledRect
      ? boundaryRectFromVerticalBand(nodes, sheet, boundary, resizeBand.top, resizeBand.bottom)
      : settledRect;
  if (!displayRect) return null;

  const handlePadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = {
      x: displayRect.x + event.nativeEvent.offsetX,
      y: displayRect.y + event.nativeEvent.offsetY,
    };
    const topicId = findTopicIdAtPoint(nodes, point);

    event.stopPropagation();

    if (topicId) {
      onSelectTopic(topicId, { additive: event.shiftKey });
      return;
    }

    onSelect();
  };

  const selectBoundary = (event: React.PointerEvent) => {
    event.stopPropagation();
    onSelect();
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

    if (drag.handle === 'top') {
      const nextTop = drag.bandTop + deltaY;
      const maxTop = drag.bandBottom - MIN_BOUNDARY_BAND_HEIGHT;
      setResizeBand({
        top: Math.min(nextTop, maxTop),
        bottom: drag.bandBottom,
      });
      return;
    }

    const nextBottom = drag.bandBottom + deltaY;
    const minBottom = drag.bandTop + MIN_BOUNDARY_BAND_HEIGHT;
    setResizeBand({
      top: drag.bandTop,
      bottom: Math.max(nextBottom, minBottom),
    });
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const band = resizeBand ?? { top: drag.bandTop, bottom: drag.bandBottom };

    dragRef.current = null;
    setResizeBand(null);
    event.currentTarget.releasePointerCapture(event.pointerId);

    const snapped = snapBoundaryFromVerticalBand(
      sheet,
      nodes,
      boundary,
      band.top,
      band.bottom,
    );
    onUpdate(snapped);
  };

  const showLabel = Boolean(boundary.label);

  return (
    <div
      className={`boundary-layer__interaction-item${selected ? ' boundary-layer__interaction-item--selected' : ''}`}
      style={{
        left: displayRect.x,
        top: displayRect.y,
        width: displayRect.width,
        height: displayRect.height,
      }}
    >
      <div className="boundary-layer__pad-hit" onPointerDown={handlePadPointerDown} />

      {selected && resizeBand ? (
        <>
          <div className="boundary-layer__fill boundary-layer__fill--preview" aria-hidden="true" />
          <div className="boundary-layer__outline boundary-layer__outline--preview" aria-hidden="true" />
        </>
      ) : null}

      {selected ? <div className="boundary-layer__selection-outline" aria-hidden="true" /> : null}

      {selected && !showLabel ? (
        <button
          type="button"
          className="boundary-layer__add-label"
          aria-label="Add boundary label"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onUpdate({ label: DEFAULT_BOUNDARY_LABEL });
            setEditingLabel(true);
          }}
        >
          <Plus {...appIcon('boundary-layer__add-label-icon')} />
        </button>
      ) : null}

      {selected && showLabel ? (
        <BoundaryLabel
          label={boundary.label ?? DEFAULT_BOUNDARY_LABEL}
          left={0}
          top={-2}
          selected
          editing={editingLabel}
          onStartEdit={() => setEditingLabel(true)}
          onCommit={(next) => {
            onUpdate({ label: next || undefined });
            setEditingLabel(false);
          }}
          onDeselect={onDeselect}
        />
      ) : null}

      {!selected && showLabel ? (
        <div
          className="boundary-layer__label boundary-layer__label--interactive"
          style={{ left: 0, top: -2 }}
          onPointerDown={selectBoundary}
        >
          <span className="boundary-layer__label-text">{boundary.label}</span>
        </div>
      ) : null}

      {selected ? (
        <>
          <div
            className="boundary-layer__handle boundary-layer__handle--top"
            onPointerDown={(event) => startResize('top', event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
          <div
            className="boundary-layer__handle boundary-layer__handle--bottom"
            onPointerDown={(event) => startResize('bottom', event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        </>
      ) : null}
    </div>
  );
}

export function BoundaryBackgroundLayer({
  sheet,
  boundaries,
  nodes,
  bounds,
}: Omit<BoundaryLayerProps, 'zoom' | 'onUpdateBoundary' | 'selectedBoundaryId' | 'onSelectBoundary' | 'onSelectTopic'>) {
  if (boundaries.length === 0) return null;

  const localOffset = {
    x: -bounds.x,
    y: -bounds.y,
  };

  return (
    <div
      className="boundary-layer boundary-layer--background"
      style={{
        transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
      }}
    >
      {boundaries.map((boundary) => (
        <BoundaryItem key={boundary.id} boundary={boundary} sheet={sheet} nodes={nodes} />
      ))}
    </div>
  );
}

function boundaryInteractionArea(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  boundary: Boundary,
): number {
  const rect = computeBoundaryRect(nodes, sheet, boundary);
  return rect ? rect.width * rect.height : 0;
}

export function BoundaryInteractionLayer({
  sheet,
  boundaries,
  nodes,
  bounds,
  selectedBoundaryId,
  zoom,
  onSelectBoundary,
  onUpdateBoundary,
  onSelectTopic,
}: BoundaryLayerProps) {
  if (boundaries.length === 0) return null;

  const localOffset = {
    x: -bounds.x,
    y: -bounds.y,
  };

  const orderedBoundaries = [...boundaries].sort(
    (a, b) =>
      boundaryInteractionArea(nodes, sheet, a) - boundaryInteractionArea(nodes, sheet, b),
  );

  return (
    <div
      className="boundary-layer boundary-layer--interaction"
      style={{
        transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
      }}
    >
      {orderedBoundaries.map((boundary) => (
        <BoundaryInteractionTarget
          key={boundary.id}
          boundary={boundary}
          sheet={sheet}
          nodes={nodes}
          selected={boundary.id === selectedBoundaryId}
          zoom={zoom}
          onSelect={() => onSelectBoundary(boundary.id)}
          onUpdate={(patch) => onUpdateBoundary(boundary.id, patch)}
          onDeselect={() => onSelectBoundary(null)}
          onSelectTopic={onSelectTopic}
        />
      ))}
    </div>
  );
}

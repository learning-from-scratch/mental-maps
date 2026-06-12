import { Trash2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type CSSProperties,
} from 'react';
import {
  equationPlacement,
  equationScale,
  snapPlacementFromRelativePoint,
  type EquationPlacementSide,
} from '@/core/model/equation';
import type { TopicEquation } from '@/core/model/types';
import { renderLatex } from '@/lib/katexRender';
import { appIcon } from '@/view/icons';

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface TopicEquationDisplayProps {
  equation: TopicEquation;
  topicSelected: boolean;
  selected: boolean;
  contentRef: RefObject<HTMLElement | null>;
  onTopicSelect: () => void;
  onEquationActivate: () => void;
  onOpenEditor: () => void;
  onScaleChange: (scale: number) => void;
  onLiveScaleChange?: (scale: number | null) => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDelete: () => void;
  onDeselect: () => void;
  gridStyle?: CSSProperties;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const DRAG_THRESHOLD_PX = 4;
const ACTIVATE_DELAY_MS = 400;

export function TopicEquationDisplay({
  equation,
  topicSelected,
  selected,
  contentRef,
  onTopicSelect,
  onEquationActivate,
  onOpenEditor,
  onScaleChange,
  onLiveScaleChange,
  onDragMove,
  onDragEnd,
  onDelete,
  onDeselect,
  gridStyle,
}: TopicEquationDisplayProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [liveScale, setLiveScale] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const liveScaleRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;
    snap: EquationPlacementSide;
  } | null>(null);
  const resizeRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    startScale: number;
  } | null>(null);
  const gestureSelectedRef = useRef<boolean | null>(null);
  const pointerDownCountRef = useRef(0);
  const activateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearActivateTimer = useCallback(() => {
    if (activateTimerRef.current) {
      clearTimeout(activateTimerRef.current);
      activateTimerRef.current = null;
    }
  }, []);

  const resetPointerGesture = useCallback(() => {
    pointerDownCountRef.current = 0;
    gestureSelectedRef.current = null;
  }, []);

  const scale = liveScale ?? equationScale(equation);
  const rendered = renderLatex(equation.latex);

  useEffect(() => () => clearActivateTimer(), [clearActivateTimer]);

  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onDelete();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, onDelete]);

  const beginResize = useCallback(
    (handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startScale = equationScale(equation);
      resizeRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startScale,
      };
      liveScaleRef.current = startScale;
      setLiveScale(startScale);
      onLiveScaleChange?.(startScale);

      const onMove = (moveEvent: PointerEvent) => {
        const state = resizeRef.current;
        if (!state) return;

        const deltaX = moveEvent.clientX - state.startX;
        const deltaY = moveEvent.clientY - state.startY;
        const handleSign =
          state.handle === 'se' || state.handle === 'ne'
            ? 1
            : state.handle === 'sw' || state.handle === 'nw'
              ? -1
              : 1;
        const delta = (deltaX + deltaY * handleSign) / 120;
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, state.startScale + delta),
        );
        liveScaleRef.current = nextScale;
        setLiveScale(nextScale);
        onLiveScaleChange?.(nextScale);
      };

      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (liveScaleRef.current != null) {
          onScaleChange(liveScaleRef.current);
        }
        liveScaleRef.current = null;
        setLiveScale(null);
        onLiveScaleChange?.(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [equation, onLiveScaleChange, onScaleChange],
  );

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!selected) return;
      if ((event.target as HTMLElement).closest('.topic-view__equation-handle')) return;
      if ((event.target as HTMLElement).closest('.topic-view__equation-delete')) return;

      const content = contentRef.current;
      if (!content) return;

      const placement = equationPlacement(equation);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        started: false,
        snap: placement,
      };

      const onMove = (moveEvent: PointerEvent) => {
        const state = dragRef.current;
        if (!state || state.pointerId !== moveEvent.pointerId) return;

        const deltaX = moveEvent.clientX - state.startX;
        const deltaY = moveEvent.clientY - state.startY;
        if (!state.started) {
          if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
          state.started = true;
          setIsDragging(true);
          wrapRef.current?.setPointerCapture(moveEvent.pointerId);
        }

        const rect = content.getBoundingClientRect();
        state.snap = snapPlacementFromRelativePoint(
          moveEvent.clientX - rect.left,
          moveEvent.clientY - rect.top,
          rect.width,
          rect.height,
        );
        onDragMove?.(moveEvent.clientX, moveEvent.clientY);
      };

      const onUp = (upEvent: PointerEvent) => {
        const state = dragRef.current;
        if (!state || state.pointerId !== upEvent.pointerId) return;

        dragRef.current = null;
        setIsDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);

        if (state.started) {
          onDragEnd?.(upEvent.clientX, upEvent.clientY);
          try {
            wrapRef.current?.releasePointerCapture(upEvent.pointerId);
          } catch {
            /* pointer may already be released */
          }
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [contentRef, equation, onDragEnd, onDragMove, selected],
  );

  useEffect(() => {
    if (!selected) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (wrapRef.current?.contains(target ?? null)) return;
      if (target?.closest('.topic-equation-panel-wrap')) return;
      onDeselect();
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [selected, onDeselect]);

  if (!rendered.ok) return null;

  const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];

  return (
    <div
      ref={wrapRef}
      className={`topic-view__equation topic-view__equation--grid${selected ? ' topic-view__equation--selected' : ''}${isDragging ? ' topic-view__equation--dragging' : ''}`}
      style={{ fontSize: `${scale}em`, ...gridStyle }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (pointerDownCountRef.current === 0) {
          gestureSelectedRef.current = selected;
        }
        pointerDownCountRef.current++;
        if (selected) beginDrag(event);
      }}
      onPointerUp={() => {
        window.setTimeout(resetPointerGesture, ACTIVATE_DELAY_MS + 50);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (selected) return;

        clearActivateTimer();
        activateTimerRef.current = setTimeout(() => {
          activateTimerRef.current = null;
          if (topicSelected) {
            onEquationActivate();
            return;
          }
          onTopicSelect();
        }, ACTIVATE_DELAY_MS);
      }}
      onDoubleClick={(event) => {
        clearActivateTimer();
        const wasInResizeMode = gestureSelectedRef.current === true;
        resetPointerGesture();

        if (!wasInResizeMode) return;

        event.stopPropagation();
        event.preventDefault();
        onOpenEditor();
      }}
    >
      <span
        className="topic-view__equation-math"
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
      {selected ? (
        <>
          {handles.map((handle) => (
            <span
              key={handle}
              className={`topic-view__equation-handle topic-view__equation-handle--${handle}`}
              onPointerDown={(event) => beginResize(handle, event)}
            />
          ))}
          <button
            type="button"
            className="topic-view__equation-delete"
            aria-label="Delete equation"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 {...appIcon('topic-view__equation-delete-icon')} />
          </button>
        </>
      ) : null}
    </div>
  );
}

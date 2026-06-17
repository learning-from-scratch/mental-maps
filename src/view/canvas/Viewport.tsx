import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { MapCanvasStyle } from '@/layout/theme';
import { ViewportNavHint } from '@/view/canvas/ViewportNavHint';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface ViewportProps {
  children: ReactNode;
  /** Rendered above the panned world so backdrop-filter can frost the canvas. */
  overlay?: ReactNode;
  canvasStyle: MapCanvasStyle;
  showCanvasDots?: boolean;
  viewport?: ViewportState;
  initialViewport?: ViewportState;
  onViewportChange?: (viewport: ViewportState) => void;
  onClearSelection?: () => void;
  showNavHint?: boolean;
  onDismissNavHint?: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_FACTOR = 1.08;

const INTERACTIVE_SELECTOR =
  '.topic-view-wrap, .topic-view, .topic-view__notes-button, .topic-view__attachment-button, .topic-stickers__item, .topic-view__label-pill, .topic-view__equation, .topic-attachments-menu-wrap, .topic-sticker-menu-wrap, .sticker-legend, .collapse-handle-wrap, .collapse-handle, .topic-notes-panel-wrap, .topic-equation-panel-wrap, .topic-label-panel-wrap, .relationship-layer, .relationship-layer__path-hit, .relationship-layer__handle, .relationship-layer__label-wrap, .floating-toolbar-wrap, .bottom-panel, .right-sidebars, .viewport__hud';

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest(INTERACTIVE_SELECTOR));
}

export function isViewportInteractiveTarget(target: EventTarget | null): boolean {
  return isInteractiveTarget(target);
}

/** Pixel-mode wheel events come from trackpads; line-mode is usually a mouse wheel. */
function isTrackpadWheel(event: WheelEvent): boolean {
  if (event.ctrlKey || event.metaKey) return false;
  if (Math.abs(event.deltaX) > 0) return true;
  return event.deltaMode === WheelEvent.DOM_DELTA_PIXEL;
}

function canScrollInDirection(target: EventTarget | null, deltaY: number): boolean {
  let element = target instanceof HTMLElement ? target : null;
  while (element) {
    const { overflowY } = getComputedStyle(element);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      const { scrollTop, scrollHeight, clientHeight } = element;
      if (scrollHeight > clientHeight + 1) {
        if (deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1) return true;
        if (deltaY < 0 && scrollTop > 0) return true;
      }
    }
    element = element.parentElement;
  }
  return false;
}

export function Viewport({
  children,
  overlay,
  canvasStyle,
  showCanvasDots = true,
  viewport: controlledViewport,
  initialViewport = { x: 0, y: 0, zoom: 1 },
  onViewportChange,
  onClearSelection,
  showNavHint = false,
  onDismissNavHint,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalViewport, setInternalViewport] = useState<ViewportState>(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const viewport = controlledViewport ?? internalViewport;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  const updateViewport = useCallback(
    (next: ViewportState | ((prev: ViewportState) => ViewportState)) => {
      const resolved =
        typeof next === 'function' ? next(viewportRef.current) : next;

      if (controlledViewport) {
        onViewportChange?.(resolved);
      } else {
        setInternalViewport(resolved);
        onViewportChange?.(resolved);
      }
    },
    [controlledViewport, onViewportChange],
  );

  const zoomTowardPointer = useCallback(
    (pointerX: number, pointerY: number, zoomFactor: number) => {
      updateViewport((prev) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * zoomFactor));
        const scale = nextZoom / prev.zoom;

        return {
          zoom: nextZoom,
          x: pointerX - scale * (pointerX - prev.x),
          y: pointerY - scale * (pointerY - prev.y),
        };
      });
    },
    [updateViewport],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      if (canScrollInDirection(event.target, event.deltaY)) return;

      event.preventDefault();

      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      // Pinch-to-zoom (trackpad) and Ctrl/Command + wheel (mouse or trackpad).
      if (event.ctrlKey || event.metaKey) {
        const zoomFactor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        zoomTowardPointer(pointerX, pointerY, zoomFactor);
        return;
      }

      // Two-finger trackpad swipe pans the canvas.
      if (isTrackpadWheel(event)) {
        updateViewport((prev) => ({
          ...prev,
          x: prev.x - event.deltaX,
          y: prev.y - event.deltaY,
        }));
        return;
      }

      // Mouse wheel zooms toward the pointer.
      if (event.deltaY !== 0) {
        const zoomFactor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        zoomTowardPointer(pointerX, pointerY, zoomFactor);
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [updateViewport, zoomTowardPointer]);

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Left-click drag selects (marquee). Pan with right/middle mouse or two-finger swipe.
    const isPanButton = event.button === 1 || event.button === 2;
    if (!isPanButton) return;
    if (isInteractiveTarget(event.target)) return;

    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      if (
        active.classList.contains('topic-view__editor') ||
        active.classList.contains('topic-notes-panel__editor') ||
        active.classList.contains('topic-equation-panel__input') ||
        active.classList.contains('relationship-layer__label--editing')
      ) {
        active.blur();
      }
    }

    onClearSelection?.();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: viewportRef.current.x,
      originY: viewportRef.current.y,
    };
    setIsPanning(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    updateViewport({
      ...viewportRef.current,
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY,
    });
  };

  return (
    <div
      ref={containerRef}
      className={`viewport canvas-surface${isPanning ? ' viewport--panning' : ''}`}
      data-canvas-dots={showCanvasDots ? 'yes' : 'no'}
      style={
        {
          '--canvas-bg': canvasStyle.background,
          '--canvas-dot': canvasStyle.dotColor,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="viewport__world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {children}
      </div>
      {overlay && <div className="viewport__overlay">{overlay}</div>}
      {showNavHint && onDismissNavHint ? (
        <ViewportNavHint onDismiss={onDismissNavHint} />
      ) : null}
    </div>
  );
}

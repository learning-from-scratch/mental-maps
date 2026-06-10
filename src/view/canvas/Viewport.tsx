import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface ViewportProps {
  children: ReactNode;
  initialViewport?: ViewportState;
  onViewportChange?: (viewport: ViewportState) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function Viewport({
  children,
  initialViewport = { x: 0, y: 0, zoom: 1 },
  onViewportChange,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>(initialViewport);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null,
  );

  const updateViewport = useCallback(
    (next: ViewportState | ((prev: ViewportState) => ViewportState)) => {
      setViewport((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        onViewportChange?.(resolved);
        return resolved;
      });
    },
    [onViewportChange],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      updateViewport((prev) => {
        const zoomFactor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * zoomFactor));
        const scale = nextZoom / prev.zoom;

        return {
          zoom: nextZoom,
          x: pointerX - scale * (pointerX - prev.x),
          y: pointerY - scale * (pointerY - prev.y),
        };
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [updateViewport]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.topic-view, .collapse-handle, .floating-toolbar-wrap')) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    updateViewport({
      ...viewport,
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY,
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="viewport__world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {children}
      </div>
      <div className="viewport__hud">
        Drag to pan · Scroll to zoom · {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}

import type { ViewportState } from '@/view/canvas/Viewport';
import type { Vec2 } from '@/core/model/types';

export function clientToViewport(
  clientX: number,
  clientY: number,
  container: HTMLElement,
): Vec2 {
  const rect = container.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function clientToWorld(
  clientX: number,
  clientY: number,
  viewport: ViewportState,
  container: HTMLElement,
): Vec2 {
  const point = clientToViewport(clientX, clientY, container);
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

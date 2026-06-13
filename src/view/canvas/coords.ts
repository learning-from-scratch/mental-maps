import type { ViewportState } from '@/view/canvas/Viewport';
import type { Vec2 } from '@/core/model/types';

export function clientToWorld(
  clientX: number,
  clientY: number,
  viewport: ViewportState,
  container: HTMLElement,
): Vec2 {
  const rect = container.getBoundingClientRect();
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

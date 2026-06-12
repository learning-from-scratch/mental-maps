import type { TopicEquation } from '@/core/model/types';

export type EquationPlacementSide = 'top' | 'bottom' | 'left' | 'right';

export const DEFAULT_EQUATION_PLACEMENT: EquationPlacementSide = 'top';

export function topicHasVisibleText(text: string): boolean {
  return text.trim().length > 0;
}

export function topicIsEquationOnly(text: string, equation?: TopicEquation): boolean {
  return topicHasEquation(equation) && !topicHasVisibleText(text);
}

export function topicHasEquation(equation?: TopicEquation): boolean {
  return Boolean(equation?.latex?.trim());
}

export function equationScale(equation?: TopicEquation): number {
  const scale = equation?.scale ?? 1;
  return Math.min(3, Math.max(0.25, scale));
}

function migrateLegacyPlacement(placement: TopicEquation['placement']): EquationPlacementSide | null {
  if (!placement) return null;
  if (typeof placement === 'string') {
    if (placement === 'top' || placement === 'bottom' || placement === 'left' || placement === 'right') {
      return placement;
    }
    return null;
  }

  const { row, col } = placement;
  if (row === 0) return 'top';
  if (row === 2) return 'bottom';
  if (col === 0) return 'left';
  if (col === 2) return 'right';
  return 'top';
}

export function equationPlacement(equation?: TopicEquation): EquationPlacementSide {
  return migrateLegacyPlacement(equation?.placement) ?? DEFAULT_EQUATION_PLACEMENT;
}

/** Text occupies the zone opposite the equation. */
export function textZoneForEquation(side: EquationPlacementSide): EquationPlacementSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export function isVerticalEquationLayout(side: EquationPlacementSide): boolean {
  return side === 'top' || side === 'bottom';
}

export function snapPlacementFromRelativePoint(
  relativeX: number,
  relativeY: number,
  width: number,
  height: number,
): EquationPlacementSide {
  if (width <= 0 || height <= 0) return DEFAULT_EQUATION_PLACEMENT;

  const dx = relativeX - width / 2;
  const dy = relativeY - height / 2;

  if (Math.abs(dy) > Math.abs(dx)) {
    return dy < 0 ? 'top' : 'bottom';
  }

  return dx < 0 ? 'left' : 'right';
}

export function equationLayoutAreaStyle(): { gridArea: 'equation' } {
  return { gridArea: 'equation' };
}

export function textLayoutAreaStyle(): { gridArea: 'text' } {
  return { gridArea: 'text' };
}

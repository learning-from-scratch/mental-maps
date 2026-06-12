import {
  snapPlacementFromRelativePoint,
  topicHasEquation,
  topicHasVisibleText,
  type EquationPlacementSide,
} from '@/core/model/equation';
import type { Sheet, TopicEquation, TopicId } from '@/core/model/types';

export function topicIsEmptyForEquationDrop(
  text: string,
  equation?: TopicEquation,
): boolean {
  return !topicHasEquation(equation) && !topicHasVisibleText(text);
}

export function topicUsesSingleEquationGrid(text: string): boolean {
  return !topicHasVisibleText(text);
}

export type EquationGridVariant = 'single' | 'split';

export interface EquationDropTarget {
  topicId: TopicId;
  snap: EquationPlacementSide;
  canDrop: boolean;
  gridVariant: EquationGridVariant;
}

export interface EquationDragOverlay {
  sourceTopicId: TopicId;
  targetTopicId: TopicId | null;
  snap: EquationPlacementSide;
  clientX: number;
  clientY: number;
  equation: TopicEquation;
  canDrop: boolean;
  gridVariant: EquationGridVariant;
}

export function findEquationDropTarget(
  clientX: number,
  clientY: number,
  sourceTopicId: TopicId,
  sheet: Sheet,
  depthById: Map<TopicId, number>,
): EquationDropTarget | null {
  if (typeof document === 'undefined') return null;

  const elements = document.elementsFromPoint(clientX, clientY);
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;

    const content = element.closest<HTMLElement>('[data-equation-drop-target]');
    if (!content) continue;

    const topicId = content.dataset.topicId;
    if (!topicId) continue;

    const topic = sheet.topicsById[topicId];
    const depth = depthById.get(topicId);
    if (!topic || depth == null || depth === 0) continue;

    const gridVariant = topicUsesSingleEquationGrid(topic.text) ? 'single' : 'split';
    const rect = content.getBoundingClientRect();
    const snap = snapPlacementFromRelativePoint(
      clientX - rect.left,
      clientY - rect.top,
      rect.width,
      rect.height,
    );

    if (topicId === sourceTopicId) {
      return { topicId, snap, canDrop: true, gridVariant };
    }

    return { topicId, snap, canDrop: true, gridVariant };
  }

  return null;
}

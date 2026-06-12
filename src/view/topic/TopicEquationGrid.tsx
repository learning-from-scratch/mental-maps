import type { EquationPlacementSide } from '@/core/model/equation';
import type { EquationGridVariant } from '@/view/topic/equationDropTarget';

interface TopicEquationGridProps {
  highlightZone: EquationPlacementSide | null;
  variant?: EquationGridVariant;
}

export function TopicEquationGrid({
  highlightZone,
  variant = 'split',
}: TopicEquationGridProps) {
  if (variant === 'single') {
    return (
      <div className="topic-equation-grid topic-equation-grid--single" aria-hidden>
        <div className="topic-equation-grid__zone topic-equation-grid__zone--equation" />
      </div>
    );
  }

  if (!highlightZone) return null;

  const isVertical = highlightZone === 'top' || highlightZone === 'bottom';
  const equationFirst = highlightZone === 'top' || highlightZone === 'left';

  return (
    <div
      className={`topic-equation-grid topic-equation-grid--${isVertical ? 'vertical' : 'horizontal'}${equationFirst ? ' topic-equation-grid--eq-first' : ' topic-equation-grid--text-first'}`}
      aria-hidden
    >
      <div className="topic-equation-grid__zone topic-equation-grid__zone--equation" />
      <div className="topic-equation-grid__zone topic-equation-grid__zone--text" />
    </div>
  );
}

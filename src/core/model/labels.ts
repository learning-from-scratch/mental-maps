export function parseLabelInput(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatLabelsForInput(labels: string[]): string {
  return labels.join(', ');
}

export function sortLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function finalizeLabels(labels: string[], autoSort: boolean): string[] {
  const unique = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  return autoSort ? sortLabels(unique) : unique;
}

export function topicHasLabels(labels?: string[]): boolean {
  return (labels?.length ?? 0) > 0;
}

const LABEL_FONT_SIZE = 12;
const LABEL_PAD_X = 12;
const LABEL_ROW_GAP = 6;
const LABEL_MARGIN_TOP = 6;
/** Space reserved below the label pills before the next topic in layout. */
export const LABEL_MARGIN_BOTTOM = 10;
const LABEL_MIN_CONTAINER_WIDTH = 180;
const LABEL_MAX_CONTAINER_WIDTH = 280;

function measureLabelPillWidth(label: string): number {
  const charWidth = LABEL_FONT_SIZE * 0.52;
  return Math.ceil(label.length * charWidth + LABEL_PAD_X * 2);
}

/** Vertical space labels occupy below a topic box (for layout spacing). */
export function measureLabelsBlock(labels: string[], topicWidth: number): number {
  if (labels.length === 0) return 0;

  const containerWidth = Math.min(
    LABEL_MAX_CONTAINER_WIDTH,
    Math.max(topicWidth, LABEL_MIN_CONTAINER_WIDTH),
  );
  const pillHeight = Math.ceil(LABEL_FONT_SIZE * 1.2) + 8;
  let rowWidth = 0;
  let rows = 1;

  for (const label of labels) {
    const pillWidth = measureLabelPillWidth(label);
    if (rowWidth > 0 && rowWidth + LABEL_ROW_GAP + pillWidth > containerWidth) {
      rows += 1;
      rowWidth = pillWidth;
    } else {
      rowWidth = rowWidth === 0 ? pillWidth : rowWidth + LABEL_ROW_GAP + pillWidth;
    }
  }

  return (
    LABEL_MARGIN_TOP + rows * pillHeight + (rows - 1) * LABEL_ROW_GAP + LABEL_MARGIN_BOTTOM
  );
}

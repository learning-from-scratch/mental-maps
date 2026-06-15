import { DEFAULT_BOUNDARY_PADDING } from '@/core/model/boundaries';
import type { Boundary, Sheet, Summary, TopicId } from '@/core/model/types';
import type { NodeLayout, Rect } from '@/layout/types';
import {
  boundaryRectFromVerticalBand,
  computeBoundaryContentRect,
  computeBoundaryRect,
  MIN_BOUNDARY_BAND_HEIGHT,
  paddingBottomFromHandleY,
  paddingTopFromHandleY,
  verticalOverlapFraction,
} from '@/layout/boundaryGeometry';

/** How far the parenthesis bows to the right (quadratic control-point x). */
export const SUMMARY_BRACE_WIDTH = 28;
export const SUMMARY_HOOK_LENGTH = 6;
export const SUMMARY_BRACE_GAP = 12;
/** Short horizontal tick from the parenthesis waist. */
export const SUMMARY_CONNECTOR_LENGTH = 9;
/** Gap between the connector tick and the summary box. */
export const SUMMARY_BOX_GAP = 16;
/** SVG span: parenthesis waist + connector tick (excludes box gap). */
export const SUMMARY_CONNECTOR_WIDTH = SUMMARY_BRACE_WIDTH * 0.5 + SUMMARY_CONNECTOR_LENGTH;
/** Total horizontal offset from brace origin to summary box left edge. */
export const SUMMARY_BOX_OFFSET = SUMMARY_CONNECTOR_WIDTH + SUMMARY_BOX_GAP;
export const SUMMARY_MAX_WIDTH = 375;
export const SUMMARY_BOX_PADDING_X = 12;
export const SUMMARY_BOX_PADDING_Y = 8;
export const SUMMARY_BOX_MIN_WIDTH = 72;
const SUMMARY_BORDER_WIDTH = 1.5;
const SUMMARY_FONT_SIZE = 13;
const SUMMARY_FONT_LINE_HEIGHT = SUMMARY_FONT_SIZE * 1.35;
const SUMMARY_CHAR_WIDTH = 7.5;
const SUMMARY_MEASURE_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SUMMARY_EDIT_WIDTH_BUFFER = 6;

let summaryMeasureCanvas: HTMLCanvasElement | null = null;

function getSummaryMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;

  if (!summaryMeasureCanvas) {
    summaryMeasureCanvas = document.createElement('canvas');
  }

  return summaryMeasureCanvas.getContext('2d');
}

function applySummaryMeasureFont(ctx: CanvasRenderingContext2D): void {
  ctx.font = `400 ${SUMMARY_FONT_SIZE}px ${SUMMARY_MEASURE_FONT_FAMILY}`;
}

function measureSummaryLineWidth(text: string, ctx: CanvasRenderingContext2D | null): number {
  if (!text) return 0;

  if (ctx) {
    applySummaryMeasureFont(ctx);
    const metrics = ctx.measureText(text);
    return metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  }

  return text.length * SUMMARY_CHAR_WIDTH;
}

function summaryAsBoundary(summary: Summary): Boundary {
  return {
    id: summary.id,
    parentId: summary.parentId,
    range: summary.range,
    topicIds: summary.topicIds,
    paddingTop: summary.paddingTop,
    paddingBottom: summary.paddingBottom,
  };
}

export function computeSummaryGroupRect(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  summary: Summary,
): Rect | null {
  return computeBoundaryRect(nodes, sheet, summaryAsBoundary(summary));
}

export function computeSummaryGroupContentRect(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  summary: Summary,
): Rect | null {
  return computeBoundaryContentRect(nodes, sheet, summaryAsBoundary(summary));
}

export function summaryGroupRectFromVerticalBand(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  summary: Summary,
  bandTop: number,
  bandBottom: number,
): Rect | null {
  return boundaryRectFromVerticalBand(nodes, sheet, summaryAsBoundary(summary), bandTop, bandBottom);
}

const SUMMARY_SNAP_THRESHOLD_PX = 8;

/** Ancestor topics (group roots) used for resize overlap and snap targets. */
export function collectSummarySnapAncestors(sheet: Sheet, summary: Summary): TopicId[] {
  const currentTopicIds = summary.topicIds ?? [];

  if (currentTopicIds.length === 1 && currentTopicIds[0] === sheet.rootTopicId) {
    return [sheet.rootTopicId];
  }

  const parent = sheet.topicsById[summary.parentId];
  return parent?.childrenIds ?? currentTopicIds;
}

export function summaryAncestorSnapYs(
  nodes: Map<string, NodeLayout>,
  ancestorIds: TopicId[],
): number[] {
  const ys: number[] = [];

  for (const topicId of ancestorIds) {
    const node = nodes.get(topicId);
    if (!node) continue;
    ys.push(node.y, node.y + node.height);
  }

  return ys;
}

function snapYToNearest(value: number, snapYs: number[], threshold: number): number {
  let snapped = value;
  let bestDistance = threshold;

  for (const y of snapYs) {
    const distance = Math.abs(y - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      snapped = y;
    }
  }

  return snapped;
}

export function snapSummaryResizeBand(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  summary: Summary,
  bandTop: number,
  bandBottom: number,
  handle: 'top' | 'bottom' | null,
  zoom: number,
): { top: number; bottom: number } {
  const ancestors = collectSummarySnapAncestors(sheet, summary);
  const snapYs = summaryAncestorSnapYs(nodes, ancestors);
  const threshold = SUMMARY_SNAP_THRESHOLD_PX / zoom;

  let top = bandTop;
  let bottom = bandBottom;

  if (handle === 'top') {
    top = snapYToNearest(bandTop, snapYs, threshold);
    top = Math.min(top, bottom - MIN_BOUNDARY_BAND_HEIGHT);
  } else if (handle === 'bottom') {
    bottom = snapYToNearest(bandBottom, snapYs, threshold);
    bottom = Math.max(bottom, top + MIN_BOUNDARY_BAND_HEIGHT);
  }

  return { top, bottom };
}

function summaryAncestorsInBand(
  sheet: Sheet,
  nodes: Map<string, NodeLayout>,
  summary: Summary,
  bandTop: number,
  bandBottom: number,
): TopicId[] {
  const parent = sheet.topicsById[summary.parentId];
  if (!parent) return [];

  const currentTopicIds = summary.topicIds ?? [];
  const isRootOnly =
    currentTopicIds.length === 1 && currentTopicIds[0] === sheet.rootTopicId;
  const ancestors = collectSummarySnapAncestors(sheet, summary);
  const included: TopicId[] = [];

  for (const topicId of ancestors) {
    const node = nodes.get(topicId);
    if (!node) continue;
    if (verticalOverlapFraction(node, bandTop, bandBottom) > 0.5) {
      included.push(topicId);
    }
  }

  if (included.length === 0 && isRootOnly) {
    const rootNode = nodes.get(sheet.rootTopicId);
    if (rootNode && verticalOverlapFraction(rootNode, bandTop, bandBottom) > 0.5) {
      included.push(sheet.rootTopicId);
    }
  }

  if (included.length === 0) {
    const fallbackCandidates =
      currentTopicIds.length > 0
        ? currentTopicIds
        : isRootOnly
          ? [sheet.rootTopicId]
          : ancestors;

    let bestId: TopicId | null = null;
    let bestOverlap = -1;

    for (const topicId of fallbackCandidates) {
      const node = nodes.get(topicId);
      if (!node) continue;
      const overlap = verticalOverlapFraction(node, bandTop, bandBottom);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestId = topicId;
      }
    }

    if (bestId) {
      included.push(bestId);
    }
  }

  if (included.length === 1 && included[0] === sheet.rootTopicId) {
    return [sheet.rootTopicId];
  }

  return [...included].sort(
    (a, b) => parent.childrenIds.indexOf(a) - parent.childrenIds.indexOf(b),
  );
}

function summaryPatchFromIncludedAncestors(
  sheet: Sheet,
  nodes: Map<string, NodeLayout>,
  summary: Summary,
  included: TopicId[],
  bandTop: number,
  bandBottom: number,
): Partial<Summary> {
  const parent = sheet.topicsById[summary.parentId];
  if (!parent) return {};

  if (included.length === 1 && included[0] === sheet.rootTopicId) {
    const content = computeSummaryGroupContentRect(nodes, sheet, {
      ...summary,
      topicIds: [sheet.rootTopicId],
      range: [0, 0],
    });

    return {
      topicIds: [sheet.rootTopicId],
      range: [0, 0],
      paddingTop: content
        ? paddingTopFromHandleY(content.y, bandTop)
        : DEFAULT_BOUNDARY_PADDING,
      paddingBottom: content
        ? paddingBottomFromHandleY(content.y + content.height, bandBottom)
        : DEFAULT_BOUNDARY_PADDING,
    };
  }

  const indices = included
    .map((topicId) => parent.childrenIds.indexOf(topicId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (indices.length === 0) return {};

  const nextTopicIds = [...included].sort(
    (a, b) => parent.childrenIds.indexOf(a) - parent.childrenIds.indexOf(b),
  );
  const nextRange: [number, number] = [indices[0]!, indices[indices.length - 1]!];
  const content = computeSummaryGroupContentRect(nodes, sheet, {
    ...summary,
    topicIds: nextTopicIds,
    range: nextRange,
  });

  return {
    topicIds: nextTopicIds,
    range: nextRange,
    paddingTop: content
      ? paddingTopFromHandleY(content.y, bandTop)
      : DEFAULT_BOUNDARY_PADDING,
    paddingBottom: content
      ? paddingBottomFromHandleY(content.y + content.height, bandBottom)
      : DEFAULT_BOUNDARY_PADDING,
  };
}

export function snapSummaryFromVerticalBand(
  sheet: Sheet,
  nodes: Map<string, NodeLayout>,
  summary: Summary,
  bandTop: number,
  bandBottom: number,
): Partial<Summary> {
  const ancestors = collectSummarySnapAncestors(sheet, summary);
  const snapYs = summaryAncestorSnapYs(nodes, ancestors);
  const top = Math.min(
    snapYToNearest(bandTop, snapYs, Infinity),
    bandBottom - MIN_BOUNDARY_BAND_HEIGHT,
  );
  const bottom = Math.max(
    snapYToNearest(bandBottom, snapYs, Infinity),
    top + MIN_BOUNDARY_BAND_HEIGHT,
  );
  const included = summaryAncestorsInBand(sheet, nodes, summary, top, bottom);

  return summaryPatchFromIncludedAncestors(sheet, nodes, summary, included, top, bottom);
}

/** X-coordinate where the parenthesis waist meets the horizontal tick. */
export function summaryConnectorStartX(width: number = SUMMARY_BRACE_WIDTH): number {
  return width * 0.5;
}

export function summaryConnectorSvgWidth(width: number = SUMMARY_BRACE_WIDTH): number {
  return Math.max(width, SUMMARY_CONNECTOR_WIDTH) + SUMMARY_HOOK_LENGTH;
}

/** Smooth parenthesis (tips left, bulge right) with small left-pointing end hooks. */
export function buildSummaryBracePath(height: number, width: number = SUMMARY_BRACE_WIDTH): string {
  const w = width;
  const h = height;
  const hook = SUMMARY_HOOK_LENGTH;

  return [
    `M ${-hook} 0`,
    `L 0 0`,
    `Q ${w} ${h / 2} 0 ${h}`,
    `L ${-hook} ${h}`,
  ].join(' ');
}

export function buildSummaryConnectorLine(height: number, width: number = SUMMARY_BRACE_WIDTH): string {
  const mid = height / 2;
  const startX = summaryConnectorStartX(width);
  return `M ${startX} ${mid} L ${startX + SUMMARY_CONNECTOR_LENGTH} ${mid}`;
}

export function buildSummaryConnectorPath(height: number, width: number = SUMMARY_BRACE_WIDTH): string {
  return [buildSummaryBracePath(height, width), buildSummaryConnectorLine(height, width)].join(' ');
}

function wrapSummaryLines(text: string, maxInnerWidth: number): string[] {
  const ctx = getSummaryMeasureContext();
  const result: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      result.push('');
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';

    for (const word of words) {
      const separator = line.length > 0 ? ' ' : '';
      const trial = `${line}${separator}${word}`;
      const trialWidth = measureSummaryLineWidth(trial, ctx);

      if (trialWidth <= maxInnerWidth || line.length === 0) {
        line = trial;
        continue;
      }

      result.push(line);
      line = word;
    }

    if (line.length > 0) {
      result.push(line);
    }
  }

  return result.length > 0 ? result : [''];
}

export function measureSummaryBoxSize(text: string): {
  width: number;
  height: number;
  singleLine: boolean;
} {
  const innerMax =
    SUMMARY_MAX_WIDTH - SUMMARY_BOX_PADDING_X * 2 - SUMMARY_BORDER_WIDTH * 2;
  const ctx = getSummaryMeasureContext();
  const lines = wrapSummaryLines(text, innerMax);
  const singleLine = lines.length === 1 && !text.includes('\n');
  const longestInner = Math.max(
    ...lines.map((line) => measureSummaryLineWidth(line, ctx)),
    0,
  );

  const width =
    lines.length > 1
      ? SUMMARY_MAX_WIDTH
      : Math.min(
          SUMMARY_MAX_WIDTH,
          Math.max(
            SUMMARY_BOX_MIN_WIDTH,
            Math.ceil(
              longestInner +
                SUMMARY_BOX_PADDING_X * 2 +
                SUMMARY_BORDER_WIDTH * 2 +
                SUMMARY_EDIT_WIDTH_BUFFER,
            ),
          ),
        );

  const height = Math.ceil(
    lines.length * SUMMARY_FONT_LINE_HEIGHT +
      SUMMARY_BOX_PADDING_Y * 2 +
      SUMMARY_BORDER_WIDTH * 2,
  );

  return { width, height, singleLine };
}

export interface SummaryLayout {
  groupRect: Rect;
  contentTop: number;
  contentBottom: number;
  midY: number;
  braceX: number;
  connectorWrap: Rect;
  boxRect: Rect;
  boxSingleLine: boolean;
}

export function computeSummaryLayout(
  nodes: Map<string, NodeLayout>,
  sheet: Sheet,
  summary: Summary,
  text: string,
  displayGroupRect?: Rect | null,
): SummaryLayout | null {
  const groupRect = displayGroupRect ?? computeSummaryGroupRect(nodes, sheet, summary);
  const contentRect = computeSummaryGroupContentRect(nodes, sheet, summary);
  if (!groupRect || !contentRect) return null;

  // Brace height always matches the group/highlight box, not just the node content.
  const contentTop = groupRect.y;
  const contentBottom = groupRect.y + groupRect.height;
  const braceHeight = Math.max(contentBottom - contentTop, 1);
  const midY = (contentTop + contentBottom) / 2;
  const braceX = contentRect.x + contentRect.width + SUMMARY_BRACE_GAP;

  const boxSize = measureSummaryBoxSize(text);
  const boxLeft = braceX + SUMMARY_BOX_OFFSET;

  return {
    groupRect,
    contentTop,
    contentBottom,
    midY,
    braceX,
    connectorWrap: {
      x: braceX,
      y: contentTop,
      width: summaryConnectorSvgWidth(),
      height: braceHeight,
    },
    boxRect: {
      x: boxLeft,
      y: midY - boxSize.height / 2,
      width: boxSize.width,
      height: boxSize.height,
    },
    boxSingleLine: boxSize.singleLine,
  };
}

export function computeSummaryBoxRect(groupRect: Rect, text: string): Rect {
  const boxSize = measureSummaryBoxSize(text);
  const midY = groupRect.y + groupRect.height / 2;
  const braceX = groupRect.x + groupRect.width + SUMMARY_BRACE_GAP;

  return {
    x: braceX + SUMMARY_BOX_OFFSET,
    y: midY - boxSize.height / 2,
    width: boxSize.width,
    height: boxSize.height,
  };
}

import { topicHasEquation, equationScale, equationPlacement, topicHasVisibleText } from '@/core/model/equation';
import { topicShowsAttachmentAffordance } from '@/core/model/attachments';
import {
   sortTopicStickers,
   stickerRowWidth,
   topicAllowsStickers,
   topicHasStickers,
   TOPIC_ATTACHMENT_ICON_SIZE,
   TOPIC_TEXT_ICON_GAP,
} from '@/core/model/stickers';
import type { Sheet, Topic, TopicEquation, TopicId, TopicStyle } from '@/core/model/types';
import type { NodeMeasurement } from './types';
import { renderLatex } from '@/lib/katexRender';

export const MAX_TOPIC_WIDTH = 280;
/** Max width for the central topic before text wraps. */
export const ROOT_MAX_TOPIC_WIDTH = 520;
/** Max inner text width before the root title wraps. */
const ROOT_WRAP_TEXT_WIDTH = 340;
const ROOT_PADDING_X = 20;
const ROOT_PADDING_Y = 26;
export const PADDING_X = 14;
export const PADDING_Y = 10;
export const CHILD_PADDING_X = 18;
export const CHILD_PADDING_Y = 5;
export const LINE_HEIGHT_RATIO = 1.35;
/** Trailing attachment icon width + text-to-icon gap. */
const NOTES_ICON_AFFORDANCE_WIDTH = TOPIC_ATTACHMENT_ICON_SIZE + TOPIC_TEXT_ICON_GAP;
export const MAIN_PADDING_X = 16;
const EDIT_WIDTH_BUFFER = 6;
const EQUATION_BASE_HEIGHT = 28;
const EQUATION_VERTICAL_GAP = 6;
const EQUATION_HORIZONTAL_GAP = 8;
/** Matches .topic-view__equation horizontal padding (6px × 2). */
const EQUATION_PADDING_X = 12;
/** Matches .topic-view__equation vertical padding (4px × 2). */
const EQUATION_PADDING_Y = 8;

let equationMeasureHost: HTMLDivElement | null = null;

function getEquationMeasureHost(): HTMLDivElement | null {
   if (typeof document === 'undefined') return null;

   if (!equationMeasureHost) {
      equationMeasureHost = document.createElement('div');
      equationMeasureHost.className = 'topic-view__equation topic-view__equation-measure-host';
      equationMeasureHost.style.cssText =
         'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;white-space:nowrap;';
      document.body.appendChild(equationMeasureHost);
   }

   return equationMeasureHost;
}

export function measureEquationBlock(
   equation: TopicEquation | undefined,
   depth: number,
): { width: number; height: number } | null {
   if (!topicHasEquation(equation)) return null;

   const scale = equationScale(equation);
   const rendered = renderLatex(equation!.latex);
   const host = getEquationMeasureHost();
   const baseFontSize = styleForDepth(depth).fontSize;

   if (host && rendered.ok) {
      host.style.fontSize = `${baseFontSize * scale}px`;
      host.style.lineHeight = '1';
      host.innerHTML = `<span class="topic-view__equation-math">${rendered.html}</span>`;

      const rect = host.getBoundingClientRect();
      const renderedHeight = Math.max(rect.height, host.scrollHeight, host.offsetHeight);
      const renderedWidth = Math.max(rect.width, host.scrollWidth, host.offsetWidth);
      const width = Math.ceil(renderedWidth) + EQUATION_PADDING_X;
      const height = Math.ceil(renderedHeight) + EQUATION_PADDING_Y;
      host.innerHTML = '';
      return { width, height };
   }

   const latexLength = equation!.latex.length;
   const width = Math.ceil((latexLength * 6 + 24) * scale) + EQUATION_PADDING_X;
   const height = Math.ceil(EQUATION_BASE_HEIGHT * scale) + EQUATION_PADDING_Y;
   return { width, height };
}

function resolveTopicWidth(
   depth: number,
   contentWidth: number,
   maxWidth: number,
   hasEquation: boolean,
   stickerCount: number,
): number {
   if (hasEquation) return contentWidth;
   if (depth === 0) return Math.min(ROOT_MAX_TOPIC_WIDTH, contentWidth);
   if (stickerCount > 0) return contentWidth;
   return Math.min(maxWidth, contentWidth);
}

const measureCache = new Map<string, NodeMeasurement>();

const MEASURE_FONT_FAMILY =
   'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
   if (typeof document === 'undefined') return null;

   if (!measureCanvas) {
      measureCanvas = document.createElement('canvas');
   }

   return measureCanvas.getContext('2d');
}

export function styleForDepth(depth: number): Required<
   Pick<TopicStyle, 'fontSize' | 'bold'>
> {
   if (depth === 0) return { fontSize: 34, bold: true };
   if (depth === 1) return { fontSize: 18, bold: false };
   return { fontSize: 13, bold: false };
}

function maxTopicWidthForDepth(depth: number): number {
   if (depth === 0) return ROOT_MAX_TOPIC_WIDTH;
   if (depth === 1) return 500;
   return MAX_TOPIC_WIDTH;
}

function measurementKey(
   text: string,
   style: Required<Pick<TopicStyle, 'fontSize' | 'bold'>>,
   depth: number,
   showAttachmentIcon: boolean,
   stickerCount: number,
   equation?: TopicEquation,
): string {
   const eqKey = equation?.latex
      ? `${equation.latex}|${equationScale(equation)}|${equationPlacement(equation)}`
      : '';
   return `${text}|${style.fontSize}|${style.bold ? 1 : 0}|${depth}|${showAttachmentIcon ? 1 : 0}|${stickerCount}|${eqKey}`;
}

function estimateCharWidth(fontSize: number, bold: boolean): number {
   return fontSize * (bold ? 0.58 : 0.52);
}

function splitLongWordEstimate(
   word: string,
   maxTextWidth: number,
   fontSize: number,
   bold: boolean,
): string[] {
   const charWidth = estimateCharWidth(fontSize, bold);
   if (word.length * charWidth <= maxTextWidth) return [word];

   const parts: string[] = [];
   let current = '';

   for (const char of word) {
      const candidate = current + char;
      if (candidate.length * charWidth <= maxTextWidth || current === '') {
         current = candidate;
         continue;
      }

      parts.push(current);
      current = char;
   }

   if (current) parts.push(current);
   return parts;
}

function splitLongWordCanvas(
   word: string,
   maxTextWidth: number,
   ctx: CanvasRenderingContext2D,
): string[] {
   if (ctx.measureText(word).width <= maxTextWidth) return [word];

   const parts: string[] = [];
   let current = '';

   for (const char of word) {
      const candidate = current + char;
      if (ctx.measureText(candidate).width <= maxTextWidth || current === '') {
         current = candidate;
         continue;
      }

      parts.push(current);
      current = char;
   }

   if (current) parts.push(current);
   return parts;
}

function expandWordsEstimate(
   text: string,
   maxTextWidth: number,
   fontSize: number,
   bold: boolean,
): string[] {
   const expanded: string[] = [];

   for (const word of text.split(/\s+/).filter(Boolean)) {
      expanded.push(...splitLongWordEstimate(word, maxTextWidth, fontSize, bold));
   }

   return expanded;
}

function expandWordsCanvas(
   text: string,
   maxTextWidth: number,
   ctx: CanvasRenderingContext2D,
): string[] {
   const expanded: string[] = [];

   for (const word of text.split(/\s+/).filter(Boolean)) {
      expanded.push(...splitLongWordCanvas(word, maxTextWidth, ctx));
   }

   return expanded;
}

function wrapTextEstimate(
   text: string,
   maxTextWidth: number,
   fontSize: number,
   bold: boolean,
): string[] {
   const words = expandWordsEstimate(text, maxTextWidth, fontSize, bold);
   if (words.length === 0) return [''];

   const charWidth = estimateCharWidth(fontSize, bold);
   const lines: string[] = [];
   let current = '';

   for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length * charWidth <= maxTextWidth) {
         current = candidate;
         continue;
      }

      if (current) lines.push(current);
      current = word;
   }

   if (current) lines.push(current);
   return lines;
}

function wrapTextCanvas(
   text: string,
   maxTextWidth: number,
   ctx: CanvasRenderingContext2D,
): string[] {
   const words = expandWordsCanvas(text, maxTextWidth, ctx);
   if (words.length === 0) return [''];

   const lines: string[] = [];
   let current = '';

   for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxTextWidth) {
         current = candidate;
         continue;
      }

      if (current) lines.push(current);
      current = word;
   }

   if (current) lines.push(current);
   return lines;
}

function cssFontWeight(depth: number, bold: boolean): number {
   if (depth === 0) return 700;
   if (depth === 1) return 500;
   if (bold) return 600;
   return 400;
}

function applyMeasureFont(
   ctx: CanvasRenderingContext2D,
   depth: number,
   fontSize: number,
   bold: boolean,
): void {
   ctx.font = `${cssFontWeight(depth, bold)} ${fontSize}px ${MEASURE_FONT_FAMILY}`;
}

function paddingForDepth(depth: number): { padX: number; padTop: number; padBottom: number } {
   const padX = depth === 0 ? ROOT_PADDING_X : depth === 1 ? MAIN_PADDING_X : CHILD_PADDING_X;
   const padTop = depth === 0 ? ROOT_PADDING_Y : depth >= 2 ? CHILD_PADDING_Y : 8;
   const padBottom = depth === 0 ? ROOT_PADDING_Y : depth >= 2 ? CHILD_PADDING_Y : 8;
   return { padX, padTop, padBottom };
}

export function horizontalPadForDepth(depth: number): number {
   return paddingForDepth(depth).padX;
}

function measureLineWidth(
   text: string,
   depth: number,
   fontSize: number,
   bold: boolean,
   ctx: CanvasRenderingContext2D | null,
): number {
   if (!text) return 0;

   if (ctx) {
      applyMeasureFont(ctx, depth, fontSize, bold);
      const metrics = ctx.measureText(text);
      // Include glyph side-bearings so the box fits what the browser paints.
      return metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
   }

   return text.length * estimateCharWidth(fontSize, bold);
}

/** While typing: grow on one line until the node max width, then wrap. */
export function measureTopicForEdit(
   text: string,
   depth: number,
   styleOverride?: TopicStyle,
   showAttachmentIcon = false,
   stickerCount = 0,
): NodeMeasurement {
   const depthStyle = styleForDepth(depth);
   const fontSize = styleOverride?.fontSize ?? depthStyle.fontSize;
   const bold = styleOverride?.bold ?? depthStyle.bold;
   const { padX, padTop, padBottom } = paddingForDepth(depth);
   const maxWidth = depth === 0 ? ROOT_MAX_TOPIC_WIDTH : maxTopicWidthForDepth(depth);
   const lineHeight = fontSize * LINE_HEIGHT_RATIO;
   const ctx = getMeasureContext();
   const displayText = text;
   const iconAffordance =
      showAttachmentIcon && depth > 0 ? NOTES_ICON_AFFORDANCE_WIDTH : 0;
   const stickerAffordance = stickerCount > 0 ? stickerRowWidth(stickerCount) : 0;
   const innerAffordances = iconAffordance + stickerAffordance;

   const charWidth = estimateCharWidth(fontSize, bold);
   const minInnerWidth = Math.ceil(charWidth * 2);
   const lineWidth = measureLineWidth(displayText, depth, fontSize, bold, ctx);
   const contentWidth = Math.ceil(
      Math.max(lineWidth, minInnerWidth) + padX * 2 + innerAffordances + EDIT_WIDTH_BUFFER,
   );

   if (contentWidth <= maxWidth || stickerCount > 0) {
      return {
         width: contentWidth,
         height: Math.ceil(lineHeight + padTop + padBottom),
         lines: [displayText],
         fontSize,
         lineHeight,
      };
   }

   return measureTopic(text, depth, styleOverride, showAttachmentIcon, undefined, stickerCount);
}

export function measureTopic(
   text: string,
   depth: number,
   styleOverride?: TopicStyle,
   showAttachmentIcon = false,
   equation?: TopicEquation,
   stickerCount = 0,
): NodeMeasurement {
   const depthStyle = styleForDepth(depth);
   const fontSize = styleOverride?.fontSize ?? depthStyle.fontSize;
   const bold = styleOverride?.bold ?? depthStyle.bold;
   const style = { fontSize, bold };
   const key = measurementKey(text, style, depth, showAttachmentIcon, stickerCount, equation);

   const cached = measureCache.get(key);
   if (cached) return cached;

   const padX =
      depth === 0 ? ROOT_PADDING_X : depth === 1 ? MAIN_PADDING_X : CHILD_PADDING_X;
   const padTop = depth === 0 ? ROOT_PADDING_Y : depth >= 2 ? CHILD_PADDING_Y : 8;
   const padBottom = depth === 0 ? ROOT_PADDING_Y : depth >= 2 ? CHILD_PADDING_Y : 8;
   const maxWidth = maxTopicWidthForDepth(depth);
   const iconAffordance =
      showAttachmentIcon && depth > 0 ? NOTES_ICON_AFFORDANCE_WIDTH : 0;
   const stickerAffordance = stickerCount > 0 ? stickerRowWidth(stickerCount) : 0;
   const innerAffordances = iconAffordance + stickerAffordance;
   const maxTextWidth =
      depth === 0
         ? ROOT_WRAP_TEXT_WIDTH
         : Math.max(40, maxWidth - padX * 2 - innerAffordances);
   const lineHeight = fontSize * LINE_HEIGHT_RATIO;
   const ctx = getMeasureContext();
   const hasVisibleText = topicHasVisibleText(text);

   let lines: string[];
   let maxLineWidth: number;
   if (stickerCount > 0 && hasVisibleText) {
      lines = [text];
      maxLineWidth = measureLineWidth(text, depth, fontSize, bold, ctx);
   } else if (ctx) {
      applyMeasureFont(ctx, depth, fontSize, bold);
      lines = wrapTextCanvas(text, maxTextWidth, ctx);
      maxLineWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
   } else {
      lines = wrapTextEstimate(text, maxTextWidth, fontSize, bold);
      const charWidth = estimateCharWidth(fontSize, bold);
      maxLineWidth = lines.reduce((max, line) => Math.max(max, line.length * charWidth), 0);
   }

   const charWidth = estimateCharWidth(fontSize, bold);
   const hasEquation = topicHasEquation(equation);
   const equationOnly = hasEquation && !hasVisibleText;
   const textContentWidth = Math.ceil(maxLineWidth + padX * 2 + innerAffordances);

   const equationBlock = measureEquationBlock(equation, depth);
   const textBlockHeight = hasVisibleText ? lines.length * lineHeight : 0;
   const side = equationPlacement(equation);
   const isHorizontal = side === 'left' || side === 'right';

   let contentWidth = textContentWidth;
   let contentHeight = textBlockHeight;

   if (!hasVisibleText && !hasEquation) {
      const minInnerWidth = Math.ceil(charWidth * 2);
      contentWidth = Math.max(contentWidth, minInnerWidth + padX * 2 + innerAffordances);
      contentHeight = Math.max(contentHeight, lineHeight);
   }

   if (!hasVisibleText && showAttachmentIcon && innerAffordances > 0) {
      contentWidth = Math.max(contentWidth, padX * 2 + innerAffordances);
      contentHeight = Math.max(contentHeight, lineHeight);
   }

   if (equationBlock) {
      if (equationOnly) {
         contentWidth = equationBlock.width + padX * 2 + (showAttachmentIcon ? innerAffordances : 0);
         contentHeight = equationBlock.height;
         lines = [];
      } else {
         const textInnerWidth = Math.ceil(maxLineWidth + innerAffordances);
         if (isHorizontal) {
            contentWidth = Math.max(
               textContentWidth,
               equationBlock.width + textInnerWidth + padX * 2 + EQUATION_HORIZONTAL_GAP,
            );
            contentHeight = Math.max(textBlockHeight, equationBlock.height);
         } else {
            contentWidth = Math.max(
               textContentWidth,
               equationBlock.width + padX * 2,
               textInnerWidth + padX * 2,
            );
            contentHeight = textBlockHeight + equationBlock.height + EQUATION_VERTICAL_GAP;
         }
      }
   }

   const measurement: NodeMeasurement = {
      width: resolveTopicWidth(depth, contentWidth, maxWidth, hasEquation, stickerCount),
      height: Math.ceil(contentHeight + padTop + padBottom),
      lines,
      fontSize,
      lineHeight,
   };

   measureCache.set(key, measurement);
   return measurement;
}

export function measureSheet(
   sheet: Sheet,
   depthById: Map<TopicId, number>,
   editingTopicId?: TopicId,
): Map<TopicId, NodeMeasurement> {
   const measurements = new Map<TopicId, NodeMeasurement>();

   for (const [topicId, topic] of Object.entries(sheet.topicsById)) {
      const depth = depthById.get(topicId) ?? 0;
      const showAttachment = topicShowsAttachmentAffordance(topic.notes, {
        webLink: topic.webLink,
        cloudLink: topic.cloudLink,
        topicLink: topic.topicLink,
      });
      const stickerCount =
         topicAllowsStickers(sheet, topicId) && topicHasStickers(topic.markers)
            ? sortTopicStickers(topic.markers).length
            : 0;
      const measurement =
         topicId === editingTopicId
            ? topicHasEquation(topic.equation)
               ? measureTopic(
                    topic.text,
                    depth,
                    topic.style,
                    showAttachment,
                    topic.equation,
                    stickerCount,
                 )
               : measureTopicForEdit(topic.text, depth, topic.style, showAttachment, stickerCount)
            : measureTopic(
                 topic.text,
                 depth,
                 topic.style,
                 showAttachment,
                 topic.equation,
                 stickerCount,
              );
      measurements.set(topicId, measurement);
   }

   return measurements;
}

export function clearMeasureCache(): void {
   measureCache.clear();
}

export function getVisibleChildren(sheet: Sheet, topic: Topic): Topic[] {
   if (topic.collapsed) return [];

   return topic.childrenIds
      .map((id) => sheet.topicsById[id])
      .filter((child): child is Topic => Boolean(child));
}

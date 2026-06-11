import { topicHasNotes } from '@/core/model/notes';
import type { Sheet, Topic, TopicId, TopicStyle } from '@/core/model/types';
import type { NodeMeasurement } from './types';

export const MAX_TOPIC_WIDTH = 280;
/** Max width for the central topic before text wraps. */
export const ROOT_MAX_TOPIC_WIDTH = 520;
/** Max inner text width before the root title wraps. */
const ROOT_WRAP_TEXT_WIDTH = 340;
const ROOT_PADDING_X = 20;
const ROOT_PADDING_Y = 26;
export const PADDING_X = 14;
export const PADDING_Y = 10;
export const CHILD_PADDING_X = 10;
export const CHILD_PADDING_Y = 5;
export const LINE_HEIGHT_RATIO = 1.35;
const NOTES_ICON_AFFORDANCE_WIDTH = 22;
const MAIN_PADDING_X = 8;
const EDIT_WIDTH_BUFFER = 6;

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
   showNotesIcon: boolean,
): string {
   return `${text}|${style.fontSize}|${style.bold ? 1 : 0}|${depth}|${showNotesIcon ? 1 : 0}`;
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
): NodeMeasurement {
   const depthStyle = styleForDepth(depth);
   const fontSize = styleOverride?.fontSize ?? depthStyle.fontSize;
   const bold = styleOverride?.bold ?? depthStyle.bold;
   const { padX, padTop, padBottom } = paddingForDepth(depth);
   const maxWidth = depth === 0 ? ROOT_MAX_TOPIC_WIDTH : maxTopicWidthForDepth(depth);
   const lineHeight = fontSize * LINE_HEIGHT_RATIO;
   const ctx = getMeasureContext();
   const displayText = text;

   const lineWidth = measureLineWidth(displayText, depth, fontSize, bold, ctx);
   const contentWidth = Math.ceil(lineWidth + padX * 2 + EDIT_WIDTH_BUFFER);

   if (contentWidth <= maxWidth) {
      return {
         width: contentWidth,
         height: Math.ceil(lineHeight + padTop + padBottom),
         lines: [displayText],
         fontSize,
         lineHeight,
      };
   }

   return measureTopic(text, depth, styleOverride, false);
}

export function measureTopic(
   text: string,
   depth: number,
   styleOverride?: TopicStyle,
   showNotesIcon = false,
): NodeMeasurement {
   const depthStyle = styleForDepth(depth);
   const fontSize = styleOverride?.fontSize ?? depthStyle.fontSize;
   const bold = styleOverride?.bold ?? depthStyle.bold;
   const style = { fontSize, bold };
   const key = measurementKey(text, style, depth, showNotesIcon);

   const cached = measureCache.get(key);
   if (cached) return cached;

   const padX =
      depth === 0 ? ROOT_PADDING_X : depth === 1 ? MAIN_PADDING_X : CHILD_PADDING_X;
   const padTop = depth === 0 ? ROOT_PADDING_Y : depth >= 2 ? CHILD_PADDING_Y : 8;
   const padBottom = depth === 0 ? ROOT_PADDING_Y : depth >= 2 ? CHILD_PADDING_Y : 8;
   const maxWidth = maxTopicWidthForDepth(depth);
   const maxTextWidth = depth === 0 ? ROOT_WRAP_TEXT_WIDTH : maxWidth - padX * 2;
   const lineHeight = fontSize * LINE_HEIGHT_RATIO;
   const ctx = getMeasureContext();

   let lines: string[];
   if (ctx) {
      applyMeasureFont(ctx, depth, fontSize, bold);
      lines = wrapTextCanvas(text, maxTextWidth, ctx);
   } else {
      lines = wrapTextEstimate(text, maxTextWidth, fontSize, bold);
   }

   const charWidth = estimateCharWidth(fontSize, bold);
   const maxLineWidth = ctx
      ? lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)
      : lines.reduce((max, line) => Math.max(max, line.length * charWidth), 0);

   const iconAffordance =
      showNotesIcon && depth > 0 ? NOTES_ICON_AFFORDANCE_WIDTH : 0;
   const contentWidth = Math.ceil(maxLineWidth + padX * 2 + iconAffordance);

   const measurement: NodeMeasurement = {
      width:
         depth === 0
            ? Math.min(ROOT_MAX_TOPIC_WIDTH, contentWidth)
            : Math.min(maxWidth, contentWidth),
      height: Math.ceil(lines.length * lineHeight + padTop + padBottom),
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
      const measurement =
         topicId === editingTopicId
            ? measureTopicForEdit(topic.text, depth, topic.style)
            : measureTopic(topic.text, depth, topic.style, topicHasNotes(topic.notes));
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

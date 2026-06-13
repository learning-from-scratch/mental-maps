import { DEFAULT_MAP_THEME_ID, getMapTheme, relativeLuminance } from '@/layout/theme';
import type { MarkerId, Sheet, StickerLegendState, TopicId, Vec2 } from './types';

export type StickerCategory =
  | 'tag'
  | 'priority'
  | 'task'
  | 'flag'
  | 'star'
  | 'people'
  | 'symbol';

export type StickerColorId = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'grey';

export const STICKER_COLOR_IDS: StickerColorId[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'grey',
];

export interface StickerColor {
  id: StickerColorId;
}

export interface StickerDefinition {
  id: MarkerId;
  category: StickerCategory;
  label: string;
  colorId: StickerColorId;
  glyph?: string;
  icon?: string;
}

function mixHexChannel(channel: number, target: number, ratio: number): string {
  return Math.round(channel + (target - channel) * ratio)
    .toString(16)
    .padStart(2, '0');
}

function mixHex(hex: string, target: [number, number, number], ratio: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `#${mixHexChannel(r, target[0], ratio)}${mixHexChannel(g, target[1], ratio)}${mixHexChannel(
    b,
    target[2],
    ratio,
  )}`;
}

function mixWithWhite(hex: string, ratio: number): string {
  return mixHex(hex, [255, 255, 255], ratio);
}

function mixWithBlack(hex: string, ratio: number): string {
  return mixHex(hex, [0, 0, 0], ratio);
}

function mixTwoColors(from: string, to: string, ratio: number): string {
  const source = from.replace('#', '');
  const target = to.replace('#', '');
  const sr = parseInt(source.slice(0, 2), 16);
  const sg = parseInt(source.slice(2, 4), 16);
  const sb = parseInt(source.slice(4, 6), 16);
  const tr = parseInt(target.slice(0, 2), 16);
  const tg = parseInt(target.slice(2, 4), 16);
  const tb = parseInt(target.slice(4, 6), 16);

  return `#${mixHexChannel(sr, tr, ratio)}${mixHexChannel(sg, tg, ratio)}${mixHexChannel(
    sb,
    tb,
    ratio,
  )}`;
}

/** Canonical sticker hues — each slot keeps its recognizable color family. */
const SEMANTIC_STICKER_COLORS: Record<StickerColorId, string> = {
  red: '#ef5350',
  orange: '#fb8c00',
  yellow: '#fdd835',
  green: '#4caf50',
  blue: '#42a5f5',
  purple: '#7e57c2',
  grey: '#9e9e9e',
};

/** How much of the active theme is mixed in (semantic color remains dominant). */
const THEME_BLEND_RATIO = 0.28;

function themeAccentPalette(themeId: string): Record<StickerColorId, string> {
  const theme = getMapTheme(themeId) ?? getMapTheme(DEFAULT_MAP_THEME_ID)!;
  const colors = theme.colors;
  const orange = colors[1] ?? colors[0]!;
  let purple = colors[colors.length - 1]!;
  if (relativeLuminance(purple) > 0.72) {
    purple = colors[colors.length - 2] ?? purple;
  }

  return {
    red: colors[0]!,
    orange,
    yellow: mixWithWhite(orange, 0.28),
    green: colors[2] ?? orange,
    blue: colors[Math.min(4, colors.length - 1)]!,
    purple,
    grey: mixWithBlack(theme.canvas.dotColor, 0.42),
  };
}

/** Semantic sticker colors lightly tinted to harmonize with the active map theme. */
export function stickerColorPalette(
  themeId: string = DEFAULT_MAP_THEME_ID,
): Record<StickerColorId, string> {
  const accents = themeAccentPalette(themeId);

  return Object.fromEntries(
    STICKER_COLOR_IDS.map((colorId) => [
      colorId,
      mixTwoColors(SEMANTIC_STICKER_COLORS[colorId], accents[colorId], THEME_BLEND_RATIO),
    ]),
  ) as Record<StickerColorId, string>;
}

export function resolveStickerColor(
  sticker: StickerDefinition,
  themeId: string = DEFAULT_MAP_THEME_ID,
): string {
  return stickerColorPalette(themeId)[sticker.colorId];
}

function colorStickers(
  category: Exclude<StickerCategory, 'task' | 'symbol'>,
  labelPrefix: string,
): StickerDefinition[] {
  return STICKER_COLOR_IDS.map((colorId, index) => ({
    id: `${category}:${colorId}`,
    category,
    label: category === 'priority' ? `${index + 1}` : `${labelPrefix} ${colorId}`,
    colorId,
    glyph: category === 'priority' ? `${index + 1}` : undefined,
    icon:
      category === 'flag'
        ? 'flag'
        : category === 'star'
          ? 'star'
          : category === 'people'
            ? 'user'
            : undefined,
  }));
}

const TASK_STICKERS: StickerDefinition[] = [
  { id: 'task:play', category: 'task', label: 'Start', colorId: 'green', icon: 'play' },
  { id: 'task:25', category: 'task', label: '25%', colorId: 'green', glyph: '25' },
  { id: 'task:50', category: 'task', label: '50%', colorId: 'green', glyph: '50' },
  { id: 'task:75', category: 'task', label: '75%', colorId: 'green', glyph: '75' },
  { id: 'task:90', category: 'task', label: '90%', colorId: 'green', glyph: '90' },
  { id: 'task:full', category: 'task', label: 'Complete', colorId: 'green', icon: 'circle' },
  { id: 'task:done', category: 'task', label: 'Done', colorId: 'green', icon: 'check' },
];

const SYMBOL_STICKERS: StickerDefinition[] = [
  { id: 'symbol:heart', category: 'symbol', label: 'Heart', colorId: 'red', icon: 'heart' },
  { id: 'symbol:thumbs-up', category: 'symbol', label: 'Thumbs up', colorId: 'red', icon: 'thumbs-up' },
  { id: 'symbol:thumbs-down', category: 'symbol', label: 'Thumbs down', colorId: 'blue', icon: 'thumbs-down' },
  { id: 'symbol:pin', category: 'symbol', label: 'Pin', colorId: 'red', icon: 'pin' },
  { id: 'symbol:lightbulb', category: 'symbol', label: 'Idea', colorId: 'yellow', icon: 'lightbulb' },
  { id: 'symbol:zap', category: 'symbol', label: 'Energy', colorId: 'blue', icon: 'zap' },
  { id: 'symbol:hourglass', category: 'symbol', label: 'Waiting', colorId: 'orange', icon: 'hourglass' },
  { id: 'symbol:phone', category: 'symbol', label: 'Phone', colorId: 'green', icon: 'phone' },
  { id: 'symbol:pencil', category: 'symbol', label: 'Edit', colorId: 'orange', icon: 'pencil' },
  { id: 'symbol:music', category: 'symbol', label: 'Music', colorId: 'purple', icon: 'music' },
  { id: 'symbol:gamepad', category: 'symbol', label: 'Game', colorId: 'yellow', icon: 'gamepad-2' },
  { id: 'symbol:hundred', category: 'symbol', label: '100', colorId: 'red', glyph: '100' },
  { id: 'symbol:plane', category: 'symbol', label: 'Travel', colorId: 'blue', icon: 'plane' },
  { id: 'symbol:run', category: 'symbol', label: 'Active', colorId: 'green', icon: 'person-standing' },
  { id: 'symbol:alert', category: 'symbol', label: 'Alert', colorId: 'red', icon: 'circle-alert' },
  { id: 'symbol:question', category: 'symbol', label: 'Question', colorId: 'blue', icon: 'circle-help' },
];

export const STICKER_CATEGORIES: Array<{ id: StickerCategory; label: string; stickers: StickerDefinition[] }> = [
  { id: 'tag', label: 'Tag', stickers: colorStickers('tag', 'Tag') },
  { id: 'priority', label: 'Priority', stickers: colorStickers('priority', 'Priority') },
  { id: 'task', label: 'Task', stickers: TASK_STICKERS },
  { id: 'flag', label: 'Flag', stickers: colorStickers('flag', 'Flag') },
  { id: 'star', label: 'Star', stickers: colorStickers('star', 'Star') },
  { id: 'people', label: 'People', stickers: colorStickers('people', 'People') },
  { id: 'symbol', label: 'Symbol', stickers: SYMBOL_STICKERS },
];

const STICKER_BY_ID = new Map<MarkerId, StickerDefinition>(
  STICKER_CATEGORIES.flatMap((section) => section.stickers.map((sticker) => [sticker.id, sticker])),
);

const CATEGORY_ORDER = STICKER_CATEGORIES.map((section) => section.id);

export const STICKER_SIZE = 22;
/** Horizontal overlap between stacked on-node stickers. */
export const STICKER_STACK_OVERLAP = 6;
/** Space between the sticker row and topic text (second-largest inner gap). */
export const STICKER_TEXT_GAP = 14;
/** Space between topic text and the trailing attachment icon (smallest inner gap). */
export const TOPIC_TEXT_ICON_GAP = 6;
export const TOPIC_ATTACHMENT_ICON_SIZE = 16;

export function stickerRowWidth(count: number): number {
  if (count <= 0) return 0;
  const stackStep = STICKER_SIZE - STICKER_STACK_OVERLAP;
  return STICKER_SIZE + (count - 1) * stackStep + STICKER_TEXT_GAP;
}

export function stickerCategory(markerId: MarkerId): StickerCategory | null {
  const sticker = STICKER_BY_ID.get(markerId);
  return sticker?.category ?? null;
}

export function getStickerDefinition(markerId: MarkerId): StickerDefinition | undefined {
  return STICKER_BY_ID.get(markerId);
}

export function getStickerCategoriesForTheme(themeId: string = DEFAULT_MAP_THEME_ID) {
  const palette = stickerColorPalette(themeId);
  return STICKER_CATEGORIES.map((section) => ({
    ...section,
    stickers: section.stickers.map((sticker) => ({
      ...sticker,
      color: palette[sticker.colorId],
    })),
  }));
}

export function getStickersForCategory(
  category: StickerCategory,
  themeId: string = DEFAULT_MAP_THEME_ID,
) {
  const section = getStickerCategoriesForTheme(themeId).find((entry) => entry.id === category);
  return section?.stickers ?? [];
}

export function topicAllowsStickers(sheet: Sheet, topicId: TopicId): boolean {
  return topicId !== sheet.rootTopicId;
}

export function topicHasStickers(markers: MarkerId[] | undefined): boolean {
  return Boolean(markers?.some((markerId) => STICKER_BY_ID.has(markerId)));
}

export function sortTopicStickers(markers: MarkerId[]): MarkerId[] {
  return markers
    .filter((markerId) => STICKER_BY_ID.has(markerId))
    .sort((left, right) => {
      const leftCategory = stickerCategory(left);
      const rightCategory = stickerCategory(right);
      if (!leftCategory || !rightCategory) return 0;
      return CATEGORY_ORDER.indexOf(leftCategory) - CATEGORY_ORDER.indexOf(rightCategory);
    });
}

export function toggleTopicSticker(markers: MarkerId[], stickerId: MarkerId): MarkerId[] {
  const category = stickerCategory(stickerId);
  if (!category) return markers;

  const nonStickerMarkers = markers.filter((markerId) => !STICKER_BY_ID.has(markerId));
  const currentStickers = sortTopicStickers(markers);
  const withoutCategory = currentStickers.filter((markerId) => stickerCategory(markerId) !== category);

  if (currentStickers.includes(stickerId)) {
    return [...nonStickerMarkers, ...withoutCategory];
  }

  return [...nonStickerMarkers, ...withoutCategory, stickerId];
}

export function createDefaultStickerLegendState(position: Vec2): StickerLegendState {
  return {
    visible: false,
    position,
    labelOverrides: {},
  };
}

export function collectSheetStickerIds(sheet: Sheet): MarkerId[] {
  const ids = new Set<MarkerId>();
  for (const topic of Object.values(sheet.topicsById)) {
    for (const markerId of topic.markers ?? []) {
      if (STICKER_BY_ID.has(markerId)) ids.add(markerId);
    }
  }
  return sortTopicStickers([...ids]);
}

export function resolveStickerLegendLabel(
  markerId: MarkerId,
  labelOverrides: Record<MarkerId, string> | undefined,
): string {
  const override = labelOverrides?.[markerId]?.trim();
  if (override) return override;
  return getStickerDefinition(markerId)?.label ?? markerId;
}

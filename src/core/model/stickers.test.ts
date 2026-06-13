import { describe, expect, it } from 'vitest';
import { createSheet, createTopic } from './factories';
import {
  collectSheetStickerIds,
  resolveStickerLegendLabel,
  sortTopicStickers,
  stickerCategory,
  stickerColorPalette,
  stickerRowWidth,
  toggleTopicSticker,
  topicAllowsStickers,
  topicHasStickers,
} from './stickers';

describe('stickers', () => {
  it('replaces stickers within the same category', () => {
    const next = toggleTopicSticker(['priority:red'], 'priority:blue');
    expect(next).toEqual(['priority:blue']);
  });

  it('keeps stickers from different categories', () => {
    const next = toggleTopicSticker(['flag:red', 'priority:red'], 'star:orange');
    expect(sortTopicStickers(next)).toEqual(['priority:red', 'flag:red', 'star:orange']);
  });

  it('removes a sticker when selecting it again', () => {
    const next = toggleTopicSticker(['symbol:heart', 'flag:red'], 'symbol:heart');
    expect(next).toEqual(['flag:red']);
  });

  it('sorts stickers by category order', () => {
    expect(sortTopicStickers(['symbol:heart', 'priority:yellow', 'flag:blue'])).toEqual([
      'priority:yellow',
      'flag:blue',
      'symbol:heart',
    ]);
  });

  it('detects sticker markers', () => {
    expect(topicHasStickers(['priority:red'])).toBe(true);
    expect(topicHasStickers([])).toBe(false);
  });

  it('resolves sticker categories', () => {
    expect(stickerCategory('task:done')).toBe('task');
    expect(stickerCategory('unknown')).toBeNull();
  });

  it('computes sticker row width', () => {
    expect(stickerRowWidth(0)).toBe(0);
    expect(stickerRowWidth(1)).toBe(36);
    expect(stickerRowWidth(3)).toBe(68);
  });

  it('collects unique sticker ids used across a sheet', () => {
    const sheet = createSheet({ title: 'Legend' });
    const root = sheet.topicsById[sheet.rootTopicId]!;
    const child = createTopic({
      id: 'child-1',
      text: 'Child',
      parentId: sheet.rootTopicId,
      markers: ['flag:red', 'star:orange'],
    });
    sheet.topicsById[child.id] = child;
    root.childrenIds = [child.id];

    expect(collectSheetStickerIds(sheet)).toEqual(['flag:red', 'star:orange']);
  });

  it('resolves legend labels with overrides', () => {
    expect(resolveStickerLegendLabel('symbol:heart', undefined)).toBe('Heart');
    expect(resolveStickerLegendLabel('symbol:heart', { 'symbol:heart': 'Love' })).toBe('Love');
  });

  it('tints semantic sticker colors toward the active theme', () => {
    const palette = stickerColorPalette('classic');
    expect(palette.red).not.toBe('#E85757');
    expect(palette.red).not.toBe('#ef5350');
    expect(palette.green).not.toBe('#4CBF7A');
    expect(palette.green).not.toBe('#4caf50');
  });

  it('keeps semantic hues distinct across themes', () => {
    const intj = stickerColorPalette('intj');
    expect(intj.red).not.toBe(intj.blue);
    expect(intj.orange).not.toBe(intj.purple);
  });

  it('disallows stickers on the root topic', () => {
    const sheet = createSheet({ title: 'Test' });
    expect(topicAllowsStickers(sheet, sheet.rootTopicId)).toBe(false);
    const childId = Object.keys(sheet.topicsById).find((id) => id !== sheet.rootTopicId);
    expect(childId).toBeUndefined();
  });
});

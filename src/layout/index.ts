import type { Sheet, TopicId } from '@/core/model/types';
import { layoutMindmap } from './mindmap';
import { DEFAULT_MAP_THEME_ID } from './theme';
import type { LayoutResult } from './types';

export function layoutSheet(
  sheet: Sheet,
  editingTopicId?: TopicId,
  themeId: string = DEFAULT_MAP_THEME_ID,
): LayoutResult {
  switch (sheet.layout.type) {
    case 'mindmap':
      return layoutMindmap(sheet, editingTopicId, themeId);
    default:
      return layoutMindmap(sheet, editingTopicId, themeId);
  }
}

export * from './types';
export * from './measure';
export * from './mindmap';
export * from './edges';
export * from './theme';

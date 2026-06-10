import type { Sheet } from '@/core/model/types';
import { layoutMindmap } from './mindmap';
import type { LayoutResult } from './types';

export function layoutSheet(sheet: Sheet): LayoutResult {
  switch (sheet.layout.type) {
    case 'mindmap':
      return layoutMindmap(sheet);
    default:
      return layoutMindmap(sheet);
  }
}

export * from './types';
export * from './measure';
export * from './mindmap';
export * from './edges';
export * from './theme';

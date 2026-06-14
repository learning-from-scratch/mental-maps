import type { Sheet, SheetId } from './types';

export interface ProjectState {
  id: string;
  title: string;
  createdAt?: number;
  sheets: SheetId[];
  sheetsById: Record<SheetId, Sheet>;
  activeSheetId: SheetId;
}

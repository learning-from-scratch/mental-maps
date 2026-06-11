import { createDocument } from './factories';
import type { ProjectState } from './project';
import type { Sheet } from './types';
import { branchColorForIndex } from '@/layout/theme';

export function prepareProjectSheet(sheet: Sheet): Sheet {
  const initialSheet = structuredClone(sheet);
  const root = initialSheet.topicsById[initialSheet.rootTopicId];

  for (const [index, childId] of (root?.childrenIds ?? []).entries()) {
    const child = initialSheet.topicsById[childId];
    if (!child) continue;

    child.style = {
      ...child.style,
      branchColor: child.style?.branchColor ?? branchColorForIndex(index),
    };
    if (child.childrenIds.length) child.collapsed = true;
  }

  return initialSheet;
}

export function createEmptyProject(title = 'Untitled Map'): ProjectState {
  const doc = createDocument({ title });
  const sheet = doc.sheetsById[doc.sheets[0]!]!;

  return {
    id: 'local-pending',
    title,
    sheets: [sheet.id],
    sheetsById: { [sheet.id]: sheet },
    activeSheetId: sheet.id,
  };
}

export function projectFromSheet(
  id: string,
  title: string,
  sheet: Sheet,
  prepare = true,
): ProjectState {
  const preparedSheet = prepare ? prepareProjectSheet(sheet) : sheet;

  return {
    id,
    title,
    sheets: [preparedSheet.id],
    sheetsById: { [preparedSheet.id]: preparedSheet },
    activeSheetId: preparedSheet.id,
  };
}

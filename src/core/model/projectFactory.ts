import { createDocument } from './factories';
import { migrateLegacyTopicLink } from './link';
import type { ProjectState } from './project';
import type { Sheet, SheetId, Topic } from './types';
import {
  DEFAULT_MAP_THEME_ID,
  branchColorForIndex,
  resolveSheetThemeId,
} from '@/layout/theme';

type LegacyProjectState = ProjectState & {
  mapThemeId?: string;
  canvasDotsEnabled?: boolean;
};

export function normalizeTopic(topic: Topic): Topic {
  const normalized = { ...topic, labels: topic.labels ?? [], markers: topic.markers ?? [] };
  migrateLegacyTopicLink(normalized);
  return normalized;
}

/** Ensures legacy persisted sheets have required array fields before read or mutation. */
export function ensureSheetArrays(sheet: Sheet): void {
  sheet.relationships ??= [];
  sheet.boundaries ??= [];
  sheet.summaries ??= [];
  sheet.floatingTopicIds ??= [];
}

export function normalizeSheet(
  sheet: Sheet,
  projectThemeFallback?: string,
  projectDotsFallback?: boolean,
): Sheet {
  ensureSheetArrays(sheet);
  const topicsById = Object.fromEntries(
    Object.entries(sheet.topicsById).map(([id, topic]) => [id, normalizeTopic(topic)]),
  ) as Sheet['topicsById'];

  const root = topicsById[sheet.rootTopicId];
  if (root?.markers.length) {
    topicsById[sheet.rootTopicId] = { ...root, markers: [] };
  }

  return {
    ...sheet,
    topicsById,
    relationships: sheet.relationships ?? [],
    boundaries: sheet.boundaries ?? [],
    summaries: sheet.summaries ?? [],
    floatingTopicIds: sheet.floatingTopicIds ?? [],
    theme: resolveSheetThemeId(sheet.theme, projectThemeFallback ?? DEFAULT_MAP_THEME_ID),
    canvasDotsEnabled: sheet.canvasDotsEnabled ?? projectDotsFallback ?? true,
  };
}

export function normalizeProjectState(project: LegacyProjectState): ProjectState {
  const legacyTheme = project.mapThemeId;
  const legacyDots = project.canvasDotsEnabled;

  const sheetsById = Object.fromEntries(
    Object.entries(project.sheetsById).map(([id, sheet]) => [
      id,
      normalizeSheet(sheet, legacyTheme, legacyDots),
    ]),
  ) as Record<SheetId, Sheet>;

  const { mapThemeId: _mapThemeId, canvasDotsEnabled: _canvasDotsEnabled, ...rest } = project;
  return { ...rest, sheetsById };
}

export function prepareProjectSheet(sheet: Sheet): Sheet {
  const initialSheet = normalizeSheet(structuredClone(sheet));
  const root = initialSheet.topicsById[initialSheet.rootTopicId];
  const themeId = resolveSheetThemeId(initialSheet.theme);

  for (const [index, childId] of (root?.childrenIds ?? []).entries()) {
    const child = initialSheet.topicsById[childId];
    if (!child) continue;

    child.style = {
      ...child.style,
      branchColor: child.style?.branchColor ?? branchColorForIndex(index, themeId),
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
    createdAt: doc.createdAt,
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
  const preparedSheet = prepare ? prepareProjectSheet(sheet) : normalizeSheet(sheet);

  return {
    id,
    title,
    sheets: [preparedSheet.id],
    sheetsById: { [preparedSheet.id]: preparedSheet },
    activeSheetId: preparedSheet.id,
  };
}

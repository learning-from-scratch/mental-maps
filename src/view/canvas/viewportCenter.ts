import { normalizeSheet } from '@/core/model/projectFactory';
import type { ProjectState } from '@/core/model/project';
import type { Sheet, SheetId } from '@/core/model/types';
import { layoutSheet } from '@/layout';
import { resolveSheetThemeId } from '@/layout/theme';
import type { ViewportState } from '@/view/canvas/Viewport';

export function makeSheetViewportKey(projectId: string, sheetId: SheetId): string {
  return `${projectId}:${sheetId}`;
}

export function computeViewportCenteredOnRoot(
  sheet: Sheet,
  themeId?: string,
): ViewportState {
  const normalized = normalizeSheet(sheet);
  const resolvedThemeId = themeId ?? resolveSheetThemeId(normalized.theme);
  const layout = layoutSheet(normalized, undefined, resolvedThemeId);
  const node = layout.nodes.get(normalized.rootTopicId);

  const container = document.querySelector('.viewport');
  const width = container?.clientWidth ?? window.innerWidth;
  const height = container?.clientHeight ?? window.innerHeight;

  if (!node) {
    return {
      x: width / 2,
      y: height / 2,
      zoom: 1,
    };
  }

  const worldX = node.x + node.width / 2;
  const worldY = node.y + node.height / 2;
  const zoom = 1;

  return {
    zoom,
    x: width / 2 - zoom * worldX,
    y: height / 2 - zoom * worldY,
  };
}

export function centeredViewportsForProject(
  project: ProjectState,
): Record<string, ViewportState> {
  const viewports: Record<string, ViewportState> = {};

  for (const sheetId of project.sheets) {
    const sheet = project.sheetsById[sheetId];
    if (!sheet) continue;

    const key = makeSheetViewportKey(project.id, sheetId);
    const themeId = resolveSheetThemeId(sheet.theme);
    viewports[key] = computeViewportCenteredOnRoot(sheet, themeId);
  }

  return viewports;
}

export function centeredViewportForSheet(
  projectId: string,
  sheet: Sheet,
): Record<string, ViewportState> {
  const themeId = resolveSheetThemeId(sheet.theme);
  return {
    [makeSheetViewportKey(projectId, sheet.id)]: computeViewportCenteredOnRoot(sheet, themeId),
  };
}

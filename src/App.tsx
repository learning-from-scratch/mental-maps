import { produceWithPatches, type Patch } from 'immer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { addChild, addSibling, deleteTopics } from '@/core/commands/commands';
import { duplicateSheet } from '@/core/model/duplicateSheet';
import { createSheet } from '@/core/model/factories';
import type { ProjectState } from '@/core/model/project';
import {
   createEmptyProject,
   ensureSheetArrays,
   normalizeSheet,
   prepareProjectSheet,
   projectFromSheet,
} from '@/core/model/projectFactory';
import type { TopicLinkKind, TopicRefLink, UrlLink } from '@/core/model/link';
import { createDefaultStickerLegendState, toggleTopicSticker, topicAllowsStickers } from '@/core/model/stickers';
import {
   createTopicLinkRef,
   topicDisplayText,
} from '@/core/model/link';
import type { Sheet, SheetId, TopicId, MarkerId, Vec2, Relationship, Boundary } from '@/core/model/types';
import { boundariesFromSelection, boundaryMatchesSelection } from '@/core/model/boundaries';
import { createRelationship } from '@/core/model/relationships';
import { createSampleDocument } from '@/demo/sampleDocument';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import { useSheetUndo } from '@/hooks/useSheetUndo';
import {
   DEFAULT_MAP_THEME_ID,
   branchColorForIndex,
   getMapCanvasStyle,
   resolveSheetThemeId,
} from '@/layout/theme';
import { layoutSheet } from '@/layout';
import { confirmRelationshipGeometry } from '@/layout/relationshipGeometry';
import type { LayoutResult } from '@/layout/types';
import { clearMeasureCache } from '@/layout/measure';
import {
   isSheetNavHintDismissed,
   markAllSheetsNavHintDismissed,
   markSheetNavHintDismissed,
   wasLegacyNavHintGloballyDismissed,
} from '@/prefs/viewportNavHint';
import { createMap, deleteMap, listMaps, loadMap, saveMap } from '@/persistence/maps';
import { insertOutlineInDraft } from '@/core/outline/insertOutline';
import { parseOutline } from '@/core/outline/parseOutline';
import { MindMapCanvas } from '@/view/canvas/MindMapCanvas';
import { mergeSelection, toggleTopicInSelection } from '@/view/canvas/selection';
import type { RelationshipDraft } from '@/view/relationship/RelationshipLayer';
import { Viewport, type ViewportState } from '@/view/canvas/Viewport';
import { isExternalLinkConfirmSkipped } from '@/prefs/externalLinkConfirm';
import {
   InsertWebLinkModal,
} from '@/view/topic/InsertWebLinkModal';
import {
   InsertTopicLinkModal,
   type TopicLinkSelection,
} from '@/view/topic/InsertTopicLinkModal';
import { OpenExternalLinkModal } from '@/view/topic/OpenExternalLinkModal';
import { TopicLabelPanel } from '@/view/topic/TopicLabelPanel';
import { TopicEquationPanel } from '@/view/topic/TopicEquationPanel';
import { TopicNotesPanel } from '@/view/topic/TopicNotesPanel';
import { RightSidebars } from '@/view/sidebar/RightSidebars';
import { BottomPanel } from '@/view/status/BottomPanel';
import { RecentsModal } from '@/view/home/RecentsModal';
import { FloatingToolbar } from '@/view/toolbar/FloatingToolbar';

interface AppProps {
   mode?: 'local' | 'cloud';
   onSignOut?: () => void;
}

function chooseRootBranchSide(
   sheet: Sheet,
   preferredSide: 'left' | 'right' = 'right',
): 'left' | 'right' {
   const root = sheet.topicsById[sheet.rootTopicId];
   if (!root) return preferredSide;

   const branchWeight = (topicId: TopicId): number => {
      const topic = sheet.topicsById[topicId];
      if (!topic) return 0;
      if (topic.collapsed) return 1;
      return 1 + topic.childrenIds.reduce((sum, childId) => sum + branchWeight(childId), 0);
   };

   let leftWeight = 0;
   let rightWeight = 0;

   for (const childId of root.childrenIds) {
      const child = sheet.topicsById[childId];
      if (child?.side === 'left') leftWeight += branchWeight(childId);
      else rightWeight += branchWeight(childId);
   }

   if (leftWeight < rightWeight) return 'left';
   if (rightWeight < leftWeight) return 'right';
   return preferredSide;
}

function buildSheetCommandCtx(draft: Sheet) {
   return {
      doc: {
         formatVersion: 1 as const,
         id: 'keyboard-session',
         title: draft.title,
         createdAt: Date.now(),
         modifiedAt: Date.now(),
         sheets: [draft.id],
         sheetsById: { [draft.id]: draft },
      },
      sheetId: draft.id,
   };
}

function insertChildInDraft(draft: Sheet, parentId: TopicId, themeId: string): TopicId | null {
   const parent = draft.topicsById[parentId];
   if (!parent) return null;

   const root = draft.topicsById[draft.rootTopicId];
   const nextRootBranchColor = () =>
      branchColorForIndex(root?.childrenIds.length ?? 0, themeId);
   const applyRootBranchColor = (topicId: TopicId, color: string) => {
      const topic = draft.topicsById[topicId];
      if (!topic) return;
      topic.style = { ...topic.style, branchColor: color };
   };

   if (parent.collapsed) parent.collapsed = false;
   const side =
      parent.id === draft.rootTopicId
         ? chooseRootBranchSide(draft, parent.side ?? 'right')
         : (parent.side ?? 'right');
   const branchColor =
      parent.id === draft.rootTopicId ? nextRootBranchColor() : parent.style?.branchColor;

   const insertedTopicId = addChild(buildSheetCommandCtx(draft), {
      parentId,
      text: 'New Topic',
      side,
   });
   if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
   return insertedTopicId;
}

function insertSiblingInDraft(draft: Sheet, topicId: TopicId, themeId: string): TopicId | null {
   const selectedTopic = draft.topicsById[topicId];
   if (!selectedTopic) return null;

   const root = draft.topicsById[draft.rootTopicId];
   const nextRootBranchColor = () =>
      branchColorForIndex(root?.childrenIds.length ?? 0, themeId);
   const applyRootBranchColor = (id: TopicId, color: string) => {
      const topic = draft.topicsById[id];
      if (!topic) return;
      topic.style = { ...topic.style, branchColor: color };
   };

   const ctx = buildSheetCommandCtx(draft);

   if (selectedTopic.parentId) {
      const parent = draft.topicsById[selectedTopic.parentId];
      const side =
         parent?.id === draft.rootTopicId
            ? chooseRootBranchSide(draft, selectedTopic.side ?? 'right')
            : selectedTopic.side;
      const branchColor =
         parent?.id === draft.rootTopicId
            ? nextRootBranchColor()
            : selectedTopic.style?.branchColor;

      const insertedTopicId = addSibling(ctx, {
         topicId,
         text: 'New Topic',
      });
      const insertedTopic = draft.topicsById[insertedTopicId];
      if (insertedTopic) insertedTopic.side = side;
      if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
      return insertedTopicId;
   }

   const branchColor = nextRootBranchColor();
   const side = chooseRootBranchSide(draft, 'right');
   const insertedTopicId = addChild(ctx, {
      parentId: topicId,
      text: 'New Topic',
      side,
   });
   applyRootBranchColor(insertedTopicId, branchColor);
   return insertedTopicId;
}

function findInsertedTopicId(before: Sheet, after: Sheet): TopicId | null {
   for (const id of Object.keys(after.topicsById)) {
      if (!before.topicsById[id]) return id;
   }
   return null;
}

function createLocalSampleProject(): ProjectState {
   const initialDoc = createSampleDocument();
   const sheetId = initialDoc.sheets[0]!;
   const preparedSheet = prepareProjectSheet(initialDoc.sheetsById[sheetId]!);

   return {
      ...projectFromSheet('project-sit743', 'SIT743', preparedSheet, false),
      createdAt: initialDoc.createdAt,
   };
}

export function App({ mode = 'local', onSignOut }: AppProps) {
   const isCloud = mode === 'cloud';
   const localSampleProject = useMemo(() => createLocalSampleProject(), []);

   const [projects, setProjects] = useState<ProjectState[]>(() =>
      isCloud ? [] : [localSampleProject],
   );
   const {
      recordSheetChange,
      recordSheetChanges,
      recordSheetsByIdChange,
      canUndo,
      canRedo,
      applyUndo,
      applyRedo,
   } = useSheetUndo();
   const [activeProjectId, setActiveProjectId] = useState(
      isCloud ? '' : localSampleProject.id,
   );
   const [selectedTopicIds, setSelectedTopicIds] = useState<TopicId[]>([]);
   const primarySelectedTopicId = selectedTopicIds[selectedTopicIds.length - 1] ?? null;
   const [cloudLoading, setCloudLoading] = useState(isCloud);
   const [cloudError, setCloudError] = useState<string | null>(null);
   const urlNavigationHandled = useRef(false);
   const [notesPanelTopicId, setNotesPanelTopicId] = useState<TopicId | null>(null);
   const [labelPanelTopicId, setLabelPanelTopicId] = useState<TopicId | null>(null);
   const [webLinkModalTopicId, setWebLinkModalTopicId] = useState<TopicId | null>(null);
   const [webLinkModalKind, setWebLinkModalKind] = useState<TopicLinkKind>('webpage');
   const [topicLinkModalTopicId, setTopicLinkModalTopicId] = useState<TopicId | null>(null);
   const [equationPanelTopicId, setEquationPanelTopicId] = useState<TopicId | null>(null);
   const [equationSelectedTopicId, setEquationSelectedTopicId] = useState<TopicId | null>(null);
   const [externalLinkUrl, setExternalLinkUrl] = useState<string | null>(null);
   const [stickerPanelRequest, setStickerPanelRequest] = useState(0);
   const [editTopicId, setEditTopicId] = useState<TopicId | null>(null);
   const [editingTopicId, setEditingTopicId] = useState<TopicId | null>(null);
   const activeProjectIdRef = useRef(activeProjectId);
   activeProjectIdRef.current = activeProjectId;
   const notesCommitRef = useRef<(() => void) | null>(null);
   const labelCommitRef = useRef<(() => void) | null>(null);
   const equationCommitRef = useRef<(() => void) | null>(null);
   const [viewport, setViewport] = useState<ViewportState>(() => ({
      x: window.innerWidth / 2 - 64,
      y: window.innerHeight / 2,
      zoom: 1,
   }));
   const [pendingNavHintSheetIds, setPendingNavHintSheetIds] = useState<Set<SheetId>>(
      () => new Set(),
   );
   const [relationshipMode, setRelationshipMode] = useState<'pick-start' | 'pick-end' | null>(null);
   const [relationshipDraft, setRelationshipDraft] = useState<RelationshipDraft | null>(null);
   const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
   const [selectedBoundaryId, setSelectedBoundaryId] = useState<string | null>(null);
   const [showHome, setShowHome] = useState(false);

   const queueNavHintForSheet = useCallback((sheetId: SheetId) => {
      if (isSheetNavHintDismissed(sheetId)) return;
      setPendingNavHintSheetIds((current) => {
         if (current.has(sheetId)) return current;
         const next = new Set(current);
         next.add(sheetId);
         return next;
      });
   }, []);

   useEffect(() => {
      if (!isCloud) return;

      let cancelled = false;

      (async () => {
         setCloudLoading(true);
         setCloudError(null);

         try {
            const summaries = await listMaps();
            if (cancelled) return;

            if (summaries.length === 0) {
               const empty = createEmptyProject();
               const id = await createMap(empty);
               if (cancelled) return;

               const project = { ...empty, id, createdAt: Date.now() };
               setProjects([project]);
               setActiveProjectId(id);
               setSelectedTopicIds([]);
               queueNavHintForSheet(project.activeSheetId);
               return;
            }

            const loaded = await Promise.all(
               summaries.map(async (summary) => {
                  const project = await loadMap(summary.id);
                  return {
                     ...project,
                     createdAt: new Date(summary.createdAt).getTime(),
                  };
               }),
            );
            if (cancelled) return;

            const first = loaded[0]!;
            setProjects(loaded);
            setActiveProjectId(first.id);
            setSelectedTopicIds([]);
         } catch (error) {
            if (!cancelled) {
               setCloudError(error instanceof Error ? error.message : 'Failed to load maps');
            }
         } finally {
            if (!cancelled) setCloudLoading(false);
         }
      })();

      return () => {
         cancelled = true;
      };
   }, [isCloud, queueNavHintForSheet]);

   useEffect(() => {
      if (urlNavigationHandled.current || cloudLoading || projects.length === 0) return;

      const params = new URLSearchParams(window.location.search);
      const projectParam = params.get('project');
      const sheetParam = params.get('sheet');
      if (!projectParam && !sheetParam) return;

      urlNavigationHandled.current = true;

      const project =
         (projectParam ? projects.find((candidate) => candidate.id === projectParam) : null) ??
         projects[0];
      if (!project) return;

      if (project.id !== activeProjectId) {
         setActiveProjectId(project.id);
      }

      const sheetId =
         sheetParam && project.sheetsById[sheetParam] ? sheetParam : project.activeSheetId;
      const targetSheet = project.sheetsById[sheetId];
      if (!targetSheet) return;

      setProjects((current) =>
         current.map((entry) =>
            entry.id === project.id ? { ...entry, activeSheetId: sheetId } : entry,
         ),
      );
      setSelectedTopicIds([]);
   }, [cloudLoading, projects, activeProjectId]);

   const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
   const activeSheetId = activeProject?.activeSheetId;
   const showNavHint = Boolean(
      activeSheetId &&
         pendingNavHintSheetIds.has(activeSheetId) &&
         !isSheetNavHintDismissed(activeSheetId),
   );

   const dismissNavHint = useCallback(() => {
      if (!activeSheetId) return;

      markSheetNavHintDismissed(activeSheetId);
      setPendingNavHintSheetIds((current) => {
         if (!current.has(activeSheetId)) return current;
         const next = new Set(current);
         next.delete(activeSheetId);
         return next;
      });
   }, [activeSheetId]);

   const legacyNavHintMigrated = useRef(false);
   useEffect(() => {
      if (legacyNavHintMigrated.current || projects.length === 0) return;
      legacyNavHintMigrated.current = true;
      if (!wasLegacyNavHintGloballyDismissed()) return;
      markAllSheetsNavHintDismissed(projects.flatMap((project) => project.sheets));
   }, [projects]);

   const rawSheet = activeProject?.sheetsById[activeProject.activeSheetId];
   const sheet = useMemo(
      () => (rawSheet ? normalizeSheet(rawSheet) : undefined),
      [rawSheet],
   );
   const mapThemeId = sheet ? resolveSheetThemeId(sheet.theme) : DEFAULT_MAP_THEME_ID;
   const canvasDotsEnabled = sheet?.canvasDotsEnabled ?? true;

   const canvasStyle = useMemo(() => getMapCanvasStyle(mapThemeId), [mapThemeId]);

   const saveStatus = useDebouncedSave(
      activeProject,
      async (project) => {
         if (!project) return;
         await saveMap(project.id, project);
      },
      isCloud && !cloudLoading && Boolean(activeProject),
   );
   const topicCount = sheet ? Object.keys(sheet.topicsById).length : 0;

   const mapLayout = useMemo(
      () => (sheet ? layoutSheet(sheet) : null),
      [sheet, mapThemeId],
   );

   const topicPanelAnchor = useCallback(
      (topicId: TopicId | null) => {
         if (!topicId || !mapLayout) return null;
         const node = mapLayout.nodes.get(topicId);
         if (!node) return null;

         const worldX = node.x + node.width / 2;
         const worldY = node.y + node.height + 10;

         return {
            left: viewport.x + viewport.zoom * worldX,
            top: viewport.y + viewport.zoom * worldY,
            zoom: viewport.zoom,
         };
      },
      [mapLayout, viewport],
   );

   const notesScreenAnchor = useMemo(
      () => topicPanelAnchor(notesPanelTopicId),
      [notesPanelTopicId, topicPanelAnchor],
   );

   const labelScreenAnchor = useMemo(
      () => topicPanelAnchor(labelPanelTopicId),
      [labelPanelTopicId, topicPanelAnchor],
   );

   const equationScreenAnchor = useMemo(
      () => topicPanelAnchor(equationPanelTopicId),
      [equationPanelTopicId, topicPanelAnchor],
   );

   const notesTopic =
      notesPanelTopicId != null && sheet ? sheet.topicsById[notesPanelTopicId] : undefined;

   const labelTopic =
      labelPanelTopicId != null && sheet ? sheet.topicsById[labelPanelTopicId] : undefined;

   const equationTopic =
      equationPanelTopicId != null && sheet
         ? sheet.topicsById[equationPanelTopicId]
         : undefined;

   const updateActiveSheet = useCallback(
      (recipe: (sheet: Sheet) => void, options?: { recordUndo?: boolean }) => {
         setProjects((current) =>
            current.map((project) => {
               if (project.id !== activeProjectId) return project;

               const sheetId = project.activeSheetId;
               const activeSheet = project.sheetsById[sheetId];
               if (!activeSheet) return project;

               const [nextSheet, patches, inversePatches] = produceWithPatches(
                  activeSheet,
                  (draft) => {
                     ensureSheetArrays(draft);
                     recipe(draft);
                  },
               );

               if (options?.recordUndo !== false && patches.length > 0) {
                  recordSheetChange(project.id, sheetId, patches, inversePatches);
               }

               return {
                  ...project,
                  sheetsById: {
                     ...project.sheetsById,
                     [sheetId]: nextSheet,
                  },
               };
            }),
         );
      },
      [activeProjectId, recordSheetChange],
   );

   const selectMapTheme = (themeId: string) => {
      updateActiveSheet((draft) => {
         draft.theme = themeId;
      });
   };

   const handleCanvasDotsChange = (enabled: boolean) => {
      updateActiveSheet((draft) => {
         draft.canvasDotsEnabled = enabled;
      });
   };

   const setZoom = useCallback((zoom: number) => {
      const container = document.querySelector('.viewport');
      const width = container?.clientWidth ?? window.innerWidth;
      const height = container?.clientHeight ?? window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      setViewport((prev) => {
         const nextZoom = Math.min(2.5, Math.max(0.25, zoom));
         const scale = nextZoom / prev.zoom;
         return {
            zoom: nextZoom,
            x: centerX - scale * (centerX - prev.x),
            y: centerY - scale * (centerY - prev.y),
         };
      });
   }, []);

   const toggleCollapse = (topicId: TopicId) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.collapsed = !topic.collapsed;
      });
   };

   const updateTopicText = (topicId: TopicId, text: string) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.text = text;
      });
   };

   const updateTopicNotes = (topicId: TopicId, notes: string) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.notes = notes || undefined;
      });
   };

   const updateTopicLabels = (topicId: TopicId, labels: string[], labelsAutoSort: boolean) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (!topic) return;
         topic.labels = labels;
         topic.labelsAutoSort = labelsAutoSort;
      });
   };

   const updateTopicSticker = (topicId: TopicId, stickerId: MarkerId) => {
      updateActiveSheet((draft) => {
         if (!topicAllowsStickers(draft, topicId)) return;
         const topic = draft.topicsById[topicId];
         if (!topic) return;
         topic.markers = toggleTopicSticker(topic.markers ?? [], stickerId);
      });
   };

   const defaultStickerLegendPosition = useCallback(
      (layout: LayoutResult | null, activeSheet: Sheet): Vec2 => {
         if (!layout) return { x: 24, y: 24 };
         const root = layout.nodes.get(activeSheet.rootTopicId);
         if (root) {
            return {
               x: Math.max(16, root.x - 220),
               y: Math.max(16, root.y),
            };
         }
         return { x: layout.bounds.x + 24, y: layout.bounds.y + 24 };
      },
      [],
   );

   const toggleStickerLegend = useCallback(() => {
      updateActiveSheet((draft) => {
         const current =
            draft.stickerLegend ??
            createDefaultStickerLegendState(defaultStickerLegendPosition(mapLayout, draft));
         draft.stickerLegend = {
            ...current,
            visible: !current.visible,
            position: current.position ?? defaultStickerLegendPosition(mapLayout, draft),
         };
      });
   }, [defaultStickerLegendPosition, mapLayout, updateActiveSheet]);

   const updateStickerLegendPosition = useCallback(
      (position: Vec2) => {
         updateActiveSheet((draft) => {
            const current =
               draft.stickerLegend ??
               createDefaultStickerLegendState(defaultStickerLegendPosition(mapLayout, draft));
            draft.stickerLegend = { ...current, visible: true, position };
         });
      },
      [defaultStickerLegendPosition, mapLayout, updateActiveSheet],
   );

   const updateStickerLegendLabel = useCallback(
      (markerId: MarkerId, label: string) => {
         updateActiveSheet((draft) => {
            const current =
               draft.stickerLegend ??
               createDefaultStickerLegendState(defaultStickerLegendPosition(mapLayout, draft));
            draft.stickerLegend = {
               ...current,
               visible: current.visible,
               labelOverrides: {
                  ...current.labelOverrides,
                  [markerId]: label,
               },
            };
         });
      },
      [defaultStickerLegendPosition, mapLayout, updateActiveSheet],
   );

   const updateTopicWebLink = (topicId: TopicId, link: UrlLink | undefined) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (!topic) return;
         topic.webLink = link;
      });
   };

   const updateTopicCloudLink = (topicId: TopicId, link: UrlLink | undefined) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (!topic) return;
         topic.cloudLink = link;
      });
   };

   const updateTopicTopicLinksInProject = (
      updates: Array<{ sheetId: SheetId; topicId: TopicId; topicLink: TopicRefLink | undefined }>,
   ) => {
      setProjects((current) =>
         current.map((project) => {
            if (project.id !== activeProjectId) return project;

            const changes: Array<{
               sheetId: SheetId;
               patches: Patch[];
               inversePatches: Patch[];
            }> = [];
            const sheetsById = { ...project.sheetsById };

            for (const { sheetId, topicId, topicLink } of updates) {
               const targetSheet = sheetsById[sheetId];
               if (!targetSheet) continue;

               const [nextSheet, patches, inversePatches] = produceWithPatches(
                  targetSheet,
                  (draft) => {
                     const topic = draft.topicsById[topicId];
                     if (topic) topic.topicLink = topicLink;
                  },
               );
               sheetsById[sheetId] = nextSheet;
               if (patches.length > 0) {
                  changes.push({ sheetId, patches, inversePatches });
               }
            }

            if (changes.length > 0) {
               recordSheetChanges(project.id, { sheetChanges: changes });
            }

            return { ...project, sheetsById };
         }),
      );
   };

   const removeTopicNote = (topicId: TopicId) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.notes = undefined;
      });
   };

   const removeTopicWebLink = (topicId: TopicId) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.webLink = undefined;
      });
   };

   const removeTopicCloudLink = (topicId: TopicId) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.cloudLink = undefined;
      });
   };

   const removeTopicTopicLink = (topicId: TopicId) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.topicLink = undefined;
      });
   };

   const updateTopicEquation = (topicId: TopicId, latex: string, scale?: number) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (!topic) return;
         const trimmed = latex.trim();
         if (!trimmed) {
            topic.equation = undefined;
            return;
         }
         topic.equation = {
            latex: trimmed,
            scale: scale ?? topic.equation?.scale,
            placement: topic.equation?.placement,
         };
      });
   };

   const updateTopicEquationScale = (topicId: TopicId, scale: number) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (!topic?.equation) return;
         topic.equation = { ...topic.equation, scale };
      });
   };

   const updateTopicEquationPlacement = (
      topicId: TopicId,
      placement: 'top' | 'bottom' | 'left' | 'right',
   ) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (!topic?.equation) return;
         topic.equation = { ...topic.equation, placement };
      });
   };

   const moveTopicEquation = (
      fromTopicId: TopicId,
      toTopicId: TopicId,
      placement: 'top' | 'bottom' | 'left' | 'right',
   ) => {
      clearMeasureCache();
      updateActiveSheet((draft) => {
         const fromTopic = draft.topicsById[fromTopicId];
         const toTopic = draft.topicsById[toTopicId];
         if (!fromTopic?.equation || !toTopic || fromTopicId === toTopicId) return;

         toTopic.equation = { ...fromTopic.equation, placement };
         fromTopic.equation = undefined;
      });
      setEquationSelectedTopicId(toTopicId);
      setSelectedTopicIds([toTopicId]);
   };

   const removeTopicEquation = (topicId: TopicId) => {
      updateActiveSheet((draft) => {
         const topic = draft.topicsById[topicId];
         if (topic) topic.equation = undefined;
      });
      if (equationSelectedTopicId === topicId) {
         setEquationSelectedTopicId(null);
      }
   };

   const dismissNotesPanel = useCallback(() => {
      notesCommitRef.current?.();
      setNotesPanelTopicId(null);
   }, []);

   const dismissLabelPanel = useCallback(() => {
      labelCommitRef.current?.();
      setLabelPanelTopicId(null);
   }, []);

   const dismissEquationPanel = useCallback(() => {
      equationCommitRef.current?.();
      setEquationPanelTopicId(null);
   }, []);

   const dismissTopicPanels = useCallback(() => {
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
   }, [dismissNotesPanel, dismissLabelPanel, dismissEquationPanel]);

   const applyTopicPanelDismissals = useCallback(
      (topicId: TopicId) => {
         if (notesPanelTopicId && notesPanelTopicId !== topicId) {
            dismissNotesPanel();
         }
         if (labelPanelTopicId && labelPanelTopicId !== topicId) {
            dismissLabelPanel();
         }
         if (equationPanelTopicId && equationPanelTopicId !== topicId) {
            dismissEquationPanel();
         }
         if (webLinkModalTopicId && webLinkModalTopicId !== topicId) {
            setWebLinkModalTopicId(null);
         }
         if (topicLinkModalTopicId && topicLinkModalTopicId !== topicId) {
            setTopicLinkModalTopicId(null);
         }
      },
      [
         notesPanelTopicId,
         labelPanelTopicId,
         equationPanelTopicId,
         webLinkModalTopicId,
         topicLinkModalTopicId,
         dismissNotesPanel,
         dismissLabelPanel,
         dismissEquationPanel,
      ],
   );

   const handleSelectTopic = useCallback(
      (topicId: TopicId, options?: { additive?: boolean }) => {
         applyTopicPanelDismissals(topicId);
         setEquationSelectedTopicId(null);
         setSelectedBoundaryId(null);
         setEditingTopicId(null);
         setSelectedTopicIds((current) =>
            options?.additive ? toggleTopicInSelection(current, topicId) : [topicId],
         );
      },
      [applyTopicPanelDismissals],
   );

   const handleSelectTopics = useCallback(
      (topicIds: TopicId[], options?: { additive?: boolean }) => {
         setEquationSelectedTopicId(null);
         setSelectedBoundaryId(null);
         if (topicIds.length === 0) {
            setSelectedTopicIds([]);
            return;
         }
         dismissTopicPanels();
         setSelectedTopicIds((current) =>
            options?.additive ? mergeSelection(current, topicIds) : topicIds,
         );
      },
      [dismissTopicPanels],
   );

   const clearTopicSelection = useCallback(() => {
      setSelectedTopicIds([]);
      setEditingTopicId(null);
   }, []);

   const insertTopicAndActivate = useCallback(
      (
         recipe: (draft: Sheet, topicId: TopicId) => TopicId | null,
         sourceTopicId: TopicId,
         options?: { commitText?: string },
      ) => {
         let insertedTopicId: TopicId | null = null;

         flushSync(() => {
            dismissTopicPanels();
            setEquationSelectedTopicId(null);
            setProjects((current) =>
               current.map((project) => {
                  if (project.id !== activeProjectIdRef.current) return project;

                  const activeSheet = project.sheetsById[project.activeSheetId];
                  if (!activeSheet) return project;

                  const [nextSheet, patches, inversePatches] = produceWithPatches(
                     activeSheet,
                     (draft) => {
                        if (options?.commitText !== undefined) {
                           const sourceTopic = draft.topicsById[sourceTopicId];
                           if (sourceTopic) sourceTopic.text = options.commitText;
                        }
                        ensureSheetArrays(draft);
                        insertedTopicId = recipe(draft, sourceTopicId);
                     },
                  );

                  if (!insertedTopicId) {
                     insertedTopicId = findInsertedTopicId(activeSheet, nextSheet);
                  }

                  if (patches.length > 0) {
                     recordSheetChange(
                        project.id,
                        project.activeSheetId,
                        patches,
                        inversePatches,
                     );
                  }

                  return {
                     ...project,
                     sheetsById: {
                        ...project.sheetsById,
                        [project.activeSheetId]: nextSheet,
                     },
                  };
               }),
            );
         });

         if (insertedTopicId) {
            setSelectedRelationshipId(null);
            setSelectedBoundaryId(null);
            setEditingTopicId(null);
            setSelectedTopicIds([insertedTopicId]);
            setEditTopicId(insertedTopicId);
         }

         return insertedTopicId;
      },
      [dismissTopicPanels, recordSheetChange],
   );

   const insertChildTopic = useCallback(
      (topicId: TopicId, commitText?: string) => {
         insertTopicAndActivate(
            (draft, parentId) => insertChildInDraft(draft, parentId, mapThemeId),
            topicId,
            commitText !== undefined ? { commitText } : undefined,
         );
      },
      [mapThemeId, insertTopicAndActivate],
   );

   const insertSiblingTopic = useCallback(
      (topicId: TopicId, commitText?: string) => {
         insertTopicAndActivate(
            (draft, siblingId) => insertSiblingInDraft(draft, siblingId, mapThemeId),
            topicId,
            commitText !== undefined ? { commitText } : undefined,
         );
      },
      [mapThemeId, insertTopicAndActivate],
   );

   const pasteOutlineOntoTopic = useCallback(
      (anchorTopicId: TopicId, clipboardText: string) => {
         const outline = parseOutline(clipboardText);
         if (!outline || outline.length === 0) return false;

         let firstInsertedId: TopicId | null = null;

         flushSync(() => {
            dismissTopicPanels();
            setEquationSelectedTopicId(null);
            setProjects((current) =>
               current.map((project) => {
                  if (project.id !== activeProjectIdRef.current) return project;

                  const activeSheet = project.sheetsById[project.activeSheetId];
                  if (!activeSheet) return project;

                  const [nextSheet, patches, inversePatches] = produceWithPatches(
                     activeSheet,
                     (draft) => {
                        ensureSheetArrays(draft);
                        firstInsertedId = insertOutlineInDraft(
                           draft,
                           anchorTopicId,
                           outline,
                           mapThemeId,
                        );
                     },
                  );

                  if (patches.length > 0) {
                     recordSheetChange(
                        project.id,
                        project.activeSheetId,
                        patches,
                        inversePatches,
                     );
                  }

                  return {
                     ...project,
                     sheetsById: {
                        ...project.sheetsById,
                        [project.activeSheetId]: nextSheet,
                     },
                  };
               }),
            );
         });

         if (firstInsertedId) {
            setSelectedRelationshipId(null);
            setSelectedBoundaryId(null);
            setEditingTopicId(null);
            setEditTopicId(null);
            setSelectedTopicIds([firstInsertedId]);
         }

         return Boolean(firstInsertedId);
      },
      [dismissTopicPanels, mapThemeId, recordSheetChange],
   );

   const cancelRelationshipMode = useCallback(() => {
      setRelationshipMode(null);
      setRelationshipDraft(null);
   }, []);

   const handleUndo = useCallback(() => {
      dismissTopicPanels();
      let nextActiveSheet: Sheet | undefined;

      setProjects((current) =>
         current.map((project) => {
            if (project.id !== activeProjectId) return project;

            const nextSheetsById = applyUndo(project.id, project.sheetsById);
            if (!nextSheetsById) return project;

            nextActiveSheet = nextSheetsById[project.activeSheetId];
            return { ...project, sheetsById: nextSheetsById };
         }),
      );

      if (nextActiveSheet) {
         setSelectedTopicIds((current) =>
            current.filter((id) => Boolean(nextActiveSheet!.topicsById[id])),
         );
         setSelectedRelationshipId(null);
         setSelectedBoundaryId(null);
         cancelRelationshipMode();
      }
   }, [
      activeProjectId,
      applyUndo,
      cancelRelationshipMode,
      dismissTopicPanels,
   ]);

   const handleRedo = useCallback(() => {
      dismissTopicPanels();
      let nextActiveSheet: Sheet | undefined;

      setProjects((current) =>
         current.map((project) => {
            if (project.id !== activeProjectId) return project;

            const nextSheetsById = applyRedo(project.id, project.sheetsById);
            if (!nextSheetsById) return project;

            nextActiveSheet = nextSheetsById[project.activeSheetId];
            return { ...project, sheetsById: nextSheetsById };
         }),
      );

      if (nextActiveSheet) {
         setSelectedTopicIds((current) =>
            current.filter((id) => Boolean(nextActiveSheet!.topicsById[id])),
         );
         setSelectedRelationshipId(null);
         setSelectedBoundaryId(null);
         cancelRelationshipMode();
      }
   }, [
      activeProjectId,
      applyRedo,
      cancelRelationshipMode,
      dismissTopicPanels,
   ]);

   const createBlankProject = useCallback(async () => {
      const empty = createEmptyProject();

      if (isCloud) {
         try {
            const id = await createMap(empty);
            const project = { ...empty, id, createdAt: Date.now() };
            setProjects((current) => [...current, project]);
            setActiveProjectId(id);
            setSelectedTopicIds([]);
            setShowHome(false);
            queueNavHintForSheet(project.activeSheetId);
         } catch (error) {
            setCloudError(error instanceof Error ? error.message : 'Failed to create project');
         }
         return;
      }

      const projectId = `local-${Date.now()}`;
      const project = { ...empty, id: projectId, createdAt: Date.now() };
      setProjects((current) => [...current, project]);
      setActiveProjectId(projectId);
      setSelectedTopicIds([]);
      setShowHome(false);
      queueNavHintForSheet(project.activeSheetId);
   }, [isCloud, queueNavHintForSheet]);

   const addBlankSheet = useCallback(() => {
      if (!activeProjectId) return;

      let newRootTopicId: TopicId | null = null;
      let newSheetId: SheetId | null = null;

      setProjects((current) =>
         current.map((project) => {
            if (project.id !== activeProjectId) return project;

            const nextIndex = project.sheets.length + 1;
            const newSheet = createSheet({ title: `Map ${nextIndex}` });
            newRootTopicId = newSheet.rootTopicId;
            newSheetId = newSheet.id;

            return {
               ...project,
               sheets: [...project.sheets, newSheet.id],
               sheetsById: { ...project.sheetsById, [newSheet.id]: newSheet },
               activeSheetId: newSheet.id,
            };
         }),
      );

      if (newRootTopicId) setSelectedTopicIds([newRootTopicId]);
      if (newSheetId) queueNavHintForSheet(newSheetId);
   }, [activeProjectId, queueNavHintForSheet]);

   const openHome = useCallback(() => {
      dismissTopicPanels();
      setShowHome(true);
   }, [dismissTopicPanels]);

   const selectProject = useCallback(
      (projectId: string) => {
         setActiveProjectId(projectId);
         setSelectedTopicIds([]);
         setShowHome(false);
         dismissTopicPanels();
      },
      [dismissTopicPanels],
   );

   const startRelationshipMode = useCallback(() => {
      dismissTopicPanels();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedRelationshipId(null);

      if (primarySelectedTopicId) {
         setRelationshipMode('pick-end');
         setRelationshipDraft({ fromId: primarySelectedTopicId, cursor: { x: 0, y: 0 } });
         return;
      }

      setRelationshipMode('pick-start');
      setRelationshipDraft(null);
   }, [primarySelectedTopicId, dismissTopicPanels]);

   const handleRelationshipTopicClick = useCallback(
      (topicId: TopicId) => {
         if (relationshipMode === 'pick-start') {
            setRelationshipMode('pick-end');
            setRelationshipDraft({ fromId: topicId, cursor: { x: 0, y: 0 } });
            setSelectedTopicIds([topicId]);
            return;
         }

         if (relationshipMode === 'pick-end' && relationshipDraft) {
            if (topicId === relationshipDraft.fromId) return;

            const fromNode = mapLayout?.nodes.get(relationshipDraft.fromId);
            const toNode = mapLayout?.nodes.get(topicId);
            const relationship = {
               ...createRelationship(relationshipDraft.fromId, topicId),
               ...(fromNode && toNode
                  ? confirmRelationshipGeometry(
                       fromNode,
                       toNode,
                       relationshipDraft.cursor,
                    )
                  : {}),
            };
            updateActiveSheet((draft) => {
               draft.relationships.push(relationship);
            });
            setSelectedRelationshipId(relationship.id);
            setRelationshipMode(null);
            setRelationshipDraft(null);
            setSelectedTopicIds([topicId]);
         }
      },
      [relationshipMode, relationshipDraft, mapLayout, updateActiveSheet],
   );

   const handleRelationshipCursorMove = useCallback((point: Vec2) => {
      setRelationshipDraft((current) => (current ? { ...current, cursor: point } : current));
   }, []);

   const updateRelationship = useCallback(
      (relationshipId: string, patch: Partial<Relationship>) => {
         updateActiveSheet((draft) => {
            const relationship = draft.relationships.find((item) => item.id === relationshipId);
            if (!relationship) return;
            Object.assign(relationship, patch);
         });
      },
      [updateActiveSheet],
   );

   const deleteSelectedRelationship = useCallback(() => {
      if (!selectedRelationshipId) return;
      const relationshipId = selectedRelationshipId;
      updateActiveSheet((draft) => {
         draft.relationships = draft.relationships.filter((item) => item.id !== relationshipId);
      });
      setSelectedRelationshipId(null);
   }, [selectedRelationshipId, updateActiveSheet]);

   const updateBoundary = useCallback(
      (boundaryId: string, patch: Partial<Boundary>) => {
         updateActiveSheet((draft) => {
            const boundary = draft.boundaries.find((item) => item.id === boundaryId);
            if (!boundary) return;
            Object.assign(boundary, patch);
         });
      },
      [updateActiveSheet],
   );

   const deleteSelectedBoundary = useCallback(() => {
      if (!selectedBoundaryId) return;
      const boundaryId = selectedBoundaryId;
      updateActiveSheet((draft) => {
         draft.boundaries = draft.boundaries.filter((item) => item.id !== boundaryId);
      });
      setSelectedBoundaryId(null);
   }, [selectedBoundaryId, updateActiveSheet]);

   const addBoundaryFromSelection = useCallback(() => {
      if (!sheet || selectedTopicIds.length === 0) return;

      const candidates = boundariesFromSelection(sheet, selectedTopicIds);
      if (candidates.length === 0) return;

      const createdIds: string[] = [];

      updateActiveSheet((draft) => {
         for (const candidate of candidates) {
            const existing = draft.boundaries.find((boundary) =>
               boundaryMatchesSelection(boundary, candidate),
            );
            if (existing) {
               createdIds.push(existing.id);
               continue;
            }

            const id = `boundary-${crypto.randomUUID()}`;
            draft.boundaries.push({ ...candidate, id });
            createdIds.push(id);
         }
      });

      if (createdIds.length > 0) {
         setSelectedBoundaryId(createdIds[createdIds.length - 1]!);
         setSelectedTopicIds([]);
         dismissTopicPanels();
      }
   }, [sheet, selectedTopicIds, updateActiveSheet, dismissTopicPanels]);

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (!(event.ctrlKey || event.metaKey)) return;

         const target = event.target;
         if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            (target instanceof HTMLElement && target.isContentEditable)
         ) {
            return;
         }

         const key = event.key.toLowerCase();
         if (key === 'z' && !event.shiftKey) {
            if (!canUndo(activeProjectId)) return;
            event.preventDefault();
            handleUndo();
            return;
         }

         if (key === 'y') {
            if (!canRedo(activeProjectId)) return;
            event.preventDefault();
            handleRedo();
            return;
         }

         if (key === 'n') {
            event.preventDefault();
            if (showHome) {
               void createBlankProject();
            } else {
               addBlankSheet();
            }
            return;
         }

         if (key === 'h') {
            event.preventDefault();
            openHome();
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [
      activeProjectId,
      canUndo,
      canRedo,
      handleUndo,
      handleRedo,
      showHome,
      createBlankProject,
      addBlankSheet,
      openHome,
   ]);

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape' && relationshipMode) {
            event.preventDefault();
            cancelRelationshipMode();
            return;
         }

         if (event.key === 'Delete' && selectedRelationshipId) {
            const target = event.target;
            if (
               target instanceof HTMLInputElement ||
               target instanceof HTMLTextAreaElement ||
               target instanceof HTMLSelectElement ||
               (target instanceof HTMLElement && target.isContentEditable)
            ) {
               return;
            }

            event.preventDefault();
            deleteSelectedRelationship();
            return;
         }

         if (event.key === 'Delete' && selectedBoundaryId) {
            const target = event.target;
            if (
               target instanceof HTMLInputElement ||
               target instanceof HTMLTextAreaElement ||
               target instanceof HTMLSelectElement ||
               (target instanceof HTMLElement && target.isContentEditable)
            ) {
               return;
            }

            event.preventDefault();
            deleteSelectedBoundary();
            return;
         }

         if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === 'b'
         ) {
            event.preventDefault();
            addBoundaryFromSelection();
            return;
         }

         if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === 'r'
         ) {
            event.preventDefault();
            if (relationshipMode) {
               cancelRelationshipMode();
            } else {
               startRelationshipMode();
            }
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [
      relationshipMode,
      selectedRelationshipId,
      selectedBoundaryId,
      cancelRelationshipMode,
      startRelationshipMode,
      deleteSelectedRelationship,
      deleteSelectedBoundary,
      addBoundaryFromSelection,
   ]);

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (
            !sheet ||
            selectedTopicIds.length === 0 ||
            editingTopicId ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
         ) {
            return;
         }

         const target = event.target;
         if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            (target instanceof HTMLElement && target.isContentEditable)
         ) {
            return;
         }

         if (event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Delete') return;

         if (event.key === 'Delete') {
            event.preventDefault();
            const toDelete = selectedTopicIds.filter((id) => id !== sheet.rootTopicId);
            if (toDelete.length === 0) {
               setSelectedTopicIds([sheet.rootTopicId]);
               return;
            }

            setProjects((current) =>
               current.map((project) => {
                  if (project.id !== activeProjectIdRef.current) return project;

                  const activeSheetId = project.activeSheetId;
                  const activeSheet = project.sheetsById[activeSheetId];
                  if (!activeSheet) return project;

                  const [nextSheetsById, patches, inversePatches] = produceWithPatches(
                     project.sheetsById,
                     (draftSheets) => {
                        const draft = draftSheets[activeSheetId];
                        if (!draft) return;

                        const doc = {
                           formatVersion: 1 as const,
                           id: project.id,
                           title: project.title,
                           createdAt: Date.now(),
                           modifiedAt: Date.now(),
                           sheets: project.sheets,
                           sheetsById: draftSheets,
                        };
                        deleteTopics({ doc, sheetId: draft.id }, { topicIds: toDelete });
                     },
                  );

                  if (patches.length > 0) {
                     recordSheetsByIdChange(project.id, patches, inversePatches);
                  }

                  return { ...project, sheetsById: nextSheetsById };
               }),
            );

            setSelectedTopicIds([]);
            return;
         }

         if (
            event.shiftKey ||
            !primarySelectedTopicId
         ) {
            return;
         }

         event.preventDefault();

         if (event.key === 'Tab') {
            insertChildTopic(primarySelectedTopicId);
            return;
         }

         if (event.key === 'Enter') {
            insertSiblingTopic(primarySelectedTopicId);
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [
      selectedTopicIds,
      primarySelectedTopicId,
      sheet,
      editingTopicId,
      insertChildTopic,
      insertSiblingTopic,
      updateActiveSheet,
      recordSheetChange,
      recordSheetsByIdChange,
   ]);

   useEffect(() => {
      const handlePaste = (event: ClipboardEvent) => {
         if (!sheet || !primarySelectedTopicId || editingTopicId) return;

         const target = event.target;
         if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            (target instanceof HTMLElement && target.isContentEditable)
         ) {
            return;
         }

         const clipboardText = event.clipboardData?.getData('text/plain');
         if (!clipboardText?.trim()) return;

         if (pasteOutlineOntoTopic(primarySelectedTopicId, clipboardText)) {
            event.preventDefault();
         }
      };

      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
   }, [sheet, primarySelectedTopicId, editingTopicId, pasteOutlineOntoTopic]);

   const openNotesPanel = () => {
      if (!primarySelectedTopicId) return;
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setNotesPanelTopicId(primarySelectedTopicId);
   };

   const openLabelPanel = () => {
      if (!primarySelectedTopicId) return;
      dismissNotesPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([primarySelectedTopicId]);
      setLabelPanelTopicId(primarySelectedTopicId);
   };

   const openStickerPanel = () => {
      if (!primarySelectedTopicId) return;
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([primarySelectedTopicId]);
      setStickerPanelRequest((count) => count + 1);
   };

   const openEquationPanel = (topicId?: TopicId) => {
      const targetId = topicId ?? primarySelectedTopicId;
      if (!targetId) return;
      dismissNotesPanel();
      dismissLabelPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([targetId]);
      setEquationPanelTopicId(targetId);
   };

   const openWebLinkModal = (topicId?: TopicId, kind: TopicLinkKind = 'webpage') => {
      const targetId = topicId ?? primarySelectedTopicId;
      if (!targetId) return;
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([targetId]);
      setWebLinkModalKind(kind === 'topic' ? 'webpage' : kind);
      setWebLinkModalTopicId(targetId);
   };

   const openTopicLinkModal = (topicId?: TopicId) => {
      const targetId = topicId ?? primarySelectedTopicId;
      if (!targetId || !sheet) return;
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([targetId]);
      setTopicLinkModalTopicId(targetId);
   };

   const handleTopicLinkInsert = (selection: TopicLinkSelection, bidirectional: boolean) => {
      if (!topicLinkModalTopicId || !sheet || !activeProject) return;

      const sourceTopic = sheet.topicsById[topicLinkModalTopicId];
      const targetSheet = activeProject.sheetsById[selection.sheetId];
      const targetTopic = targetSheet?.topicsById[selection.topicId];
      if (!sourceTopic || !targetTopic) return;

      const targetTitle = topicDisplayText(targetTopic.text);
      const sourceTitle = topicDisplayText(sourceTopic.text);
      const updates: Array<{
         sheetId: SheetId;
         topicId: TopicId;
         topicLink: TopicRefLink | undefined;
      }> = [
         {
            sheetId: activeProject.activeSheetId,
            topicId: topicLinkModalTopicId,
            topicLink: createTopicLinkRef(selection.sheetId, selection.topicId, targetTitle),
         },
      ];

      if (bidirectional) {
         updates.push({
            sheetId: selection.sheetId,
            topicId: selection.topicId,
            topicLink: createTopicLinkRef(
               activeProject.activeSheetId,
               topicLinkModalTopicId,
               sourceTitle,
            ),
         });
      }

      updateTopicTopicLinksInProject(updates);
      setTopicLinkModalTopicId(null);
   };

   const resolveTopicLinkLabel = useCallback(
      (topicId: TopicId): string | undefined => {
         if (!sheet || !activeProject) return undefined;
         const topicLink = sheet.topicsById[topicId]?.topicLink;
         if (!topicLink?.targetSheetId || !topicLink.targetTopicId) {
            return undefined;
         }
         const targetSheet = activeProject.sheetsById[topicLink.targetSheetId];
         const targetTopic = targetSheet?.topicsById[topicLink.targetTopicId];
         if (!targetTopic) return 'Missing topic';
         const sheetTitle = targetSheet?.title ?? 'Map';
         return `${topicDisplayText(targetTopic.text)} (${sheetTitle})`;
      },
      [sheet, activeProject],
   );

   const focusTopicInViewport = useCallback(
      (topicId: TopicId, targetSheet: Sheet) => {
         const layout = layoutSheet(targetSheet);
         const node = layout.nodes.get(topicId);
         if (!node) return;

         const container = document.querySelector('.viewport');
         const width = container?.clientWidth ?? window.innerWidth;
         const height = container?.clientHeight ?? window.innerHeight;
         const worldX = node.x + node.width / 2;
         const worldY = node.y + node.height / 2;

         setViewport((prev) => ({
            zoom: prev.zoom,
            x: width / 2 - prev.zoom * worldX,
            y: height / 2 - prev.zoom * worldY,
         }));
      },
      [],
   );

   const followTopicLink = useCallback(
      (fromTopicId: TopicId) => {
         if (!sheet || !activeProject) return;
         const topicLink = sheet.topicsById[fromTopicId]?.topicLink;
         if (!topicLink?.targetSheetId || !topicLink.targetTopicId) {
            return;
         }

         dismissTopicPanels();

         const targetSheetId = topicLink.targetSheetId;
         const targetTopicId = topicLink.targetTopicId;
         const targetSheet = activeProject.sheetsById[targetSheetId];
         if (!targetSheet) return;

         const [nextSheet, patches, inversePatches] = produceWithPatches(
            targetSheet,
            (draft) => {
               let current = draft.topicsById[targetTopicId];
               while (current?.parentId) {
                  const parent = draft.topicsById[current.parentId];
                  if (parent) parent.collapsed = false;
                  current = parent;
               }
            },
         );

         setProjects((current) =>
            current.map((project) => {
               if (project.id !== activeProjectId) return project;
               if (patches.length > 0) {
                  recordSheetChange(project.id, targetSheetId, patches, inversePatches);
               }
               return {
                  ...project,
                  activeSheetId: targetSheetId,
                  sheetsById: {
                     ...project.sheetsById,
                     [targetSheetId]: nextSheet,
                  },
               };
            }),
         );
         setSelectedTopicIds([targetTopicId]);

         window.setTimeout(() => {
            focusTopicInViewport(targetTopicId, nextSheet);
         }, 0);
      },
      [
         sheet,
         activeProject,
         activeProjectId,
         dismissTopicPanels,
         focusTopicInViewport,
         recordSheetChange,
      ],
   );

   const handleWebLinkInsert = (link: { url: string }) => {
      if (!webLinkModalTopicId) return;
      const urlLink = { url: link.url };
      if (webLinkModalKind === 'cloud') {
         updateTopicCloudLink(webLinkModalTopicId, urlLink);
      } else {
         updateTopicWebLink(webLinkModalTopicId, urlLink);
      }
      setWebLinkModalTopicId(null);
   };

   const openExternalLink = useCallback((url: string) => {
      if (isExternalLinkConfirmSkipped()) {
         window.open(url, '_blank', 'noopener,noreferrer');
         return;
      }
      setExternalLinkUrl(url);
   }, []);

   const openNotesPanelFor = (topicId: TopicId) => {
      if (notesPanelTopicId && notesPanelTopicId !== topicId) {
         dismissNotesPanel();
      }
      if (labelPanelTopicId) dismissLabelPanel();
      if (equationPanelTopicId) dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([topicId]);
      setNotesPanelTopicId(topicId);
   };

   const openLabelsPanelFor = (topicId: TopicId) => {
      if (labelPanelTopicId && labelPanelTopicId !== topicId) {
         dismissLabelPanel();
      }
      if (notesPanelTopicId) dismissNotesPanel();
      if (equationPanelTopicId) dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([topicId]);
      setLabelPanelTopicId(topicId);
   };

   const openEquationPanelFor = (topicId: TopicId) => {
      if (equationPanelTopicId && equationPanelTopicId !== topicId) {
         dismissEquationPanel();
      }
      if (notesPanelTopicId) dismissNotesPanel();
      if (labelPanelTopicId) dismissLabelPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicIds([topicId]);
      setEquationPanelTopicId(topicId);
   };

   const webLinkTopic =
      webLinkModalTopicId != null && sheet
         ? sheet.topicsById[webLinkModalTopicId]
         : undefined;

   const topicLinkTopic =
      topicLinkModalTopicId != null && sheet
         ? sheet.topicsById[topicLinkModalTopicId]
         : undefined;

   const topicLinkInitialSelection = useMemo((): TopicLinkSelection | undefined => {
      const topicLink = topicLinkTopic?.topicLink;
      if (!topicLink?.targetSheetId || !topicLink.targetTopicId) {
         return undefined;
      }
      return {
         sheetId: topicLink.targetSheetId,
         topicId: topicLink.targetTopicId,
      };
   }, [topicLinkTopic]);

   const selectSheet = (sheetId: SheetId) => {
      setProjects((current) =>
         current.map((project) =>
            project.id === activeProjectId ? { ...project, activeSheetId: sheetId } : project,
         ),
      );
      setSelectedTopicIds([]);
   };

   const duplicateSheetInProject = (sheetId: SheetId) => {
      const source = activeProject?.sheetsById[sheetId];
      if (!source) return;

      const copy = duplicateSheet(source);

      setProjects((current) =>
         current.map((project) =>
            project.id === activeProjectId
               ? {
                    ...project,
                    sheets: [...project.sheets, copy.id],
                    sheetsById: { ...project.sheetsById, [copy.id]: copy },
                    activeSheetId: copy.id,
                 }
               : project,
         ),
      );
      setSelectedTopicIds([]);
      queueNavHintForSheet(copy.id);
   };

   const deleteSheet = (sheetId: SheetId) => {
      const project = projects.find((entry) => entry.id === activeProjectId);
      if (!project || project.sheets.length <= 1) return;

      const sheetIndex = project.sheets.indexOf(sheetId);
      if (sheetIndex === -1) return;

      const nextSheets = project.sheets.filter((id) => id !== sheetId);
      const wasActive = project.activeSheetId === sheetId;
      const nextActiveId = wasActive
         ? nextSheets[Math.min(sheetIndex, nextSheets.length - 1)]!
         : project.activeSheetId;

      setProjects((current) =>
         current.map((entry) => {
            if (entry.id !== activeProjectId) return entry;

            const { [sheetId]: _removed, ...nextSheetsById } = entry.sheetsById;
            return {
               ...entry,
               sheets: nextSheets,
               sheetsById: nextSheetsById,
               activeSheetId: nextActiveId,
            };
         }),
      );

      if (wasActive) {
         setSelectedTopicIds([]);
      }
   };

   const renameSheet = (sheetId: SheetId, title: string) => {
      setProjects((current) =>
         current.map((project) => {
            if (project.id !== activeProjectId) return project;

            const sheet = project.sheetsById[sheetId];
            if (!sheet) return project;

            return {
               ...project,
               sheetsById: {
                  ...project.sheetsById,
                  [sheetId]: { ...sheet, title },
               },
            };
         }),
      );
   };

   const addSheet = addBlankSheet;

   const renameProject = useCallback(
      (title: string) => {
         const trimmed = title.trim();
         if (!trimmed || !activeProjectId) return;

         setProjects((current) =>
            current.map((project) =>
               project.id === activeProjectId ? { ...project, title: trimmed } : project,
            ),
         );
      },
      [activeProjectId],
   );

   const renameProjectById = useCallback(
      async (projectId: string, title: string) => {
         const trimmed = title.trim();
         if (!trimmed) return;

         const existing = projects.find((project) => project.id === projectId);
         if (!existing || existing.title === trimmed) return;

         const updatedProject = { ...existing, title: trimmed };
         setProjects((current) =>
            current.map((project) => (project.id === projectId ? updatedProject : project)),
         );

         if (!isCloud) return;

         try {
            await saveMap(projectId, updatedProject);
         } catch (error) {
            setCloudError(error instanceof Error ? error.message : 'Failed to rename project');
         }
      },
      [isCloud, projects],
   );

   const removeProject = useCallback(
      async (projectId: string) => {
         const remaining = projects.filter((project) => project.id !== projectId);
         const isRemovingActive = activeProjectId === projectId;

         if (isCloud) {
            try {
               await deleteMap(projectId);
            } catch (error) {
               setCloudError(error instanceof Error ? error.message : 'Failed to remove project');
               return;
            }
         }

         if (remaining.length === 0) {
            const empty = createEmptyProject();
            if (isCloud) {
               try {
                  const id = await createMap(empty);
                  const project = { ...empty, id, createdAt: Date.now() };
                  setProjects([project]);
                  setActiveProjectId(id);
                  setSelectedTopicIds([]);
               } catch (error) {
                  setCloudError(error instanceof Error ? error.message : 'Failed to create project');
               }
               return;
            }

            const localId = `local-${Date.now()}`;
            const project = { ...empty, id: localId, createdAt: Date.now() };
            setProjects([project]);
            setActiveProjectId(localId);
            setSelectedTopicIds([]);
            return;
         }

         setProjects(remaining);
         if (isRemovingActive) {
            setActiveProjectId(remaining[0]!.id);
            setSelectedTopicIds([]);
         }
      },
      [activeProjectId, isCloud, projects],
   );

   if (cloudLoading) {
      return (
         <div className="auth-page">
            <p className="auth-page__loading">Loading Zeon…</p>
         </div>
      );
   }

   if (cloudError) {
      return (
         <div className="auth-page">
            <div className="auth-card">
               <h1 className="auth-card__title">Could not load maps</h1>
               <p className="auth-form__error">{cloudError}</p>
               <p className="auth-card__subtitle">
                  Make sure you ran <code>supabase/schema.sql</code> in your Supabase project.
               </p>
            </div>
         </div>
      );
   }

   if (!activeProject || !sheet || !mapLayout) {
      return (
         <main className="app">
            <div className="auth-page">
               <p className="auth-page__loading">Unable to load this map.</p>
            </div>
         </main>
      );
   }

   return (
      <main className="app">
         <div className="app__workspace">
            <FloatingToolbar
               selectedTopicId={primarySelectedTopicId}
               projectTitle={activeProject.title}
               onRenameProject={renameProject}
               saveStatus={isCloud ? saveStatus : undefined}
               canUndo={canUndo(activeProjectId)}
               canRedo={canRedo(activeProjectId)}
               onUndo={handleUndo}
               onRedo={handleRedo}
               onNewBlankMap={addBlankSheet}
               onOpenHome={openHome}
               onSignOut={onSignOut}
               onInsertSibling={() => {
                  if (primarySelectedTopicId) insertSiblingTopic(primarySelectedTopicId);
               }}
               onInsertChild={() => {
                  if (primarySelectedTopicId) insertChildTopic(primarySelectedTopicId);
               }}
               onAddRelationship={startRelationshipMode}
               relationshipModeActive={relationshipMode !== null}
               onAddBoundary={addBoundaryFromSelection}
               hasTopicSelection={selectedTopicIds.length > 0}
               onAddContent={openNotesPanel}
               onAddLabel={openLabelPanel}
               onAddWebpage={() => openWebLinkModal(undefined, 'webpage')}
               onAddTopicLink={() => openTopicLinkModal()}
               onAddCloudStorage={() => openWebLinkModal(undefined, 'cloud')}
               onAddEquation={() => openEquationPanel()}
               onAddSticker={openStickerPanel}
            />
            <Viewport
               canvasStyle={canvasStyle}
               showCanvasDots={canvasDotsEnabled}
               viewport={viewport}
               onViewportChange={setViewport}
               showNavHint={showNavHint}
               onDismissNavHint={dismissNavHint}
               onClearSelection={() => {
                  dismissNotesPanel();
                  dismissLabelPanel();
                  dismissEquationPanel();
                  setWebLinkModalTopicId(null);
                  setTopicLinkModalTopicId(null);
                  setExternalLinkUrl(null);
                  setEquationSelectedTopicId(null);
                  clearTopicSelection();
                  setSelectedRelationshipId(null);
                  setSelectedBoundaryId(null);
                  cancelRelationshipMode();
               }}
               overlay={
                  <>
                     {labelScreenAnchor && labelTopic ? (
                        <TopicLabelPanel
                           anchor={labelScreenAnchor}
                           labels={labelTopic.labels ?? []}
                           autoSort={labelTopic.labelsAutoSort ?? true}
                           onChange={(labels, labelsAutoSort) =>
                              updateTopicLabels(labelTopic.id, labels, labelsAutoSort)
                           }
                           onClose={dismissLabelPanel}
                           registerCommit={(commit) => {
                              labelCommitRef.current = commit;
                           }}
                        />
                     ) : null}
                     {notesScreenAnchor && notesTopic ? (
                        <TopicNotesPanel
                           anchor={notesScreenAnchor}
                           notes={notesTopic.notes ?? ''}
                           onChange={(notes) => updateTopicNotes(notesTopic.id, notes)}
                           onClose={dismissNotesPanel}
                           registerCommit={(commit) => {
                              notesCommitRef.current = commit;
                           }}
                        />
                     ) : null}
                     {equationScreenAnchor && equationTopic ? (
                        <TopicEquationPanel
                           anchor={equationScreenAnchor}
                           initialLatex={equationTopic.equation?.latex ?? ''}
                           onChange={(latex) => updateTopicEquation(equationTopic.id, latex)}
                           onClose={dismissEquationPanel}
                           registerCommit={(commit) => {
                              equationCommitRef.current = commit;
                           }}
                        />
                     ) : null}
                  </>
               }
            >
               <MindMapCanvas
                  sheet={sheet}
                  selectedTopicIds={selectedTopicIds}
                  editTopicId={editTopicId}
                  onEditTopicIdConsumed={() => setEditTopicId(null)}
                  onEditingTopicChange={setEditingTopicId}
                  themeId={mapThemeId}
                  onSelectTopic={handleSelectTopic}
                  onSelectTopics={handleSelectTopics}
                  onClearTopicSelection={clearTopicSelection}
                  onTopicTextChange={updateTopicText}
                  onOpenNotesPanel={openNotesPanelFor}
                  onOpenLabelsPanel={openLabelsPanelFor}
                  onOpenLink={(_topicId, url) => openExternalLink(url)}
                  onFollowTopicLink={followTopicLink}
                  onOpenWebLinkEditor={(topicId, kind) => openWebLinkModal(topicId, kind)}
                  onOpenTopicLinkEditor={(topicId) => openTopicLinkModal(topicId)}
                  onDeleteNote={removeTopicNote}
                  onDeleteWebLink={removeTopicWebLink}
                  onDeleteCloudLink={removeTopicCloudLink}
                  onDeleteTopicLink={removeTopicTopicLink}
                  resolveTopicLinkLabel={resolveTopicLinkLabel}
                  equationSelectedTopicId={equationSelectedTopicId}
                  onEquationSelect={setEquationSelectedTopicId}
                  onEquationDeselect={() => setEquationSelectedTopicId(null)}
                  onOpenEquationEditor={openEquationPanelFor}
                  onEquationScaleChange={updateTopicEquationScale}
                  onEquationPlacementChange={updateTopicEquationPlacement}
                  onMoveEquation={moveTopicEquation}
                  onDeleteEquation={removeTopicEquation}
                  onDismissTopicPanels={dismissTopicPanels}
                  onInsertChild={(topicId, commitText) => insertChildTopic(topicId, commitText)}
                  onInsertSibling={(topicId, commitText) => insertSiblingTopic(topicId, commitText)}
                  onToggleCollapse={toggleCollapse}
                  onSelectSticker={updateTopicSticker}
                  stickerLegendVisible={sheet.stickerLegend?.visible ?? false}
                  stickerLegendPosition={
                     sheet.stickerLegend?.position ??
                     defaultStickerLegendPosition(mapLayout, sheet)
                  }
                  stickerLegendLabels={sheet.stickerLegend?.labelOverrides ?? {}}
                  viewportZoom={viewport.zoom}
                  onStickerLegendPositionChange={updateStickerLegendPosition}
                  onStickerLegendLabelChange={updateStickerLegendLabel}
                  viewport={viewport}
                  relationshipDraft={relationshipDraft}
                  relationshipMode={relationshipMode}
                  selectedRelationshipId={selectedRelationshipId}
                  onRelationshipTopicClick={handleRelationshipTopicClick}
                  onRelationshipCursorMove={handleRelationshipCursorMove}
                  onSelectRelationship={(relationshipId) => {
                     setSelectedRelationshipId(relationshipId);
                     if (relationshipId) {
                        setSelectedTopicIds([]);
                        dismissTopicPanels();
                     }
                  }}
                  onUpdateRelationship={updateRelationship}
                  selectedBoundaryId={selectedBoundaryId}
                  onSelectBoundary={(boundaryId) => {
                     setSelectedBoundaryId(boundaryId);
                     if (boundaryId) {
                        setSelectedTopicIds([]);
                        setSelectedRelationshipId(null);
                        dismissTopicPanels();
                     }
                  }}
                  onUpdateBoundary={updateBoundary}
               />
            </Viewport>
            <RightSidebars
               activeThemeId={mapThemeId}
               canvasDotsEnabled={canvasDotsEnabled}
               onCanvasDotsChange={handleCanvasDotsChange}
               onSelectTheme={selectMapTheme}
               selectedTopicId={primarySelectedTopicId}
               rootTopicId={sheet.rootTopicId}
               selectedTopicMarkers={
                  primarySelectedTopicId && sheet ? sheet.topicsById[primarySelectedTopicId]?.markers ?? [] : []
               }
               stickerPanelRequest={stickerPanelRequest}
               stickerLegendVisible={sheet.stickerLegend?.visible ?? false}
               onToggleStickerLegend={toggleStickerLegend}
               onSelectSticker={(stickerId) => {
                  if (!primarySelectedTopicId) return;
                  updateTopicSticker(primarySelectedTopicId, stickerId);
               }}
            />
            <BottomPanel
               projectId={activeProject.id}
               sheets={activeProject.sheets}
               sheetsById={activeProject.sheetsById}
               activeSheetId={activeProject.activeSheetId}
               topicCount={topicCount}
               zoom={viewport.zoom}
               onSelectSheet={selectSheet}
               onRenameSheet={renameSheet}
               onDuplicateSheet={duplicateSheetInProject}
               onDeleteSheet={deleteSheet}
               onAddSheet={addSheet}
               onZoomChange={setZoom}
            />
         </div>
         {showHome ? (
            <RecentsModal
               projects={projects.map((project) => {
                  const firstSheetId = project.sheets[0];
                  const rawSheet = firstSheetId ? project.sheetsById[firstSheetId] : undefined;
                  return {
                     id: project.id,
                     title: project.title,
                     createdAt: project.createdAt,
                     firstSheet: rawSheet ? normalizeSheet(rawSheet) : undefined,
                  };
               })}
               showCloudIcon={isCloud}
               onClose={() => setShowHome(false)}
               onSelectProject={selectProject}
               onNewBlankMap={createBlankProject}
               onRenameProject={renameProjectById}
               onRemoveProject={removeProject}
            />
         ) : null}
         {webLinkModalTopicId && webLinkTopic ? (
            <InsertWebLinkModal
               title={webLinkModalKind === 'cloud' ? 'Cloud Storage' : 'Insert Web Link'}
               initialUrl={
                  webLinkModalKind === 'cloud'
                     ? webLinkTopic.cloudLink?.url ?? ''
                     : webLinkTopic.webLink?.url ?? ''
               }
               onInsert={handleWebLinkInsert}
               onCancel={() => setWebLinkModalTopicId(null)}
            />
         ) : null}
         {topicLinkModalTopicId && topicLinkTopic && activeProject ? (
            <InsertTopicLinkModal
               project={activeProject}
               sourceSheetId={activeProject.activeSheetId}
               sourceTopicId={topicLinkModalTopicId}
               initialSelection={topicLinkInitialSelection}
               onInsert={handleTopicLinkInsert}
               onCancel={() => setTopicLinkModalTopicId(null)}
            />
         ) : null}
         {externalLinkUrl ? (
            <OpenExternalLinkModal
               url={externalLinkUrl}
               onCancel={() => setExternalLinkUrl(null)}
            />
         ) : null}
      </main>
   );
}

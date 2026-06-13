import { produce } from 'immer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { addChild, addSibling, deleteTopics } from '@/core/commands/commands';
import { duplicateSheet } from '@/core/model/duplicateSheet';
import { createSheet } from '@/core/model/factories';
import type { ProjectState } from '@/core/model/project';
import {
   createEmptyProject,
   prepareProjectSheet,
   projectFromSheet,
} from '@/core/model/projectFactory';
import type { TopicLinkKind, TopicRefLink, UrlLink } from '@/core/model/link';
import { createDefaultStickerLegendState, toggleTopicSticker, topicAllowsStickers } from '@/core/model/stickers';
import {
   createTopicLinkRef,
   topicDisplayText,
} from '@/core/model/link';
import type { Sheet, SheetId, TopicId, MarkerId, Vec2, Relationship } from '@/core/model/types';
import { createRelationship } from '@/core/model/relationships';
import { createSampleDocument } from '@/demo/sampleDocument';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import {
   DEFAULT_MAP_THEME_ID,
   branchColorForIndex,
   getMapCanvasStyle,
   resolveSheetThemeId,
} from '@/layout/theme';
import { layoutSheet } from '@/layout';
import type { LayoutResult } from '@/layout/types';
import { clearMeasureCache } from '@/layout/measure';
import {
   isViewportNavHintDismissed,
   markViewportNavHintDismissed,
} from '@/prefs/viewportNavHint';
import { createMap, listMaps, loadMap, saveMap } from '@/persistence/maps';
import { MindMapCanvas } from '@/view/canvas/MindMapCanvas';
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

function nextSelectionAfterDelete(sheet: Sheet, topicId: TopicId): TopicId | null {
   const topic = sheet.topicsById[topicId];
   if (!topic || topic.id === sheet.rootTopicId) return topic?.id ?? null;

   if (!topic.parentId) return sheet.rootTopicId;

   const parent = sheet.topicsById[topic.parentId];
   if (!parent) return sheet.rootTopicId;

   const index = parent.childrenIds.indexOf(topicId);
   if (index === -1) return parent.id;

   return parent.childrenIds[index + 1] ?? parent.childrenIds[index - 1] ?? parent.id;
}

function createLocalSampleProject(): ProjectState {
   const initialDoc = createSampleDocument();
   const sheetId = initialDoc.sheets[0]!;
   const preparedSheet = prepareProjectSheet(initialDoc.sheetsById[sheetId]!);

   return projectFromSheet('project-sit743', 'SIT743', preparedSheet, false);
}

export function App({ mode = 'local', onSignOut }: AppProps) {
   const isCloud = mode === 'cloud';
   const localSampleProject = useMemo(() => createLocalSampleProject(), []);

   const [projects, setProjects] = useState<ProjectState[]>(() =>
      isCloud ? [] : [localSampleProject],
   );
   const [activeProjectId, setActiveProjectId] = useState(
      isCloud ? '' : localSampleProject.id,
   );
   const [selectedTopicId, setSelectedTopicId] = useState<TopicId | null>(
      isCloud ? null : 'b2',
   );
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
   const [showNavHint, setShowNavHint] = useState(() => !isViewportNavHintDismissed());
   const [relationshipMode, setRelationshipMode] = useState<'pick-start' | 'pick-end' | null>(null);
   const [relationshipDraft, setRelationshipDraft] = useState<RelationshipDraft | null>(null);
   const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);

   const dismissNavHint = useCallback(() => {
      setShowNavHint(false);
      markViewportNavHintDismissed();
   }, []);

   const revealNavHint = useCallback(() => {
      setShowNavHint(true);
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

               const project = { ...empty, id };
               setProjects([project]);
               setActiveProjectId(id);
               setSelectedTopicId(project.sheetsById[project.activeSheetId]!.rootTopicId);
               revealNavHint();
               return;
            }

            const loaded = await Promise.all(summaries.map((summary) => loadMap(summary.id)));
            if (cancelled) return;

            const first = loaded[0]!;
            setProjects(loaded);
            setActiveProjectId(first.id);
            setSelectedTopicId(first.sheetsById[first.activeSheetId]!.rootTopicId);
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
   }, [isCloud]);

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
      setSelectedTopicId(targetSheet.rootTopicId);
   }, [cloudLoading, projects, activeProjectId]);

   const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
   const sheet = activeProject?.sheetsById[activeProject.activeSheetId];
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
      (recipe: (sheet: Sheet) => void) => {
         setProjects((current) =>
            current.map((project) => {
               if (project.id !== activeProjectId) return project;

               const activeSheet = project.sheetsById[project.activeSheetId];
               if (!activeSheet) return project;

               return {
                  ...project,
                  sheetsById: {
                     ...project.sheetsById,
                     [project.activeSheetId]: produce(activeSheet, recipe),
                  },
               };
            }),
         );
      },
      [activeProjectId],
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

            const sheetsById = { ...project.sheetsById };
            for (const { sheetId, topicId, topicLink } of updates) {
               const targetSheet = sheetsById[sheetId];
               if (!targetSheet) continue;
               sheetsById[sheetId] = produce(targetSheet, (draft) => {
                  const topic = draft.topicsById[topicId];
                  if (topic) topic.topicLink = topicLink;
               });
            }

            return { ...project, sheetsById };
         }),
      );
   };

   const expandAncestorsInSheet = (targetSheet: Sheet, topicId: TopicId): Sheet => {
      return produce(targetSheet, (draft) => {
         let current = draft.topicsById[topicId];
         while (current?.parentId) {
            const parent = draft.topicsById[current.parentId];
            if (parent) parent.collapsed = false;
            current = parent;
         }
      });
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
      setSelectedTopicId(toTopicId);
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

   const insertTopicAndActivate = useCallback(
      (
         recipe: (draft: Sheet, topicId: TopicId) => void,
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

                  const nextSheet = produce(activeSheet, (draft) => {
                     if (options?.commitText !== undefined) {
                        const sourceTopic = draft.topicsById[sourceTopicId];
                        if (sourceTopic) sourceTopic.text = options.commitText;
                     }
                     recipe(draft, sourceTopicId);
                  });
                  insertedTopicId = findInsertedTopicId(activeSheet, nextSheet);

                  return {
                     ...project,
                     sheetsById: {
                        ...project.sheetsById,
                        [project.activeSheetId]: nextSheet,
                     },
                  };
               }),
            );

            if (insertedTopicId) {
               setSelectedTopicId(insertedTopicId);
               setEditTopicId(insertedTopicId);
               setEditingTopicId(insertedTopicId);
            }
         });

         return insertedTopicId;
      },
      [dismissTopicPanels],
   );

   const insertChildTopic = useCallback(
      (topicId: TopicId, commitText?: string) => {
         insertTopicAndActivate(
            (draft, parentId) => {
               insertChildInDraft(draft, parentId, mapThemeId);
            },
            topicId,
            commitText !== undefined ? { commitText } : undefined,
         );
      },
      [mapThemeId, insertTopicAndActivate],
   );

   const insertSiblingTopic = useCallback(
      (topicId: TopicId, commitText?: string) => {
         insertTopicAndActivate(
            (draft, siblingId) => {
               insertSiblingInDraft(draft, siblingId, mapThemeId);
            },
            topicId,
            commitText !== undefined ? { commitText } : undefined,
         );
      },
      [mapThemeId, insertTopicAndActivate],
   );

   const cancelRelationshipMode = useCallback(() => {
      setRelationshipMode(null);
      setRelationshipDraft(null);
   }, []);

   const startRelationshipMode = useCallback(() => {
      dismissTopicPanels();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedRelationshipId(null);

      if (selectedTopicId) {
         setRelationshipMode('pick-end');
         setRelationshipDraft({ fromId: selectedTopicId, cursor: { x: 0, y: 0 } });
         return;
      }

      setRelationshipMode('pick-start');
      setRelationshipDraft(null);
   }, [selectedTopicId, dismissTopicPanels]);

   const handleRelationshipTopicClick = useCallback(
      (topicId: TopicId) => {
         if (relationshipMode === 'pick-start') {
            setRelationshipMode('pick-end');
            setRelationshipDraft({ fromId: topicId, cursor: { x: 0, y: 0 } });
            setSelectedTopicId(topicId);
            return;
         }

         if (relationshipMode === 'pick-end' && relationshipDraft) {
            if (topicId === relationshipDraft.fromId) return;

            const relationship = createRelationship(relationshipDraft.fromId, topicId);
            updateActiveSheet((draft) => {
               draft.relationships.push(relationship);
            });
            setSelectedRelationshipId(relationship.id);
            setRelationshipMode(null);
            setRelationshipDraft(null);
            setSelectedTopicId(topicId);
         }
      },
      [relationshipMode, relationshipDraft, updateActiveSheet],
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

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape' && relationshipMode) {
            event.preventDefault();
            cancelRelationshipMode();
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
   }, [relationshipMode, cancelRelationshipMode, startRelationshipMode]);

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (
            !sheet ||
            !selectedTopicId ||
            editingTopicId ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
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

         event.preventDefault();

         if (event.key === 'Delete') {
            const selectedTopic = sheet.topicsById[selectedTopicId];
            if (!selectedTopic) return;
            if (selectedTopic.id === sheet.rootTopicId) {
               setSelectedTopicId(selectedTopic.id);
               return;
            }

            const nextSelectedTopicId = nextSelectionAfterDelete(sheet, selectedTopicId);

            setProjects((current) =>
               current.map((project) => {
                  if (project.id !== activeProjectIdRef.current) return project;

                  const activeSheetId = project.activeSheetId;
                  const activeSheet = project.sheetsById[activeSheetId];
                  if (!activeSheet?.topicsById[selectedTopicId]) return project;

                  const sheetsById = produce(project.sheetsById, (draftSheets) => {
                     const draft = draftSheets[activeSheetId];
                     if (!draft?.topicsById[selectedTopicId]) return;

                     const doc = {
                        formatVersion: 1 as const,
                        id: project.id,
                        title: project.title,
                        createdAt: Date.now(),
                        modifiedAt: Date.now(),
                        sheets: project.sheets,
                        sheetsById: draftSheets,
                     };
                     deleteTopics({ doc, sheetId: draft.id }, { topicIds: [selectedTopicId] });
                  });

                  return { ...project, sheetsById };
               }),
            );

            setSelectedTopicId(nextSelectedTopicId);
            return;
         }

         if (event.key === 'Tab') {
            insertChildTopic(selectedTopicId);
            return;
         }

         insertSiblingTopic(selectedTopicId);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [selectedTopicId, sheet, editingTopicId, insertChildTopic, insertSiblingTopic, updateActiveSheet]);

   const openNotesPanel = () => {
      if (!selectedTopicId) return;
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setNotesPanelTopicId(selectedTopicId);
   };

   const openLabelPanel = () => {
      if (!selectedTopicId) return;
      dismissNotesPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicId(selectedTopicId);
      setLabelPanelTopicId(selectedTopicId);
   };

   const openStickerPanel = () => {
      if (!selectedTopicId) return;
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicId(selectedTopicId);
      setStickerPanelRequest((count) => count + 1);
   };

   const openEquationPanel = (topicId?: TopicId) => {
      const targetId = topicId ?? selectedTopicId;
      if (!targetId) return;
      dismissNotesPanel();
      dismissLabelPanel();
      setWebLinkModalTopicId(null);
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicId(targetId);
      setEquationPanelTopicId(targetId);
   };

   const openWebLinkModal = (topicId?: TopicId, kind: TopicLinkKind = 'webpage') => {
      const targetId = topicId ?? selectedTopicId;
      if (!targetId) return;
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setTopicLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicId(targetId);
      setWebLinkModalKind(kind === 'topic' ? 'webpage' : kind);
      setWebLinkModalTopicId(targetId);
   };

   const openTopicLinkModal = (topicId?: TopicId) => {
      const targetId = topicId ?? selectedTopicId;
      if (!targetId || !sheet) return;
      dismissNotesPanel();
      dismissLabelPanel();
      dismissEquationPanel();
      setWebLinkModalTopicId(null);
      setEquationSelectedTopicId(null);
      setSelectedTopicId(targetId);
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

         const expandedSheet = expandAncestorsInSheet(targetSheet, targetTopicId);

         setProjects((current) =>
            current.map((project) => {
               if (project.id !== activeProjectId) return project;
               return {
                  ...project,
                  activeSheetId: targetSheetId,
                  sheetsById: {
                     ...project.sheetsById,
                     [targetSheetId]: expandedSheet,
                  },
               };
            }),
         );
         setSelectedTopicId(targetTopicId);

         window.setTimeout(() => {
            focusTopicInViewport(targetTopicId, expandedSheet);
         }, 0);
      },
      [
         sheet,
         activeProject,
         activeProjectId,
         dismissTopicPanels,
         focusTopicInViewport,
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
      setSelectedTopicId(topicId);
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
      setSelectedTopicId(topicId);
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
      setSelectedTopicId(topicId);
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

   const selectProject = (projectId: string) => {
      const project = projects.find((candidate) => candidate.id === projectId);
      if (!project) return;

      setActiveProjectId(project.id);
      const activeSheet = project.sheetsById[project.activeSheetId];
      setSelectedTopicId(activeSheet?.rootTopicId ?? null);
   };

   const selectSheet = (sheetId: SheetId) => {
      setProjects((current) =>
         current.map((project) =>
            project.id === activeProjectId ? { ...project, activeSheetId: sheetId } : project,
         ),
      );
      const nextSheet = activeProject.sheetsById[sheetId];
      if (nextSheet) setSelectedTopicId(nextSheet.rootTopicId);
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
      setSelectedTopicId(copy.rootTopicId);
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
         const nextSheet = project.sheetsById[nextActiveId];
         if (nextSheet) setSelectedTopicId(nextSheet.rootTopicId);
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

   const addSheet = () => {
      const nextIndex = activeProject.sheets.length + 1;
      const newSheet = createSheet({ title: `Map ${nextIndex}` });

      setProjects((current) =>
         current.map((project) =>
            project.id === activeProjectId
               ? {
                  ...project,
                  sheets: [...project.sheets, newSheet.id],
                  sheetsById: { ...project.sheetsById, [newSheet.id]: newSheet },
                  activeSheetId: newSheet.id,
               }
               : project,
         ),
      );
      setSelectedTopicId(newSheet.rootTopicId);
      revealNavHint();
   };

   const createProject = async () => {
      const nextIndex = projects.length + 1;
      const title = `Project ${nextIndex}`;

      if (isCloud) {
         const empty = createEmptyProject(title);
         const id = await createMap(empty);
         const project = { ...empty, id };

         setProjects((current) => [...current, project]);
         setActiveProjectId(id);
         setSelectedTopicId(project.sheetsById[project.activeSheetId]!.rootTopicId);
         revealNavHint();
         return;
      }

      const doc = createSampleDocument();
      const newSheet = prepareProjectSheet(doc.sheetsById[doc.sheets[0]!]!);
      newSheet.title = title;
      const projectId = `project-${Date.now()}`;
      const project = projectFromSheet(projectId, title, newSheet, false);

      setProjects((current) => [...current, project]);
      setActiveProjectId(projectId);
      setSelectedTopicId(newSheet.rootTopicId);
      revealNavHint();
   };

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
      return null;
   }

   return (
      <main className="app">
         <div className="app__workspace">
            <FloatingToolbar
               selectedTopicId={selectedTopicId}
               projects={projects.map((project) => ({ id: project.id, title: project.title }))}
               activeProjectId={activeProjectId}
               onSelectProject={selectProject}
               onCreateProject={createProject}
               onInsertSibling={() => {
                  if (selectedTopicId) insertSiblingTopic(selectedTopicId);
               }}
               onInsertChild={() => {
                  if (selectedTopicId) insertChildTopic(selectedTopicId);
               }}
               onAddRelationship={startRelationshipMode}
               relationshipModeActive={relationshipMode !== null}
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
                  setSelectedTopicId(null);
                  setSelectedRelationshipId(null);
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
                  selectedTopicId={selectedTopicId}
                  editTopicId={editTopicId}
                  onEditTopicIdConsumed={() => setEditTopicId(null)}
                  onEditingTopicChange={setEditingTopicId}
                  themeId={mapThemeId}
                  onSelectTopic={(topicId) => {
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
                     setEquationSelectedTopicId(null);
                     setSelectedTopicId(topicId);
                  }}
                  onTopicTextChange={updateTopicText}
                  onInsertChildAfterEdit={insertChildTopic}
                  onInsertSiblingAfterEdit={insertSiblingTopic}
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
                        setSelectedTopicId(null);
                        dismissTopicPanels();
                     }
                  }}
                  onUpdateRelationship={updateRelationship}
               />
            </Viewport>
            <RightSidebars
               activeThemeId={mapThemeId}
               canvasDotsEnabled={canvasDotsEnabled}
               onCanvasDotsChange={handleCanvasDotsChange}
               onSelectTheme={selectMapTheme}
               selectedTopicId={selectedTopicId}
               rootTopicId={sheet.rootTopicId}
               selectedTopicMarkers={
                  selectedTopicId && sheet ? sheet.topicsById[selectedTopicId]?.markers ?? [] : []
               }
               stickerPanelRequest={stickerPanelRequest}
               stickerLegendVisible={sheet.stickerLegend?.visible ?? false}
               onToggleStickerLegend={toggleStickerLegend}
               onSelectSticker={(stickerId) => {
                  if (!selectedTopicId) return;
                  updateTopicSticker(selectedTopicId, stickerId);
               }}
            />
            <BottomPanel
               projectId={activeProject.id}
               sheets={activeProject.sheets}
               sheetsById={activeProject.sheetsById}
               activeSheetId={activeProject.activeSheetId}
               topicCount={topicCount}
               zoom={viewport.zoom}
               saveStatus={isCloud ? saveStatus : undefined}
               onSignOut={onSignOut}
               onSelectSheet={selectSheet}
               onRenameSheet={renameSheet}
               onDuplicateSheet={duplicateSheetInProject}
               onDeleteSheet={deleteSheet}
               onAddSheet={addSheet}
               onZoomChange={setZoom}
            />
         </div>
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

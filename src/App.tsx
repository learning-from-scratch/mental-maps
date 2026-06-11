import { produce } from 'immer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addChild, addSibling, deleteTopics } from '@/core/commands/commands';
import { duplicateSheet } from '@/core/model/duplicateSheet';
import { createSheet } from '@/core/model/factories';
import type { ProjectState } from '@/core/model/project';
import {
   createEmptyProject,
   prepareProjectSheet,
   projectFromSheet,
} from '@/core/model/projectFactory';
import type { Sheet, SheetId, TopicId } from '@/core/model/types';
import { createSampleDocument } from '@/demo/sampleDocument';
import { useDebouncedSave } from '@/hooks/useDebouncedSave';
import {
   DEFAULT_MAP_THEME_ID,
   branchColorForIndex,
   getMapCanvasStyle,
   resolveSheetThemeId,
} from '@/layout/theme';
import { layoutSheet } from '@/layout';
import { createMap, listMaps, loadMap, saveMap } from '@/persistence/maps';
import { MindMapCanvas } from '@/view/canvas/MindMapCanvas';
import { Viewport, type ViewportState } from '@/view/canvas/Viewport';
import { TopicNotesPanel } from '@/view/topic/TopicNotesPanel';
import { ThemeSidebar } from '@/view/sidebar/ThemeSidebar';
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
   const notesCommitRef = useRef<(() => void) | null>(null);
   const [viewport, setViewport] = useState<ViewportState>(() => ({
      x: window.innerWidth / 2 - 64,
      y: window.innerHeight / 2,
      zoom: 1,
   }));

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

   const notesScreenAnchor = useMemo(() => {
      if (!notesPanelTopicId || !mapLayout) return null;
      const node = mapLayout.nodes.get(notesPanelTopicId);
      if (!node) return null;

      const worldX = node.x + node.width / 2;
      const worldY = node.y + node.height + 10;

      return {
         left: viewport.x + viewport.zoom * worldX,
         top: viewport.y + viewport.zoom * worldY,
         zoom: viewport.zoom,
      };
   }, [notesPanelTopicId, mapLayout, viewport]);

   const notesTopic =
      notesPanelTopicId != null && sheet ? sheet.topicsById[notesPanelTopicId] : undefined;

   const updateActiveSheet = (recipe: (sheet: Sheet) => void) => {
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
   };

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

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (!sheet || !selectedTopicId || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
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

            updateActiveSheet((draft) => {
               if (!draft.topicsById[selectedTopicId]) return;

               const doc = {
                  formatVersion: 1 as const,
                  id: 'keyboard-session',
                  title: draft.title,
                  createdAt: Date.now(),
                  modifiedAt: Date.now(),
                  sheets: [draft.id],
                  sheetsById: { [draft.id]: draft },
               };
               const ctx = { doc, sheetId: draft.id };
               deleteTopics(ctx, { topicIds: [selectedTopicId] });
            });

            setSelectedTopicId(nextSelectedTopicId);
            return;
         }

         let insertedTopicId: TopicId | null = null;
         updateActiveSheet((draft) => {
            const selectedTopic = draft.topicsById[selectedTopicId];
            if (!selectedTopic) return;

            const root = draft.topicsById[draft.rootTopicId];
            const nextRootBranchColor = () =>
               branchColorForIndex(root?.childrenIds.length ?? 0, mapThemeId);
            const applyRootBranchColor = (topicId: TopicId, color: string) => {
               const topic = draft.topicsById[topicId];
               if (!topic) return;
               topic.style = {
                  ...topic.style,
                  branchColor: color,
               };
            };

            const doc = {
               formatVersion: 1 as const,
               id: 'keyboard-session',
               title: draft.title,
               createdAt: Date.now(),
               modifiedAt: Date.now(),
               sheets: [draft.id],
               sheetsById: { [draft.id]: draft },
            };
            const ctx = { doc, sheetId: draft.id };

            if (event.key === 'Tab') {
               if (selectedTopic.collapsed) selectedTopic.collapsed = false;
               const side =
                  selectedTopic.id === draft.rootTopicId
                     ? chooseRootBranchSide(draft, selectedTopic.side ?? 'right')
                     : selectedTopic.side;
               const branchColor =
                  selectedTopic.id === draft.rootTopicId
                     ? nextRootBranchColor()
                     : selectedTopic.style?.branchColor;

               insertedTopicId = addChild(ctx, {
                  parentId: selectedTopicId,
                  text: 'New Topic',
                  side,
               });
               if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
               return;
            }

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

               insertedTopicId = addSibling(ctx, {
                  topicId: selectedTopicId,
                  text: 'New Topic',
               });
               const insertedTopic = draft.topicsById[insertedTopicId];
               if (insertedTopic) insertedTopic.side = side;
               if (branchColor) applyRootBranchColor(insertedTopicId, branchColor);
            } else {
               const branchColor = nextRootBranchColor();
               const side = chooseRootBranchSide(draft, 'right');
               insertedTopicId = addChild(ctx, {
                  parentId: selectedTopicId,
                  text: 'New Topic',
                  side,
               });
               applyRootBranchColor(insertedTopicId, branchColor);
            }
         });

         if (insertedTopicId) setSelectedTopicId(insertedTopicId);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [selectedTopicId, sheet, mapThemeId]);

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

   const dismissNotesPanel = useCallback(() => {
      notesCommitRef.current?.();
      setNotesPanelTopicId(null);
   }, []);

   const openNotesPanel = () => {
      if (selectedTopicId) setNotesPanelTopicId(selectedTopicId);
   };

   const openNotesPanelFor = (topicId: TopicId) => {
      if (notesPanelTopicId && notesPanelTopicId !== topicId) {
         dismissNotesPanel();
      }
      setSelectedTopicId(topicId);
      setNotesPanelTopicId(topicId);
   };

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
               onAddContent={openNotesPanel}
               onAddComment={() => {}}
            />
            <Viewport
               canvasStyle={canvasStyle}
               showCanvasDots={canvasDotsEnabled}
               viewport={viewport}
               onViewportChange={setViewport}
               onClearSelection={() => {
                  dismissNotesPanel();
                  setSelectedTopicId(null);
               }}
               overlay={
                  notesScreenAnchor && notesTopic ? (
                     <TopicNotesPanel
                        anchor={notesScreenAnchor}
                        notes={notesTopic.notes ?? ''}
                        onChange={(notes) => updateTopicNotes(notesTopic.id, notes)}
                        onClose={dismissNotesPanel}
                        registerCommit={(commit) => {
                           notesCommitRef.current = commit;
                        }}
                     />
                  ) : null
               }
            >
               <MindMapCanvas
                  sheet={sheet}
                  selectedTopicId={selectedTopicId}
                  themeId={mapThemeId}
                  onSelectTopic={(topicId) => {
                     if (notesPanelTopicId && notesPanelTopicId !== topicId) {
                        dismissNotesPanel();
                     }
                     setSelectedTopicId(topicId);
                  }}
                  onTopicTextChange={updateTopicText}
                  onOpenNotesPanel={openNotesPanelFor}
                  onToggleCollapse={toggleCollapse}
               />
            </Viewport>
            <ThemeSidebar
               activeThemeId={mapThemeId}
               canvasDotsEnabled={canvasDotsEnabled}
               onCanvasDotsChange={handleCanvasDotsChange}
               onSelectTheme={selectMapTheme}
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
      </main>
   );
}

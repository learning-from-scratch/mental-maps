import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Sheet, TopicId, MarkerId, Vec2 } from '@/core/model/types';
import type { TopicLinkKind } from '@/core/model/link';
import { collectSheetStickerIds } from '@/core/model/stickers';
import { collectDescendantIds } from '@/core/commands/tree';
import { layoutSheet } from '@/layout';
import { collapseHandleCenterX } from '@/layout/edges';
import { DEFAULT_MAP_THEME_ID } from '@/layout/theme';
import { EdgeLayer } from '@/view/edge/EdgeLayer';
import { RelationshipLayer, type RelationshipDraft } from '@/view/relationship/RelationshipLayer';
import { BoundaryBackgroundLayer, BoundaryInteractionLayer } from '@/view/boundary/BoundaryLayer';
import { SummaryBackgroundLayer, SummaryInteractionLayer } from '@/view/summary/SummaryLayer';
import type { Relationship, Boundary, Summary } from '@/core/model/types';
import { CollapseHandle } from '@/view/topic/CollapseHandle';
import { TopicView } from '@/view/topic/TopicView';
import { StickerLegend } from '@/view/canvas/StickerLegend';
import { clientToViewport, clientToWorld } from '@/view/canvas/coords';
import type { ViewportState } from '@/view/canvas/Viewport';
import { isViewportInteractiveTarget } from '@/view/canvas/Viewport';
import {
   findEquationDropTarget,
   type EquationDragOverlay,
} from '@/view/topic/equationDropTarget';

import {
   mergeSelection,
   normalizeSelectionRect,
   topicIdsInSelectionRect,
   type SelectionRect,
} from '@/view/canvas/selection';

const MARQUEE_MIN_DRAG = 4;

const MARQUEE_BLOCKER_SELECTOR =
   '.topic-view-wrap, .collapse-handle-wrap, .sticker-legend, .relationship-layer, .relationship-layer__path-hit, .relationship-layer__handle, .relationship-layer__label-wrap, .boundary-layer__pad-hit, .boundary-layer__handle, .boundary-layer__add-label, .boundary-layer__label--interactive, .summary-layer__pad-hit, .summary-layer__handle, .summary-layer__box, .summary-layer__box-hit, .summary-layer__box-text, .summary-layer__hover-zone';

/** Clicks on these keep the summary selected (group pad/outline does not). */
const SUMMARY_KEEP_SELECTION_SELECTOR =
   '.summary-layer__box, .summary-layer__box-hit, .summary-layer__box-text, .summary-layer__editor, .summary-layer__handle';

/** Clicks on these keep the boundary selected (group pad does not). */
const BOUNDARY_KEEP_SELECTION_SELECTOR =
   '.boundary-layer__handle, .boundary-layer__add-label, .boundary-layer__label, .boundary-layer__label--interactive';

/** Clicks on these keep the relationship selected. */
const RELATIONSHIP_KEEP_SELECTION_SELECTOR =
   '.relationship-layer__path-hit, .relationship-layer__handle, .relationship-layer__label-wrap';

interface MindMapCanvasProps {
   sheet: Sheet;
   selectedTopicIds: TopicId[];
   editTopicId?: TopicId | null;
   onEditTopicIdConsumed?: () => void;
   onEditingTopicChange?: (topicId: TopicId | null) => void;
   /** Active map theme id — included so layout (edge colors) recomputes on change. */
   themeId?: string;
   onSelectTopic: (topicId: TopicId, options?: { additive?: boolean }) => void;
   onSelectTopics: (topicIds: TopicId[], options?: { additive?: boolean }) => void;
   onClearTopicSelection: () => void;
   onTopicTextChange: (topicId: TopicId, text: string) => void;
   onOpenNotesPanel: (topicId: TopicId) => void;
   onOpenLabelsPanel: (topicId: TopicId) => void;
   onOpenLink: (topicId: TopicId, url: string) => void;
   onFollowTopicLink: (topicId: TopicId) => void;
   onOpenWebLinkEditor: (topicId: TopicId, kind?: TopicLinkKind) => void;
   onOpenTopicLinkEditor: (topicId: TopicId) => void;
   onDeleteNote: (topicId: TopicId) => void;
   onDeleteWebLink: (topicId: TopicId) => void;
   onDeleteCloudLink: (topicId: TopicId) => void;
   onDeleteTopicLink: (topicId: TopicId) => void;
   onSelectSticker?: (topicId: TopicId, stickerId: MarkerId) => void;
   stickerLegendVisible?: boolean;
   stickerLegendPosition?: Vec2;
   stickerLegendLabels?: Record<MarkerId, string>;
   viewportZoom?: number;
   viewport?: ViewportState;
   onStickerLegendPositionChange?: (position: Vec2) => void;
   onStickerLegendLabelChange?: (markerId: MarkerId, label: string) => void;
   equationSelectedTopicId?: TopicId | null;
   onEquationSelect?: (topicId: TopicId) => void;
   onEquationDeselect?: () => void;
   onOpenEquationEditor?: (topicId: TopicId) => void;
   onEquationScaleChange?: (topicId: TopicId, scale: number) => void;
   onLiveEquationScaleChange?: (topicId: TopicId, scale: number | null) => void;
   onEquationPlacementChange?: (topicId: TopicId, placement: 'top' | 'bottom' | 'left' | 'right') => void;
   onMoveEquation?: (
      fromTopicId: TopicId,
      toTopicId: TopicId,
      placement: 'top' | 'bottom' | 'left' | 'right',
   ) => void;
   onDeleteEquation?: (topicId: TopicId) => void;
   onDismissTopicPanels?: () => void;
   onToggleCollapse: (topicId: TopicId) => void;
   onInsertChild?: (topicId: TopicId, commitText: string) => void;
   onInsertSibling?: (topicId: TopicId, commitText: string) => void;
   resolveTopicLinkLabel?: (topicId: TopicId) => string | undefined;
   relationshipDraft?: RelationshipDraft | null;
   relationshipMode?: 'pick-start' | 'pick-end' | null;
   selectedRelationshipId?: string | null;
   onRelationshipTopicClick?: (topicId: TopicId) => void;
   onRelationshipCursorMove?: (point: Vec2) => void;
   onCancelRelationshipMode?: () => void;
   onSelectRelationship?: (relationshipId: string | null) => void;
   onUpdateRelationship?: (relationshipId: string, patch: Partial<Relationship>) => void;
   selectedBoundaryId?: string | null;
   onSelectBoundary?: (boundaryId: string | null) => void;
   onUpdateBoundary?: (boundaryId: string, patch: Partial<Boundary>) => void;
   onBoundarySelectTopic?: (topicId: TopicId, options?: { additive?: boolean }) => void;
   selectedSummaryId?: string | null;
   onSelectSummary?: (summaryId: string | null) => void;
   onUpdateSummary?: (summaryId: string, patch: Partial<Summary>) => void;
   onUpdateSummaryText?: (summaryId: string, text: string) => void;
   onSummarySelectTopic?: (topicId: TopicId, options?: { additive?: boolean }) => void;
}

export function MindMapCanvas({
   sheet,
   selectedTopicIds,
   editTopicId = null,
   onEditTopicIdConsumed,
   onEditingTopicChange,
   themeId = DEFAULT_MAP_THEME_ID,
   onSelectTopic,
   onSelectTopics,
   onClearTopicSelection,
   onTopicTextChange,
   onOpenNotesPanel,
   onOpenLabelsPanel,
   onOpenLink,
   onFollowTopicLink,
   onOpenWebLinkEditor,
   onOpenTopicLinkEditor,
   onDeleteNote,
   onDeleteWebLink,
   onDeleteCloudLink,
   onDeleteTopicLink,
   onSelectSticker,
   stickerLegendVisible = false,
   stickerLegendPosition = { x: 24, y: 24 },
   stickerLegendLabels = {},
   viewportZoom = 1,
   viewport = { x: 0, y: 0, zoom: viewportZoom },
   onStickerLegendPositionChange,
   onStickerLegendLabelChange,
   equationSelectedTopicId = null,
   onEquationSelect,
   onEquationDeselect,
   onOpenEquationEditor,
   onEquationScaleChange,
   onEquationPlacementChange,
   onMoveEquation,
   onDeleteEquation,
   onDismissTopicPanels,
   onToggleCollapse,
   onInsertChild,
   onInsertSibling,
   resolveTopicLinkLabel,
   relationshipDraft = null,
   relationshipMode = null,
   selectedRelationshipId = null,
   onRelationshipTopicClick,
   onRelationshipCursorMove,
   onCancelRelationshipMode,
   onSelectRelationship = () => {},
   onUpdateRelationship = () => {},
   selectedBoundaryId = null,
   onSelectBoundary = () => {},
   onUpdateBoundary = () => {},
   onBoundarySelectTopic,
   selectedSummaryId = null,
   onSelectSummary = () => {},
   onUpdateSummary = () => {},
   onUpdateSummaryText = () => {},
   onSummarySelectTopic,
}: MindMapCanvasProps) {
   const [liveEdit, setLiveEdit] = useState<{ topicId: TopicId; text: string } | null>(null);
   const [liveEquationScale, setLiveEquationScale] = useState<{
      topicId: TopicId;
      scale: number;
   } | null>(null);
   const [hoveredCollapseTopicId, setHoveredCollapseTopicId] = useState<TopicId | null>(null);
   const [equationDrag, setEquationDrag] = useState<EquationDragOverlay | null>(null);
   const canvasRef = useRef<HTMLDivElement>(null);
   const layoutNodesRef = useRef(layoutSheet(sheet).nodes);
   const viewportRef = useRef(viewport);
   viewportRef.current = viewport;
   const editingTopicRef = useRef<TopicId | null>(null);
   const marqueeDragRef = useRef<{
      pointerId: number;
      start: Vec2;
      current: Vec2;
      startScreen: Vec2;
      currentScreen: Vec2;
      active: boolean;
      additive: boolean;
      viewportEl: HTMLElement;
   } | null>(null);
   const [marqueeScreenRect, setMarqueeScreenRect] = useState<SelectionRect | null>(null);
   const [marqueePreviewIds, setMarqueePreviewIds] = useState<TopicId[] | null>(null);
   const relationshipModeRef = useRef(relationshipMode);
   relationshipModeRef.current = relationshipMode;
   const onRelationshipCursorMoveRef = useRef(onRelationshipCursorMove);
   onRelationshipCursorMoveRef.current = onRelationshipCursorMove;
   const onCancelRelationshipModeRef = useRef(onCancelRelationshipMode);
   onCancelRelationshipModeRef.current = onCancelRelationshipMode;
   const lastPointerWorldRef = useRef<Vec2 | null>(null);
   const selectedTopicIdSet = useMemo(() => new Set(selectedTopicIds), [selectedTopicIds]);
   const highlightedTopicIdSet = useMemo(() => {
      if (!marqueePreviewIds) return selectedTopicIdSet;
      return new Set(marqueePreviewIds);
   }, [marqueePreviewIds, selectedTopicIdSet]);

   const updateRelationshipCursor = useCallback((clientX: number, clientY: number) => {
      const container = canvasRef.current?.closest('.viewport');
      if (!(container instanceof HTMLElement)) return;
      const world = clientToWorld(clientX, clientY, viewportRef.current, container);
      lastPointerWorldRef.current = world;
      if (relationshipModeRef.current === 'pick-end') {
         onRelationshipCursorMoveRef.current?.(world);
      }
   }, []);

   useEffect(() => {
      if (relationshipMode !== 'pick-end') return;

      const onPointerMove = (event: PointerEvent) => {
         updateRelationshipCursor(event.clientX, event.clientY);
      };

      window.addEventListener('pointermove', onPointerMove);
      return () => window.removeEventListener('pointermove', onPointerMove);
   }, [relationshipMode, updateRelationshipCursor]);

   const handleTopicSelect = useCallback(
      (topicId: TopicId, options?: { additive?: boolean }) => {
         if (relationshipMode) {
            if (lastPointerWorldRef.current) {
               onRelationshipCursorMoveRef.current?.(lastPointerWorldRef.current);
            }
            onRelationshipTopicClick?.(topicId);
            return;
         }
         onSelectTopic(topicId, options);
      },
      [relationshipMode, onRelationshipTopicClick, onSelectTopic],
   );

   const isMarqueeBlockedTarget = useCallback((target: EventTarget | null) => {
      return Boolean((target as HTMLElement | null)?.closest(MARQUEE_BLOCKER_SELECTOR));
   }, []);

   const finishMarquee = useCallback(
      (event: PointerEvent) => {
         const drag = marqueeDragRef.current;
         if (!drag || drag.pointerId !== event.pointerId) return;

         marqueeDragRef.current = null;
         setMarqueeScreenRect(null);
         setMarqueePreviewIds(null);
         if (drag.viewportEl.hasPointerCapture(event.pointerId)) {
            drag.viewportEl.releasePointerCapture(event.pointerId);
         }

         if (drag.active) {
            const rect = normalizeSelectionRect(drag.start, drag.current);
            const hits = topicIdsInSelectionRect(layoutNodesRef.current, rect, [
               sheet.rootTopicId,
            ]);
            onSelectTopics(hits, { additive: drag.additive });
            return;
         }

         if (!drag.additive) {
            onClearTopicSelection();
         }
         onSelectBoundary(null);
         onSelectSummary(null);
         onSelectRelationship(null);
         onCancelRelationshipModeRef.current?.();
      },
      [onClearTopicSelection, onSelectBoundary, onSelectRelationship, onSelectSummary, onSelectTopics],
   );

   useEffect(() => {
      const onPointerMove = (event: PointerEvent) => {
         const drag = marqueeDragRef.current;
         if (!drag || drag.pointerId !== event.pointerId) return;

         const current = clientToWorld(
            event.clientX,
            event.clientY,
            viewportRef.current,
            drag.viewportEl,
         );
         const currentScreen = clientToViewport(event.clientX, event.clientY, drag.viewportEl);
         drag.current = current;
         drag.currentScreen = currentScreen;

         const worldRect = normalizeSelectionRect(drag.start, current);
         const moved = Math.hypot(current.x - drag.start.x, current.y - drag.start.y);
         if (!drag.active && moved >= MARQUEE_MIN_DRAG) {
            drag.active = true;
         }
         if (drag.active) {
            setMarqueeScreenRect(normalizeSelectionRect(drag.startScreen, currentScreen));
            const hits = topicIdsInSelectionRect(layoutNodesRef.current, worldRect, [
               sheet.rootTopicId,
            ]);
            setMarqueePreviewIds(
               drag.additive ? mergeSelection(selectedTopicIds, hits) : hits,
            );
         }
      };

      const onPointerUp = (event: PointerEvent) => {
         if (!marqueeDragRef.current) return;
         finishMarquee(event);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      return () => {
         window.removeEventListener('pointermove', onPointerMove);
         window.removeEventListener('pointerup', onPointerUp);
         window.removeEventListener('pointercancel', onPointerUp);
      };
   }, [finishMarquee, selectedTopicIds]);

   useEffect(() => {
      const onPointerDown = (event: PointerEvent) => {
         if (event.button !== 0) return;
         if (!(event.target instanceof Element)) return;
         const target = event.target;

         if (relationshipModeRef.current) {
            const viewportEl = target.closest('.viewport');
            if (viewportEl instanceof HTMLElement) {
               updateRelationshipCursor(event.clientX, event.clientY);
            }

            if (target.closest('.topic-view-wrap')) return;

            if (!target.closest(RELATIONSHIP_KEEP_SELECTION_SELECTOR)) {
               onCancelRelationshipModeRef.current?.();
            }
            return;
         }

         if (!target.closest(SUMMARY_KEEP_SELECTION_SELECTOR)) {
            const summaryEditorActive = document.querySelector(
               '.summary-layer__editor',
            );
            if (!summaryEditorActive) {
               onSelectSummary(null);
            }
         }
         if (!target.closest(BOUNDARY_KEEP_SELECTION_SELECTOR)) {
            onSelectBoundary(null);
         }
         if (!target.closest(RELATIONSHIP_KEEP_SELECTION_SELECTOR)) {
            onSelectRelationship(null);
         }

         const viewportEl = target.closest('.viewport');
         if (!(viewportEl instanceof HTMLElement)) return;

         const canMarquee =
            !isMarqueeBlockedTarget(event.target) &&
            !isViewportInteractiveTarget(event.target);

         if (!canMarquee) {
            if (
               !event.shiftKey &&
               !target.closest('.topic-view-wrap') &&
               !isViewportInteractiveTarget(event.target)
            ) {
               onClearTopicSelection();
            }
            return;
         }

         const start = clientToWorld(
            event.clientX,
            event.clientY,
            viewportRef.current,
            viewportEl,
         );
         const startScreen = clientToViewport(event.clientX, event.clientY, viewportEl);
         marqueeDragRef.current = {
            pointerId: event.pointerId,
            start,
            current: start,
            startScreen,
            currentScreen: startScreen,
            active: false,
            additive: event.shiftKey,
            viewportEl,
         };
         setMarqueeScreenRect(null);
         setMarqueePreviewIds(null);
         viewportEl.setPointerCapture(event.pointerId);
         event.preventDefault();
      };

      document.addEventListener('pointerdown', onPointerDown, true);
      return () => document.removeEventListener('pointerdown', onPointerDown, true);
   }, [
      isMarqueeBlockedTarget,
      onClearTopicSelection,
      onSelectBoundary,
      onSelectRelationship,
      onSelectSummary,
      updateRelationshipCursor,
   ]);

   const handleEditingChange = useCallback(
      (topicId: TopicId, editing: boolean) => {
         if (editing) {
            editingTopicRef.current = topicId;
            onEditingTopicChange?.(topicId);
            return;
         }
         if (editingTopicRef.current === topicId) {
            editingTopicRef.current = null;
            onEditingTopicChange?.(null);
         }
      },
      [onEditingTopicChange],
   );

   const handleLiveTextChange = useCallback((topicId: TopicId, text: string | null) => {
      setLiveEdit(text === null ? null : { topicId, text });
   }, []);

   const layoutSheetInput = useMemo(() => {
      let nextSheet = sheet;

      if (liveEdit) {
         const topic = nextSheet.topicsById[liveEdit.topicId];
         if (topic) {
            nextSheet = {
               ...nextSheet,
               topicsById: {
                  ...nextSheet.topicsById,
                  [liveEdit.topicId]: { ...topic, text: liveEdit.text },
               },
            };
         }
      }

      if (liveEquationScale) {
         const topic = nextSheet.topicsById[liveEquationScale.topicId];
         if (topic?.equation) {
            nextSheet = {
               ...nextSheet,
               topicsById: {
                  ...nextSheet.topicsById,
                  [liveEquationScale.topicId]: {
                     ...topic,
                     equation: { ...topic.equation, scale: liveEquationScale.scale },
                  },
               },
            };
         }
      }

      return nextSheet;
   }, [sheet, liveEdit, liveEquationScale]);

   const layout = useMemo(
      () => layoutSheet(layoutSheetInput, liveEdit?.topicId, themeId),
      [layoutSheetInput, themeId, liveEdit?.topicId, liveEquationScale],
   );
   layoutNodesRef.current = layout.nodes;

   const handleLiveEquationScaleChange = useCallback((topicId: TopicId, scale: number | null) => {
      if (scale == null) {
         setLiveEquationScale(null);
         return;
      }
      setLiveEquationScale({ topicId, scale });
   }, []);

   const topicNodes = useMemo(
      () => Array.from(layout.nodes.entries()),
      [layout.nodes],
   );

   const depthById = useMemo(() => {
      const depths = new Map<TopicId, number>();
      for (const [topicId, nodeLayout] of topicNodes) {
         depths.set(topicId, nodeLayout.depth);
      }
      return depths;
   }, [topicNodes]);

   const handleEquationDragMove = useCallback(
      (sourceTopicId: TopicId, clientX: number, clientY: number) => {
         const sourceTopic = sheet.topicsById[sourceTopicId];
         if (!sourceTopic?.equation) return;

         const target = findEquationDropTarget(
            clientX,
            clientY,
            sourceTopicId,
            sheet,
            depthById,
         );

         setEquationDrag({
            sourceTopicId,
            targetTopicId: target?.topicId ?? null,
            snap: target?.snap ?? 'top',
            clientX,
            clientY,
            equation: sourceTopic.equation,
            canDrop: target?.canDrop ?? false,
            gridVariant: target?.gridVariant ?? 'single',
         });
      },
      [sheet, depthById],
   );

   const handleEquationDragEnd = useCallback(
      (sourceTopicId: TopicId, clientX: number, clientY: number) => {
         const target = findEquationDropTarget(
            clientX,
            clientY,
            sourceTopicId,
            sheet,
            depthById,
         );
         setEquationDrag(null);

         if (!target?.canDrop) return;

         if (target.topicId === sourceTopicId) {
            onEquationPlacementChange?.(sourceTopicId, target.snap);
            return;
         }

         onMoveEquation?.(sourceTopicId, target.topicId, target.snap);
      },
      [sheet, depthById, onEquationPlacementChange, onMoveEquation],
   );

   const collapseHandles = useMemo(() => {
      return topicNodes
         .map(([topicId, nodeLayout]) => {
            const topic = sheet.topicsById[topicId];
            if (!topic || topic.childrenIds.length === 0 || nodeLayout.depth < 1) return null;

            const descendantCount = collectDescendantIds(sheet, topicId).length;
            const childLayouts = topic.childrenIds
               .map((id) => layout.nodes.get(id))
               .filter((child): child is NonNullable<typeof child> => Boolean(child));

            return {
               topicId,
               nodeLayout,
               topic,
               descendantCount,
               childLayouts,
               centerX: collapseHandleCenterX(
                  nodeLayout,
                  childLayouts,
                  topic.childrenIds.length,
               ),
            };
         })
         .filter((item): item is NonNullable<typeof item> => item !== null);
   }, [sheet, topicNodes, layout.nodes]);

   const collapseTopicIds = useMemo(
      () => new Set(collapseHandles.map((item) => item.topicId)),
      [collapseHandles],
   );

   const setCollapseHandleHovered = useCallback((topicId: TopicId, hovered: boolean) => {
      setHoveredCollapseTopicId((current) => {
         if (hovered) return topicId;
         return current === topicId ? null : current;
      });
   }, []);

   const localOffset = {
      x: -layout.bounds.x,
      y: -layout.bounds.y,
   };
   const rootLayout = layout.nodes.get(sheet.rootTopicId);
   const legendStickerIds = useMemo(() => collectSheetStickerIds(sheet), [sheet]);
   const viewportPortalTarget = canvasRef.current?.closest('.viewport') ?? null;

   return (
      <>
         {marqueeScreenRect && viewportPortalTarget instanceof HTMLElement
            ? createPortal(
                 <div
                    className="mindmap-canvas__marquee"
                    style={{
                       left: marqueeScreenRect.x,
                       top: marqueeScreenRect.y,
                       width: marqueeScreenRect.width,
                       height: marqueeScreenRect.height,
                    }}
                 />,
                 viewportPortalTarget,
              )
            : null}
      <div
         ref={canvasRef}
         className="mindmap-canvas"
         style={{
            left: layout.bounds.x,
            top: layout.bounds.y,
            width: layout.bounds.width,
            height: layout.bounds.height,
         }}
      >
         <EdgeLayer
            edges={layout.edges}
            bounds={layout.bounds}
            rootExclusion={rootLayout}
         />
         <BoundaryBackgroundLayer
            sheet={sheet}
            boundaries={sheet.boundaries ?? []}
            nodes={layout.nodes}
            bounds={layout.bounds}
         />
         <SummaryBackgroundLayer
            sheet={sheet}
            summaries={sheet.summaries ?? []}
            nodes={layout.nodes}
            bounds={layout.bounds}
            selectedSummaryId={selectedSummaryId}
         />
         <RelationshipLayer
            relationships={sheet.relationships ?? []}
            nodes={layout.nodes}
            bounds={layout.bounds}
            draft={relationshipDraft}
            selectedRelationshipId={selectedRelationshipId}
            zoom={viewportZoom}
            onSelectRelationship={onSelectRelationship}
            onUpdateRelationship={onUpdateRelationship}
         />
         <div
            className="mindmap-canvas__topics"
            style={{
               transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
            }}
         >
            {topicNodes.map(([topicId, nodeLayout]) => (
               <TopicView
                  key={topicId}
                  topicId={topicId}
                  text={sheet.topicsById[topicId]?.text ?? ''}
                  notes={sheet.topicsById[topicId]?.notes}
                  webLink={sheet.topicsById[topicId]?.webLink}
                  cloudLink={sheet.topicsById[topicId]?.cloudLink}
                  topicLink={sheet.topicsById[topicId]?.topicLink}
                  linkLabel={resolveTopicLinkLabel?.(topicId)}
                  equation={sheet.topicsById[topicId]?.equation}
                  labels={sheet.topicsById[topicId]?.labels ?? []}
                  markers={sheet.topicsById[topicId]?.markers ?? []}
                  layout={nodeLayout}
                  themeId={themeId}
                  selected={highlightedTopicIdSet.has(topicId)}
                  autoFocusEdit={topicId === editTopicId}
                  onAutoFocusEditConsumed={onEditTopicIdConsumed}
                  onEditingChange={(editing) => handleEditingChange(topicId, editing)}
                  onSelect={handleTopicSelect}
                  onTextChange={onTopicTextChange}
                  onLiveTextChange={handleLiveTextChange}
                  onOpenNotes={onOpenNotesPanel}
                  onOpenLabels={onOpenLabelsPanel}
                  onOpenLink={onOpenLink}
                  onFollowTopicLink={onFollowTopicLink}
                  onOpenWebLinkEditor={onOpenWebLinkEditor}
                  onOpenTopicLinkEditor={onOpenTopicLinkEditor}
                  onDeleteNote={onDeleteNote}
                  onDeleteWebLink={onDeleteWebLink}
                  onDeleteCloudLink={onDeleteCloudLink}
                  onDeleteTopicLink={onDeleteTopicLink}
                  onSelectSticker={onSelectSticker}
                  equationSelected={topicId === equationSelectedTopicId}
                  onEquationSelect={onEquationSelect}
                  onEquationDeselect={onEquationDeselect}
                  onOpenEquationEditor={onOpenEquationEditor}
                  onEquationScaleChange={onEquationScaleChange}
                  onLiveEquationScaleChange={handleLiveEquationScaleChange}
                  onEquationDragMove={handleEquationDragMove}
                  onEquationDragEnd={handleEquationDragEnd}
                  equationDragOverlay={
                     equationDrag &&
                        (equationDrag.sourceTopicId === topicId || equationDrag.targetTopicId === topicId)
                        ? equationDrag
                        : null
                  }
                  onDeleteEquation={onDeleteEquation}
                  onDismissTopicPanels={onDismissTopicPanels}
                  onInsertChild={onInsertChild}
                  onInsertSibling={onInsertSibling}
                  showsCollapseHandle={collapseTopicIds.has(topicId)}
                  onCollapseHandleHoverChange={(hovered) =>
                     setCollapseHandleHovered(topicId, hovered)
                  }
               />
            ))}
            {stickerLegendVisible && legendStickerIds.length > 0 ? (
               <StickerLegend
                  markerIds={legendStickerIds}
                  themeId={themeId}
                  position={stickerLegendPosition}
                  labelOverrides={stickerLegendLabels}
                  zoom={viewportZoom}
                  onPositionChange={(position) => onStickerLegendPositionChange?.(position)}
                  onLabelChange={(markerId, label) =>
                     onStickerLegendLabelChange?.(markerId, label)
                  }
               />
            ) : null}
            {collapseHandles.map(
               ({ topicId, nodeLayout, topic, descendantCount, centerX }) => (
                  <CollapseHandle
                     key={`collapse-${topicId}`}
                     topicId={topicId}
                     collapsed={topic.collapsed}
                     descendantCount={descendantCount}
                     visible={hoveredCollapseTopicId === topicId}
                     onHoverChange={(hovered) => setCollapseHandleHovered(topicId, hovered)}
                     side={nodeLayout.side}
                     top={nodeLayout.y}
                     height={nodeLayout.height}
                     centerX={centerX}
                     branchIndex={nodeLayout.branchIndex}
                     themeId={themeId}
                     onToggle={() => onToggleCollapse(topicId)}
                  />
               ),
            )}
         </div>
         <BoundaryInteractionLayer
            sheet={sheet}
            boundaries={sheet.boundaries ?? []}
            nodes={layout.nodes}
            bounds={layout.bounds}
            selectedBoundaryId={selectedBoundaryId}
            zoom={viewportZoom}
            onSelectBoundary={onSelectBoundary}
            onUpdateBoundary={onUpdateBoundary}
            onSelectTopic={onBoundarySelectTopic ?? handleTopicSelect}
         />
         <SummaryInteractionLayer
            sheet={sheet}
            summaries={sheet.summaries ?? []}
            nodes={layout.nodes}
            bounds={layout.bounds}
            selectedSummaryId={selectedSummaryId}
            zoom={viewportZoom}
            onSelectSummary={onSelectSummary}
            onUpdateSummary={onUpdateSummary}
            onUpdateSummaryText={onUpdateSummaryText}
            onSelectTopic={onSummarySelectTopic ?? handleTopicSelect}
         />
      </div>
      </>
   );
}

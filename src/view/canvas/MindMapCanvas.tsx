import { useCallback, useMemo, useRef, useState } from 'react';
import type { Sheet, TopicId, MarkerId, Vec2 } from '@/core/model/types';
import type { TopicLinkKind } from '@/core/model/link';
import { collectSheetStickerIds } from '@/core/model/stickers';
import { collectDescendantIds } from '@/core/commands/tree';
import { layoutSheet } from '@/layout';
import { collapseHandleCenterX } from '@/layout/edges';
import { DEFAULT_MAP_THEME_ID } from '@/layout/theme';
import { EdgeLayer } from '@/view/edge/EdgeLayer';
import { CollapseHandle } from '@/view/topic/CollapseHandle';
import { TopicView } from '@/view/topic/TopicView';
import { StickerLegend } from '@/view/canvas/StickerLegend';
import {
   findEquationDropTarget,
   type EquationDragOverlay,
} from '@/view/topic/equationDropTarget';

interface MindMapCanvasProps {
   sheet: Sheet;
   selectedTopicId: TopicId | null;
   editTopicId?: TopicId | null;
   onEditTopicIdConsumed?: () => void;
   onEditingTopicChange?: (topicId: TopicId | null) => void;
   /** Active map theme id — included so layout (edge colors) recomputes on change. */
   themeId?: string;
   onSelectTopic: (topicId: TopicId) => void;
   onTopicTextChange: (topicId: TopicId, text: string) => void;
   onInsertChildAfterEdit?: (topicId: TopicId, text: string) => void;
   onInsertSiblingAfterEdit?: (topicId: TopicId, text: string) => void;
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
   resolveTopicLinkLabel?: (topicId: TopicId) => string | undefined;
}

export function MindMapCanvas({
   sheet,
   selectedTopicId,
   editTopicId = null,
   onEditTopicIdConsumed,
   onEditingTopicChange,
   themeId = DEFAULT_MAP_THEME_ID,
   onSelectTopic,
   onTopicTextChange,
   onInsertChildAfterEdit,
   onInsertSiblingAfterEdit,
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
   resolveTopicLinkLabel,
}: MindMapCanvasProps) {
   const [liveEdit, setLiveEdit] = useState<{ topicId: TopicId; text: string } | null>(null);
   const [liveEquationScale, setLiveEquationScale] = useState<{
      topicId: TopicId;
      scale: number;
   } | null>(null);
   const [hoveredCollapseTopicId, setHoveredCollapseTopicId] = useState<TopicId | null>(null);
   const [equationDrag, setEquationDrag] = useState<EquationDragOverlay | null>(null);
   const editingTopicRef = useRef<TopicId | null>(null);

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
   return (
      <div
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
                  selected={topicId === selectedTopicId}
                  autoFocusEdit={topicId === editTopicId}
                  onAutoFocusEditConsumed={onEditTopicIdConsumed}
                  onEditingChange={(editing) => handleEditingChange(topicId, editing)}
                  onSelect={onSelectTopic}
                  onTextChange={onTopicTextChange}
                  onInsertChildAfterEdit={onInsertChildAfterEdit}
                  onInsertSiblingAfterEdit={onInsertSiblingAfterEdit}
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
      </div>
   );
}

import { measureLabelsBlock } from '@/core/model/labels';
import type { Sheet, Topic, TopicId } from '@/core/model/types';
import { DEFAULT_MAP_THEME_ID } from './theme';
import { bracketChildGap, bracketEdges, rootEdgePath } from './edges';
import { connectorStrokeColor } from './theme';
import type { Point, RootFanRoute, RootSide } from './edges';
import { getVisibleChildren, measureSheet } from './measure';
import type {
   EdgeLayout,
   LayoutResult,
   NodeLayout,
   NodeMeasurement,
   Rect,
} from './types';

const MAIN_BRANCH_H = 82;
const MAIN_BRANCH_V = 36;
const CHILD_BRANCH_V = 8;

/** Vertical gap between level-1 branches on the same side. */
function level1SideSpacing(
   sheet: Sheet,
   children: Topic[],
   measurements: Map<TopicId, NodeMeasurement>,
   rootHeight: number,
): number {
   if (children.length !== 2) return MAIN_BRANCH_V;

   const blockHeights = children.map((child) =>
      subtreeBlockHeight(sheet, child.id, measurements, 1),
   );
   // XMind-style pair layout: one node clearly above and one clearly below the
   // root center, so the pair clears the central topic vertically.
   return Math.max(MAIN_BRANCH_V, Math.max(...blockHeights), rootHeight * 0.9);
}

function computeDepths(sheet: Sheet): Map<TopicId, number> {
   const depths = new Map<TopicId, number>();
   const root = sheet.topicsById[sheet.rootTopicId];
   if (!root) return depths;

   function walk(topicId: TopicId, depth: number): void {
      depths.set(topicId, depth);
      const topic = sheet.topicsById[topicId];
      if (!topic || topic.collapsed) return;
      for (const childId of topic.childrenIds) {
         walk(childId, depth + 1);
      }
   }

   walk(sheet.rootTopicId, 0);
   for (const floatingId of sheet.floatingTopicIds) {
      if (!depths.has(floatingId)) walk(floatingId, 0);
   }

   return depths;
}

/**
 * Effective side for each level-1 branch. Mirrors the stored Topic.side with
 * one override: a root with exactly two branches never splits them one per
 * side — both go right so the map reads as a single fanned pair.
 */
function effectiveRootSides(sheet: Sheet): Map<TopicId, RootSide> {
   const sides = new Map<TopicId, RootSide>();
   const root = sheet.topicsById[sheet.rootTopicId];
   if (!root) return sides;

   for (const childId of root.childrenIds) {
      const child = sheet.topicsById[childId];
      sides.set(childId, child?.side === 'left' ? 'left' : 'right');
   }

   if (root.childrenIds.length === 2) {
      const values = [...sides.values()];
      if (values[0] !== values[1]) {
         for (const id of sides.keys()) sides.set(id, 'right');
      }
   }

   return sides;
}

/**
 * Branch palette indices are positional: right-side branches first (top to
 * insertion order), then left-side ones. This keeps every branch color
 * unique within a side (and across sides while the palette lasts); colors
 * may shift when branches are added or removed, which is intended.
 */
function computeBranchIndices(sheet: Sheet): Map<TopicId, number> {
   const indices = new Map<TopicId, number>();
   const root = sheet.topicsById[sheet.rootTopicId];
   if (!root) return indices;

   indices.set(sheet.rootTopicId, -1);
   const sides = effectiveRootSides(sheet);

   const ordered = [
      ...root.childrenIds.filter((id) => sides.get(id) !== 'left'),
      ...root.childrenIds.filter((id) => sides.get(id) === 'left'),
   ];

   ordered.forEach((childId, branchIndex) => {
      function walk(topicId: TopicId): void {
         indices.set(topicId, branchIndex);
         const topic = sheet.topicsById[topicId];
         if (!topic || topic.collapsed) return;
         for (const id of topic.childrenIds) walk(id);
      }
      walk(childId);
   });

   return indices;
}

function spacingForDepth(depth: number): { v: number } {
   if (depth <= 1) return { v: MAIN_BRANCH_V };
   return { v: CHILD_BRANCH_V };
}

function subtreeBlockHeight(
   sheet: Sheet,
   topicId: TopicId,
   measurements: Map<TopicId, NodeMeasurement>,
   depth: number,
): number {
   const topic = sheet.topicsById[topicId];
   const measurement = measurements.get(topicId);
   if (!topic || !measurement) return 0;

   const ownHeight =
      measurement.height + measureLabelsBlock(topic.labels ?? [], measurement.width);

   const children = getVisibleChildren(sheet, topic);
   if (children.length === 0) {
      return ownHeight;
   }

   const { v } = spacingForDepth(depth + 1);
   let childrenTotal = 0;
   for (const child of children) {
      childrenTotal += subtreeBlockHeight(sheet, child.id, measurements, depth + 1);
   }
   childrenTotal += (children.length - 1) * v;
   return Math.max(ownHeight, childrenTotal);
}

function assignSides(sheet: Sheet, measurements: Map<TopicId, NodeMeasurement>): void {
   const root = sheet.topicsById[sheet.rootTopicId];
   if (!root) return;

   let leftHeight = 0;
   let rightHeight = 0;

   for (const childId of root.childrenIds) {
      const child = sheet.topicsById[childId];
      if (!child) continue;

      if (child.side === 'left' || child.side === 'right') {
         const height = subtreeBlockHeight(sheet, childId, measurements, 1);
         if (child.side === 'left') leftHeight += height;
         else rightHeight += height;
         continue;
      }

      const height = subtreeBlockHeight(sheet, childId, measurements, 1);
      if (rightHeight <= leftHeight) {
         child.side = 'right';
         rightHeight += height;
      } else {
         child.side = 'left';
         leftHeight += height;
      }
   }
}

function layoutBranch(
   sheet: Sheet,
   topicId: TopicId,
   direction: 'left' | 'right',
   anchorX: number,
   blockTopY: number,
   depth: number,
   branchIndex: number,
   measurements: Map<TopicId, NodeMeasurement>,
   nodes: Map<TopicId, NodeLayout>,
): void {
   const topic = sheet.topicsById[topicId];
   const measurement = measurements.get(topicId);
   if (!topic || !measurement) return;

   const children = getVisibleChildren(sheet, topic);
   const blockHeight = subtreeBlockHeight(sheet, topicId, measurements, depth);
   const { v } = spacingForDepth(depth + 1);
   const h =
      depth === 0 ? MAIN_BRANCH_H : bracketChildGap(depth, children.length);

   if (children.length === 0) {
      const x = direction === 'right' ? anchorX : anchorX - measurement.width;
      const labelsBlock = measureLabelsBlock(topic.labels ?? [], measurement.width);
      const y =
         labelsBlock > 0
            ? blockTopY
            : blockTopY + blockHeight / 2 - measurement.height / 2;

      nodes.set(topicId, {
         x,
         y,
         width: measurement.width,
         height: measurement.height,
         side: direction,
         lines: measurement.lines,
         fontSize: measurement.fontSize,
         lineHeight: measurement.lineHeight,
         depth,
         branchIndex,
      });
      return;
   }

   if (children.length === 1) {
      const child = children[0]!;
      const childBlockHeight = subtreeBlockHeight(sheet, child.id, measurements, depth + 1);
      const blockCenterY = blockTopY + blockHeight / 2;
      const childAnchorX =
         direction === 'right'
            ? anchorX + measurement.width + h
            : anchorX - measurement.width - h;

      layoutBranch(
         sheet,
         child.id,
         direction,
         childAnchorX,
         blockCenterY - childBlockHeight / 2,
         depth + 1,
         branchIndex,
         measurements,
         nodes,
      );

      const x = direction === 'right' ? anchorX : anchorX - measurement.width;
      const y = blockCenterY - measurement.height / 2;

      nodes.set(topicId, {
         x,
         y,
         width: measurement.width,
         height: measurement.height,
         side: direction,
         lines: measurement.lines,
         fontSize: measurement.fontSize,
         lineHeight: measurement.lineHeight,
         depth,
         branchIndex,
      });
      return;
   }

   let childTop = blockTopY;
   for (const child of children) {
      const childBlockHeight = subtreeBlockHeight(sheet, child.id, measurements, depth + 1);
      // Right-growing: anchorX is the parent's left edge.
      // Left-growing: anchorX is the parent's right edge — children go further left.
      const childAnchorX =
         direction === 'right'
            ? anchorX + measurement.width + h
            : anchorX - measurement.width - h;

      layoutBranch(
         sheet,
         child.id,
         direction,
         childAnchorX,
         childTop,
         depth + 1,
         branchIndex,
         measurements,
         nodes,
      );
      childTop += childBlockHeight + v;
   }

   const x = direction === 'right' ? anchorX : anchorX - measurement.width;
   const y = blockTopY + blockHeight / 2 - measurement.height / 2;

   nodes.set(topicId, {
      x,
      y,
      width: measurement.width,
      height: measurement.height,
      side: direction,
      lines: measurement.lines,
      fontSize: measurement.fontSize,
      lineHeight: measurement.lineHeight,
      depth,
      branchIndex,
   });
}

function layoutFloatingTree(
   sheet: Sheet,
   topicId: TopicId,
   measurements: Map<TopicId, NodeMeasurement>,
   nodes: Map<TopicId, NodeLayout>,
   branchIndices: Map<TopicId, number>,
): void {
   const topic = sheet.topicsById[topicId];
   const measurement = measurements.get(topicId);
   if (!topic?.position || !measurement) return;

   const blockHeight = subtreeBlockHeight(sheet, topicId, measurements, 0);
   const branchIndex = branchIndices.get(topicId) ?? 0;

   layoutBranch(
      sheet,
      topicId,
      'right',
      topic.position.x,
      topic.position.y,
      0,
      branchIndex,
      measurements,
      nodes,
   );

   const laidOut = nodes.get(topicId);
   if (!laidOut) return;

   const deltaY = topic.position.y - (laidOut.y + blockHeight / 2 - measurement.height / 2);
   if (deltaY === 0) return;

   function shiftSubtree(id: TopicId): void {
      const node = nodes.get(id);
      if (node) node.y += deltaY;
      const t = sheet.topicsById[id];
      if (!t) return;
      for (const childId of t.childrenIds) shiftSubtree(childId);
   }

   shiftSubtree(topicId);
}

function computeBounds(nodes: Map<TopicId, NodeLayout>): Rect {
   let minX = Infinity;
   let minY = Infinity;
   let maxX = -Infinity;
   let maxY = -Infinity;

   for (const node of nodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
   }

   if (!Number.isFinite(minX)) {
      return { x: 0, y: 0, width: 0, height: 0 };
   }

   const padding = 64;
   return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
   };
}

function buildEdges(
   sheet: Sheet,
   nodes: Map<TopicId, NodeLayout>,
   themeId: string,
): EdgeLayout[] {
   const edges: EdgeLayout[] = [];

   type RootBranchAnchor = { source: Point; route: RootFanRoute };
   type RootAnchorBox = Rect;

   function compactRootAnchorBox(parent: NodeLayout): RootAnchorBox {
      const width = Math.min(parent.width * 0.68, 300);
      const height = parent.height;

      return {
         x: parent.x + parent.width / 2 - width / 2,
         y: parent.y + parent.height / 2 - height / 2,
         width,
         height,
      };
   }

   function lerp(from: number, to: number, t: number): number {
      return from + (to - from) * t;
   }

   function smoothstep(t: number): number {
      const x = Math.max(0, Math.min(1, t));
      return x * x * (3 - 2 * x);
   }

   /**
    * Source anchor for a ranked level-1 connector. Anchors sit on or slightly
    * inside the compact root box -- i.e. underneath the central topic -- so
    * the root exclusion mask hides the curve's start and the visible stroke
    * appears to emerge from under the topic box.
    */
   function rankedRootAnchor(
      rootBox: RootAnchorBox,
      side: RootSide,
      rank: number,
      normalizedRank: number,
   ): Point {
      const cx = rootBox.x + rootBox.width / 2;
      const cy = rootBox.y + rootBox.height / 2;
      const sideSign = side === 'right' ? 1 : -1;
      const sideX = side === 'right' ? rootBox.x + rootBox.width : rootBox.x;

      if (normalizedRank < 0.18) {
         return { x: sideX, y: cy };
      }

      const isUpper = rank < 0;
      const t = smoothstep(normalizedRank);
      const tuck = 6;
      const bundleCenterX = cx + sideSign * Math.min(rootBox.width * 0.16, 72);
      const bundleY = isUpper ? rootBox.y + tuck : rootBox.y + rootBox.height - tuck;

      return {
         x: lerp(sideX, bundleCenterX, t),
         y: lerp(cy, bundleY, t),
      };
   }

   function rootAnchors(
      parent: NodeLayout,
      children: NodeLayout[],
   ): Map<NodeLayout, RootBranchAnchor> {
      const anchors = new Map<NodeLayout, RootBranchAnchor>();
      const rootBox = compactRootAnchorBox(parent);

      for (const side of ['left', 'right'] as const) {
         const group = children
            .filter((child) => child.side === side)
            .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
         const centerIndex = (group.length - 1) / 2;

         group.forEach((child, index) => {
            const rank =
               group.length === 2 ? (index === 0 ? -1 : 1) : index - centerIndex;
            // Pairs use a gentle fan (0.6) rather than the full outermost sweep.
            const normalizedRank =
               group.length === 2
                  ? 0.6
                  : centerIndex === 0
                     ? 0
                     : Math.abs(rank) / centerIndex;
            const isSoloBranch = group.length === 1;
            const route = { side, rank, normalizedRank, isSoloBranch };
            const source = isSoloBranch
               ? {
                  x: side === 'right' ? parent.x + parent.width : parent.x,
                  y: parent.y + parent.height / 2,
               }
               : rankedRootAnchor(rootBox, side, rank, normalizedRank);

            anchors.set(child, { source, route });
         });
      }

      return anchors;
   }

   for (const topic of Object.values(sheet.topicsById)) {
      if (topic.collapsed) continue;

      const parentLayout = nodes.get(topic.id);
      if (!parentLayout) continue;

      const childLayouts = topic.childrenIds
         .map((id) => nodes.get(id))
         .filter((child): child is NodeLayout => Boolean(child));

      if (childLayouts.length === 0) continue;

      if (parentLayout.depth === 0) {
         // Collapsed only hides descendants — level-1 nodes still connect to the root.
         const anchors = rootAnchors(parentLayout, childLayouts);
         for (const childLayout of childLayouts) {
            const childId = topic.childrenIds.find((id) => nodes.get(id) === childLayout);
            const anchor = anchors.get(childLayout);
            const isSoloBranch = anchor?.route?.isSoloBranch ?? false;
            edges.push({
               id: `edge-${topic.id}-${childId ?? `${childLayout.x}-${childLayout.y}`}`,
               path: rootEdgePath(parentLayout, childLayout, anchor?.source, anchor?.route),
               color: connectorStrokeColor(childLayout.branchIndex, themeId),
               strokeWidth: 2,
               fromId: topic.id,
               toId: childId,
               maskExempt: isSoloBranch,
            });
         }
         continue;
      }

      edges.push(
         ...bracketEdges(
            topic.id,
            parentLayout,
            childLayouts,
            childLayouts[0]!.branchIndex,
            themeId,
         ).map((edge) => ({
            ...edge,
            fromId: topic.id,
         })),
      );
   }

   return edges;
}

export function layoutMindmap(
   sheet: Sheet,
   editingTopicId?: TopicId,
   themeId: string = DEFAULT_MAP_THEME_ID,
): LayoutResult {
   const depths = computeDepths(sheet);
   const measurements = measureSheet(sheet, depths, editingTopicId);

   assignSides(sheet, measurements);

   // After side assignment so positional colors match the rendered sides.
   const branchIndices = computeBranchIndices(sheet);

   const nodes = new Map<TopicId, NodeLayout>();
   const root = sheet.topicsById[sheet.rootTopicId];
   const rootMeasurement = measurements.get(sheet.rootTopicId);

   if (!root || !rootMeasurement) {
      return { nodes, edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };
   }

   const sides = effectiveRootSides(sheet);
   const leftChildren: Topic[] = [];
   const rightChildren: Topic[] = [];

   for (const childId of root.childrenIds) {
      const child = sheet.topicsById[childId];
      if (!child) continue;
      if (sides.get(childId) === 'left') leftChildren.push(child);
      else rightChildren.push(child);
   }

   const leftSpacing = level1SideSpacing(sheet, leftChildren, measurements, rootMeasurement.height);
   const rightSpacing = level1SideSpacing(sheet, rightChildren, measurements, rootMeasurement.height);

   const leftHeight =
      leftChildren.reduce(
         (sum, child) => sum + subtreeBlockHeight(sheet, child.id, measurements, 1),
         0,
      ) + Math.max(0, leftChildren.length - 1) * leftSpacing;

   const rightHeight =
      rightChildren.reduce(
         (sum, child) => sum + subtreeBlockHeight(sheet, child.id, measurements, 1),
         0,
      ) + Math.max(0, rightChildren.length - 1) * rightSpacing;

   const maxSideHeight = Math.max(leftHeight, rightHeight, rootMeasurement.height);
   const rootX = -rootMeasurement.width / 2;
   const rootY = maxSideHeight / 2 - rootMeasurement.height / 2;

   nodes.set(sheet.rootTopicId, {
      x: rootX,
      y: rootY,
      width: rootMeasurement.width,
      height: rootMeasurement.height,
      side: 'center',
      lines: rootMeasurement.lines,
      fontSize: rootMeasurement.fontSize,
      lineHeight: rootMeasurement.lineHeight,
      depth: 0,
      branchIndex: -1,
   });

   const rightAnchorX = rootX + rootMeasurement.width + MAIN_BRANCH_H;
   let rightTop = rootY + rootMeasurement.height / 2 - rightHeight / 2;

   for (const child of rightChildren) {
      const childBlockHeight = subtreeBlockHeight(sheet, child.id, measurements, 1);
      const branchIndex = branchIndices.get(child.id) ?? 0;
      layoutBranch(
         sheet,
         child.id,
         'right',
         rightAnchorX,
         rightTop,
         1,
         branchIndex,
         measurements,
         nodes,
      );
      rightTop += childBlockHeight + rightSpacing;
   }

   const leftAnchorX = rootX - MAIN_BRANCH_H;
   let leftTop = rootY + rootMeasurement.height / 2 - leftHeight / 2;

   for (const child of leftChildren) {
      const childBlockHeight = subtreeBlockHeight(sheet, child.id, measurements, 1);
      const branchIndex = branchIndices.get(child.id) ?? 0;
      layoutBranch(
         sheet,
         child.id,
         'left',
         leftAnchorX,
         leftTop,
         1,
         branchIndex,
         measurements,
         nodes,
      );
      leftTop += childBlockHeight + leftSpacing;
   }

   for (const floatingId of sheet.floatingTopicIds) {
      layoutFloatingTree(sheet, floatingId, measurements, nodes, branchIndices);
   }

   const edges = buildEdges(sheet, nodes, themeId);
   const bounds = computeBounds(nodes);

   return { nodes, edges, bounds };
}

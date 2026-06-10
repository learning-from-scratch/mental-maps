import type { Sheet, Topic, TopicId } from '@/core/model/types';
import { bracketEdges, branchColor, edgePath, rootEdgePath } from './edges';
import type { Point, RootFanRoute, RootSide } from './edges';
import { getVisibleChildren, measureSheet } from './measure';
import { branchThemeIndexForColor } from './theme';
import type {
  EdgeLayout,
  LayoutResult,
  NodeLayout,
  NodeMeasurement,
  Rect,
} from './types';

const MAIN_BRANCH_H = 82;
const CHILD_BRANCH_H = 54;
const MAIN_BRANCH_V = 54;
const CHILD_BRANCH_V = 10;

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

function computeBranchIndices(sheet: Sheet): Map<TopicId, number> {
  const indices = new Map<TopicId, number>();
  const root = sheet.topicsById[sheet.rootTopicId];
  if (!root) return indices;

  indices.set(sheet.rootTopicId, -1);

  root.childrenIds.forEach((childId, index) => {
    function walk(topicId: TopicId): void {
      const rootChild = sheet.topicsById[childId];
      const stableIndex = branchThemeIndexForColor(rootChild?.style?.branchColor) ?? index;

      indices.set(topicId, stableIndex);
      const topic = sheet.topicsById[topicId];
      if (!topic || topic.collapsed) return;
      for (const id of topic.childrenIds) walk(id);
    }
    walk(childId);
  });

  return indices;
}

function spacingForDepth(depth: number): { h: number; v: number } {
  if (depth <= 1) return { h: MAIN_BRANCH_H, v: MAIN_BRANCH_V };
  return { h: CHILD_BRANCH_H, v: CHILD_BRANCH_V };
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

  const children = getVisibleChildren(sheet, topic);
  if (children.length === 0) return measurement.height;

  const { v } = spacingForDepth(depth + 1);
  let total = 0;
  for (const child of children) {
    total += subtreeBlockHeight(sheet, child.id, measurements, depth + 1);
  }
  total += (children.length - 1) * v;
  return total;
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
  const { h, v } = spacingForDepth(depth + 1);

  if (children.length === 0) {
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

  function fanStrength(branchCount: number): number {
    if (branchCount <= 3) return 0.42;
    if (branchCount === 4) return 0.58;
    if (branchCount === 5) return 0.76;
    return 1;
  }

  function branchSide(rootBox: RootAnchorBox, child: NodeLayout): RootSide {
    const parentCenterX = rootBox.x + rootBox.width / 2;
    const childCenterX = child.x + child.width / 2;
    return childCenterX < parentCenterX ? 'left' : 'right';
  }

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
    const bundleCenterX = cx + sideSign * Math.min(rootBox.width * 0.16, 72);
    const bundleY = isUpper ? rootBox.y : rootBox.y + rootBox.height;

    return {
      x: lerp(sideX, bundleCenterX, t),
      y: lerp(cy, bundleY, t),
    };
  }

  function pushAnchorOutsideRootBox(
    anchor: Point,
    rootBox: RootAnchorBox,
  ): Point {
    const clearance = 18;
    const cx = rootBox.x + rootBox.width / 2;
    const cy = rootBox.y + rootBox.height / 2;
    const dx = anchor.x - cx;
    const dy = anchor.y - cy;
    const halfW = rootBox.width / 2;
    const halfH = rootBox.height / 2;
    const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
    const edge = {
      x: cx + dx * scale,
      y: cy + dy * scale,
    };
    const length = Math.hypot(dx, dy) || 1;

    return {
      x: edge.x + (dx / length) * clearance,
      y: edge.y + (dy / length) * clearance,
    };
  }

  function rootAnchors(parent: NodeLayout, children: NodeLayout[]): Map<NodeLayout, RootBranchAnchor> {
    const anchors = new Map<NodeLayout, RootBranchAnchor>();
    const rootBox = compactRootAnchorBox(parent);

    for (const side of ['left', 'right'] as const) {
      const group = children
        .filter((child) => branchSide(rootBox, child) === side)
        .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
      const centerIndex = (group.length - 1) / 2;
      const strength = fanStrength(group.length);

      group.forEach((child, index) => {
        const rank = index - centerIndex;
        const normalizedRank =
          centerIndex === 0 ? 0 : (Math.abs(rank) / centerIndex) * strength;
        const route = { side, rank, normalizedRank, strength };
        const rawAnchor = rankedRootAnchor(rootBox, side, rank, normalizedRank);
        anchors.set(child, {
          source: pushAnchorOutsideRootBox(rawAnchor, rootBox),
          route,
        });
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
      const anchors = rootAnchors(parentLayout, childLayouts);
      for (const childLayout of childLayouts) {
        const childId = topic.childrenIds.find((id) => nodes.get(id) === childLayout);
        const anchor = anchors.get(childLayout);
        edges.push({
          id: `edge-${topic.id}-${childId ?? `${childLayout.x}-${childLayout.y}`}`,
          path: rootEdgePath(parentLayout, childLayout, anchor?.source, anchor?.route),
          color: branchColor(childLayout.branchIndex),
          strokeWidth: 2,
          fromId: topic.id,
          toId: childId,
        });
      }
      continue;
    }

    if (parentLayout.depth === 1) {
      edges.push(
        ...bracketEdges(topic.id, parentLayout, childLayouts, childLayouts[0]!.branchIndex).map(
          (edge) => ({
            ...edge,
            fromId: topic.id,
          }),
        ),
      );
      continue;
    }

    for (const childLayout of childLayouts) {
      const childId = topic.childrenIds.find((id) => nodes.get(id) === childLayout);
      edges.push({
        id: `edge-${topic.id}-${childId ?? `${childLayout.x}-${childLayout.y}`}`,
        path: edgePath(parentLayout, childLayout),
        color: branchColor(childLayout.branchIndex),
        strokeWidth: 2,
        fromId: topic.id,
        toId: childId,
      });
    }
  }

  return edges;
}

export function layoutMindmap(sheet: Sheet): LayoutResult {
  const depths = computeDepths(sheet);
  const branchIndices = computeBranchIndices(sheet);
  const measurements = measureSheet(sheet, depths);

  assignSides(sheet, measurements);

  const nodes = new Map<TopicId, NodeLayout>();
  const root = sheet.topicsById[sheet.rootTopicId];
  const rootMeasurement = measurements.get(sheet.rootTopicId);

  if (!root || !rootMeasurement) {
    return { nodes, edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }

  const leftChildren: Topic[] = [];
  const rightChildren: Topic[] = [];

  for (const childId of root.childrenIds) {
    const child = sheet.topicsById[childId];
    if (!child) continue;
    if (child.side === 'left') leftChildren.push(child);
    else rightChildren.push(child);
  }

  const leftHeight =
    leftChildren.reduce(
      (sum, child) => sum + subtreeBlockHeight(sheet, child.id, measurements, 1),
      0,
    ) + Math.max(0, leftChildren.length - 1) * MAIN_BRANCH_V;

  const rightHeight =
    rightChildren.reduce(
      (sum, child) => sum + subtreeBlockHeight(sheet, child.id, measurements, 1),
      0,
    ) + Math.max(0, rightChildren.length - 1) * MAIN_BRANCH_V;

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
    rightTop += childBlockHeight + MAIN_BRANCH_V;
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
    leftTop += childBlockHeight + MAIN_BRANCH_V;
  }

  for (const floatingId of sheet.floatingTopicIds) {
    layoutFloatingTree(sheet, floatingId, measurements, nodes, branchIndices);
  }

  const edges = buildEdges(sheet, nodes);
  const bounds = computeBounds(nodes);

  return { nodes, edges, bounds };
}

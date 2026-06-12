import type { NodeLayout } from './types';
import { connectorStrokeColor, DEFAULT_MAP_THEME_ID, getBranchTheme } from './theme';

const BEZIER_CONTROL_RATIO = 0.45;
/** Distance from parent outer edge to the far side of the collapse handle. */
const COLLAPSE_HANDLE_OUTSET = 28;
/** Gap between the collapse handle and the vertical bracket trunk. */
const TRUNK_AFTER_HANDLE = 14;
/** Single-child branches skip the vertical trunk — only a short gap after the handle. */
const SOLO_CHILD_TRUNK_GAP = 2;
/** Corner radius where the trunk turns into each horizontal child branch. */
const BRACKET_CORNER_RADIUS = 12;
const NESTED_BRACKET_CORNER_RADIUS = 8;
/** Horizontal run from the trunk to each child node inner edge. */
export const BRACKET_STUB_LENGTH = 8;
/** Bracket connectors (level-1 onward) are shorter than the legacy full spacing. */
const BRACKET_CONNECTOR_SCALE = 0.75;

function bracketMetrics(
   parentDepth: number,
   childCount?: number,
): {
   trunkOutset: number;
   stubLength: number;
   cornerRadius: number;
} {
   const baseTrunkOutset =
      childCount === 1
         ? COLLAPSE_HANDLE_OUTSET + SOLO_CHILD_TRUNK_GAP
         : COLLAPSE_HANDLE_OUTSET + TRUNK_AFTER_HANDLE;
   const trunkOutset = Math.round(baseTrunkOutset * BRACKET_CONNECTOR_SCALE);
   const stubLength = Math.round(BRACKET_STUB_LENGTH * BRACKET_CONNECTOR_SCALE);

   return {
      trunkOutset,
      stubLength,
      cornerRadius: parentDepth <= 1 ? BRACKET_CORNER_RADIUS : NESTED_BRACKET_CORNER_RADIUS,
   };
}

/** Horizontal gap from parent outer edge to child inner edge for bracket parents. */
export function bracketChildGap(parentDepth: number, childCount?: number): number {
   const { trunkOutset, stubLength } = bracketMetrics(parentDepth, childCount);
   return trunkOutset + stubLength;
}

/** X coordinate for the center of a collapse handle on a bracket connector. */
export function collapseHandleCenterX(
   parent: NodeLayout,
   children: NodeLayout[],
   childCount: number,
): number {
   const onLeft =
      children.length > 0
         ? childIsOnLeft(parent, children[0]!)
         : parent.side === 'left';
   const parentEdgeX = onLeft ? parent.x : parent.x + parent.width;
   const { trunkOutset, stubLength } = bracketMetrics(parent.depth, childCount);
   const gap = trunkOutset + stubLength;

   if (childCount === 1) {
      if (children.length === 1) {
         const childEdgeX = onLeft ? children[0]!.x + children[0]!.width : children[0]!.x;
         return (parentEdgeX + childEdgeX) / 2;
      }
      return onLeft ? parentEdgeX - gap / 2 : parentEdgeX + gap / 2;
   }

   const trunkX = onLeft ? parentEdgeX - trunkOutset : parentEdgeX + trunkOutset;
   return (parentEdgeX + trunkX) / 2;
}

type BracketEdge = { id: string; path: string; color: string; strokeWidth?: number };
export type Point = { x: number; y: number };
export type RootSide = 'left' | 'right';
export interface RootFanRoute {
   side: RootSide;
   /** Signed rank within the side group: negative above center, positive below. */
   rank: number;
   /** 0 = middle of the side group, 1 = outermost branch. */
   normalizedRank: number;
   /** Single branch on this side — route outside the root exclusion mask. */
   isSoloBranch?: boolean;
}

/** Must match EdgeLayer root mask padding. */
export const ROOT_MASK_PADDING = 8;
/** Must match EdgeLayer root mask corner radius. */
export const ROOT_MASK_RADIUS = 12;
/** Start solo root connectors outside the padded, rounded exclusion mask. */
export const SOLO_ROOT_OUTSET =
   ROOT_MASK_PADDING + ROOT_MASK_RADIUS + 4;

function lerp(from: number, to: number, t: number): number {
   return from + (to - from) * t;
}

/** Determine which horizontal side of a node faces its counterpart. */
function childIsOnLeft(parent: NodeLayout, child: NodeLayout): boolean {
   const parentCenterX = parent.x + parent.width / 2;
   const childCenterX = child.x + child.width / 2;
   return childCenterX < parentCenterX;
}

function connectionAnchors(parent: NodeLayout, child: NodeLayout) {
   const onLeft = childIsOnLeft(parent, child);
   const parentMidY = parent.y + parent.height / 2;
   const childMidY = child.y + child.height / 2;

   return {
      onLeft,
      parentAnchor: {
         x: onLeft ? parent.x : parent.x + parent.width,
         y: parentMidY,
      },
      childAnchor: {
         x: onLeft ? child.x + child.width : child.x,
         y: childMidY,
      },
   };
}

export function edgePath(parent: NodeLayout, child: NodeLayout): string {
   const { onLeft, parentAnchor, childAnchor } = connectionAnchors(parent, child);

   const gap = Math.abs(childAnchor.x - parentAnchor.x);
   const controlOffset = Math.max(gap * BEZIER_CONTROL_RATIO, 12);

   const cp1 = {
      x: onLeft ? parentAnchor.x - controlOffset : parentAnchor.x + controlOffset,
      y: parentAnchor.y,
   };
   const cp2 = {
      x: onLeft ? childAnchor.x + controlOffset : childAnchor.x - controlOffset,
      y: childAnchor.y,
   };

   return `M ${parentAnchor.x} ${parentAnchor.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${childAnchor.x} ${childAnchor.y}`;
}

/**
 * Rank-based fan routing for root -> level-1 connectors.
 *
 * The source point is expected to sit under the central topic box (hidden by
 * the root exclusion mask). `normalizedRank` controls how outer the curve is:
 * 0 produces a short, mostly horizontal connector while 1 produces the large
 * sweeping outermost arc that appears to continue underneath the root box.
 */
function rankedLevelOnePath(
   source: Point,
   target: Point,
   side: RootSide,
   signedRank: number,
   normalizedRank: number,
): string {
   const sideSign = side === 'right' ? 1 : -1;

   const isUpper = signedRank < 0;
   const isLower = signedRank > 0;

   const dx = Math.abs(target.x - source.x);
   const dy = Math.abs(target.y - source.y);

   // Clamp the sweep against the actual vertical gap so shallow fans (few
   // branches or compact layouts) never overshoot past their target row.
   const sweep = Math.min(lerp(35, 260, normalizedRank), dy * 0.9);
   const tangentX = lerp(28, 90, normalizedRank);

   let cp1: Point;

   if (isUpper) {
      cp1 = {
         x: source.x + sideSign * tangentX,
         y: source.y - sweep,
      };
   } else if (isLower) {
      cp1 = {
         x: source.x + sideSign * tangentX,
         y: source.y + sweep,
      };
   } else {
      cp1 = {
         x: source.x + sideSign * Math.min(140, dx * 0.32),
         y: source.y,
      };
   }

   const cp2 = {
      x: target.x - sideSign * Math.min(320, dx * 0.68),
      y: target.y,
   };

   return `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${target.x} ${target.y}`;
}

/**
 * Straight connector for the lone branch on one side of the root. Starts just
 * outside the root exclusion mask so the full line stays visible.
 */
function soloRootEdgePath(
   parent: NodeLayout,
   child: NodeLayout,
   side: RootSide,
): string {
   const { childAnchor } = connectionAnchors(parent, child);
   const midY = parent.y + parent.height / 2;
   const outset = SOLO_ROOT_OUTSET;

   const source: Point = {
      x: side === 'right' ? parent.x + parent.width + outset : parent.x - outset,
      y: midY,
   };

   return `M ${source.x} ${source.y} L ${childAnchor.x} ${childAnchor.y}`;
}

/**
 * XMind-style root connector. Uses ranked fan source anchors tucked under the
 * central topic box so the visible curve appears to emerge from beneath it.
 */
export function rootEdgePath(
   parent: NodeLayout,
   child: NodeLayout,
   sourceAnchor?: Point,
   route?: RootFanRoute,
): string {
   const { parentAnchor, childAnchor } = connectionAnchors(parent, child);
   const side: RootSide =
      route?.side ?? (childAnchor.x < parentAnchor.x ? 'left' : 'right');

   if (route?.isSoloBranch) {
      return soloRootEdgePath(parent, child, side);
   }

   const source: Point = sourceAnchor ?? {
      x: side === 'right' ? parent.x + parent.width : parent.x,
      y: parent.y + parent.height / 2,
   };

   if (!route && Math.abs(source.y - childAnchor.y) < 3) {
      return `M ${source.x} ${source.y} L ${childAnchor.x} ${childAnchor.y}`;
   }

   return rankedLevelOnePath(
      source,
      childAnchor,
      side,
      route?.rank ?? 0,
      route?.normalizedRank ?? 0,
   );
}

export function branchColor(
   branchIndex: number,
   themeId: string = DEFAULT_MAP_THEME_ID,
): string {
   return getBranchTheme(branchIndex, themeId).color;
}

function bracketFilletRadius(
   childY: number,
   parentMidY: number,
   trunkX: number,
   childEdgeX: number,
   cornerRadius: number,
): number {
   if (Math.abs(childY - parentMidY) < 1) return 0;

   const gap = Math.abs(childEdgeX - trunkX);
   return Math.min(cornerRadius, gap / 2, Math.abs(childY - parentMidY) / 2);
}

/**
 * Vertical trunk span: inset at the outermost branches so the trunk meets the
 * fillet curves instead of sticking past them.
 */
function trunkSpan(
   childMidYs: number[],
   parentMidY: number,
   trunkX: number,
   childEdgeX: (index: number) => number,
   cornerRadius: number,
): { startY: number; endY: number } | null {
   let startY = parentMidY;
   let endY = parentMidY;

   childMidYs.forEach((childY, index) => {
      const radius = bracketFilletRadius(
         childY,
         parentMidY,
         trunkX,
         childEdgeX(index),
         cornerRadius,
      );
      if (radius <= 0.5) return;

      if (childY < parentMidY - 1) {
         startY = Math.min(startY, childY + radius);
      } else if (childY > parentMidY + 1) {
         endY = Math.max(endY, childY - radius);
      }
   });

   if (endY - startY < 0.5) return null;
   return { startY, endY };
}

/**
 * Horizontal branch from the trunk to a child. Uses a quadratic fillet at the
 * trunk junction (reference style) except for the middle child, which gets a
 * straight continuation of the stem.
 */
function trunkBranchPath(
   trunkX: number,
   childY: number,
   parentMidY: number,
   childEdgeX: number,
   onLeft: boolean,
   cornerRadius: number,
): string {
   const horizontalDir = onLeft ? -1 : 1;

   if (Math.abs(childY - parentMidY) < 1) {
      return `M ${trunkX} ${childY} H ${childEdgeX}`;
   }

   const radius = bracketFilletRadius(
      childY,
      parentMidY,
      trunkX,
      childEdgeX,
      cornerRadius,
   );

   if (radius <= 0.5) {
      return `M ${trunkX} ${childY} H ${childEdgeX}`;
   }

   const vertDir = childY < parentMidY ? -1 : 1;
   const beforeCornerY = childY - vertDir * radius;
   const afterCornerX = trunkX + horizontalDir * radius;

   return (
      `M ${trunkX} ${beforeCornerY} ` +
      `Q ${trunkX} ${childY}, ${afterCornerX} ${childY} ` +
      `H ${childEdgeX}`
   );
}

function bracketGeometry(parent: NodeLayout, children: NodeLayout[]) {
   const { trunkOutset, cornerRadius } = bracketMetrics(parent.depth, children.length);
   const onLeft = childIsOnLeft(parent, children[0]!);
   const parentMidY = parent.y + parent.height / 2;
   const parentEdgeX = onLeft ? parent.x : parent.x + parent.width;
   const trunkX = onLeft
      ? parentEdgeX - trunkOutset
      : parentEdgeX + trunkOutset;

   const childEdgeX = (child: NodeLayout) =>
      onLeft ? child.x + child.width : child.x;

   const sorted = [...children].sort(
      (a, b) => a.y + a.height / 2 - (b.y + b.height / 2),
   );

   const childMidYs = sorted.map((child) => child.y + child.height / 2);

   return {
      onLeft,
      parentMidY,
      parentEdgeX,
      trunkX,
      childEdgeX,
      sorted,
      childMidYs,
      cornerRadius,
   };
}

export function bracketEdges(
   parentId: string,
   parent: NodeLayout,
   children: NodeLayout[],
   branchIndex: number,
   themeId: string = DEFAULT_MAP_THEME_ID,
): BracketEdge[] {
   if (children.length === 0) return [];

   const color = connectorStrokeColor(branchIndex, themeId);
   const strokeWidth = 2;
   const {
      onLeft,
      parentMidY,
      parentEdgeX,
      trunkX,
      childEdgeX,
      sorted,
      childMidYs,
      cornerRadius,
   } = bracketGeometry(parent, children);

   if (children.length === 1) {
      const child = sorted[0]!;
      return [
         {
            id: `bracket-${parentId}-solo`,
            path: `M ${parentEdgeX} ${parentMidY} H ${childEdgeX(child)}`,
            color,
            strokeWidth,
         },
      ];
   }

   const edges: BracketEdge[] = [
      {
         id: `bracket-${parentId}-stem`,
         path: `M ${parentEdgeX} ${parentMidY} H ${trunkX}`,
         color,
         strokeWidth,
      },
   ];

   if (children.length > 1) {
      const span = trunkSpan(
         childMidYs,
         parentMidY,
         trunkX,
         (index) => childEdgeX(sorted[index]!),
         cornerRadius,
      );
      if (span) {
         edges.push({
            id: `bracket-${parentId}-trunk`,
            path: `M ${trunkX} ${span.startY} V ${span.endY}`,
            color,
            strokeWidth,
         });
      }
   }

   sorted.forEach((child, index) => {
      const childMidY = childMidYs[index]!;
      edges.push({
         id: `bracket-${parentId}-${child.x}-${child.y}`,
         path: trunkBranchPath(
            trunkX,
            childMidY,
            parentMidY,
            childEdgeX(child),
            onLeft,
            cornerRadius,
         ),
         color,
         strokeWidth,
      });
   });

   return edges;
}

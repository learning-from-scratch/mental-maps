import type { NodeLayout } from './types';
import { getBranchTheme } from './theme';

const BEZIER_CONTROL_RATIO = 0.45;
/** Distance from parent outer edge to the far side of the collapse handle. */
const COLLAPSE_HANDLE_OUTSET = 28;
/** Gap between the collapse handle and the vertical bracket trunk. */
const TRUNK_AFTER_HANDLE = 14;
const BRACKET_CORNER_RADIUS = 10;

type BracketEdge = { id: string; path: string; color: string; strokeWidth?: number };
export type Point = { x: number; y: number };
export type RootPort =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right';
export type RootSide = 'left' | 'right';
export interface RootFanRoute {
  side: RootSide;
  rank: number;
  normalizedRank: number;
  strength: number;
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
 * XMind-style root connector. Uses ordered source anchors on the central
 * topic boundary so root links never originate inside the title box.
 */
export function rootEdgePath(
  parent: NodeLayout,
  child: NodeLayout,
  sourceAnchor?: Point,
  route?: RootPort | RootFanRoute,
): string {
  const { parentAnchor, childAnchor } = connectionAnchors(parent, child);
  const routeSide =
    route && typeof route === 'object'
      ? route.side
      : childAnchor.x < parentAnchor.x
        ? 'left'
        : 'right';
  const side = routeSide === 'left' ? -1 : 1;

  if (sourceAnchor) {
    parentAnchor.x = sourceAnchor.x;
    parentAnchor.y = sourceAnchor.y;
  } else {
    parentAnchor.x = side > 0 ? parent.x + parent.width : parent.x;
    parentAnchor.y = parent.y + parent.height / 2;
  }

  const isRankedFan = Boolean(route && typeof route === 'object');
  const fanRoute = isRankedFan ? (route as RootFanRoute) : null;
  const fanRank = fanRoute?.rank ?? 0;
  const normalizedRank = fanRoute?.normalizedRank ?? 0;
  const fanStrength = fanRoute?.strength ?? 1;
  const dy = Math.abs(parentAnchor.y - childAnchor.y);
  if (!isRankedFan && dy < 3) {
    return `M ${parentAnchor.x} ${parentAnchor.y} L ${childAnchor.x} ${childAnchor.y}`;
  }

  const gap = Math.abs(childAnchor.x - parentAnchor.x);
  const isTop = isRankedFan
    ? fanRank < 0
    : route === 'top-left' || route === 'top-right';
  const isBottom = isRankedFan
    ? fanRank > 0
    : route === 'bottom-left' || route === 'bottom-right';
  const verticalPull = isRankedFan
    ? Math.min(320, gap * 0.68)
    : Math.max(100, Math.min(300, gap * 0.62));
  let cp1: Point;

  if (isRankedFan && isTop && fanStrength < 1) {
    cp1 = {
      x: parentAnchor.x + side * Math.min(220, gap * (0.22 + fanStrength * 0.08)),
      y: parentAnchor.y,
    };
  } else if (isRankedFan && isBottom && fanStrength < 1) {
    cp1 = {
      x: parentAnchor.x + side * Math.min(220, gap * (0.22 + fanStrength * 0.08)),
      y: parentAnchor.y,
    };
  } else if (isRankedFan && isTop) {
    const sweep = 40 + (260 - 40) * normalizedRank;
    cp1 = {
      x: parentAnchor.x + side * (30 + (12 - 30) * normalizedRank),
      y: parentAnchor.y - sweep,
    };
  } else if (isRankedFan && isBottom) {
    const sweep = 40 + (260 - 40) * normalizedRank;
    cp1 = {
      x: parentAnchor.x + side * (30 + (12 - 30) * normalizedRank),
      y: parentAnchor.y + sweep,
    };
  } else if (isRankedFan) {
    cp1 = {
      x: parentAnchor.x + side * Math.min(140, gap * 0.32),
      y: parentAnchor.y,
    };
  } else if (isTop) {
    cp1 = {
      x: parentAnchor.x,
      y:
        parentAnchor.y -
        Math.max(100, Math.min(260, Math.abs(childAnchor.y - parentAnchor.y) * 0.45)),
    };
  } else if (isBottom) {
    cp1 = {
      x: parentAnchor.x,
      y:
        parentAnchor.y +
        Math.max(100, Math.min(260, Math.abs(childAnchor.y - parentAnchor.y) * 0.45)),
    };
  } else {
    cp1 = {
      x: parentAnchor.x + side * Math.max(80, Math.min(180, gap * 0.28)),
      y: parentAnchor.y,
    };
  }
  const cp2 = {
    x: childAnchor.x - side * verticalPull,
    y: childAnchor.y,
  };

  return (
    `M ${parentAnchor.x} ${parentAnchor.y} ` +
    `C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${childAnchor.x} ${childAnchor.y}`
  );
}

export function branchColor(branchIndex: number): string {
  return getBranchTheme(branchIndex).color;
}

function roundedBracketPath(
  trunkX: number,
  fromY: number,
  toY: number,
  childEdgeX: number,
  onLeft: boolean,
): string {
  const horizontalDir = onLeft ? -1 : 1;
  const verticalDir = toY >= fromY ? 1 : -1;
  const radius = Math.min(
    BRACKET_CORNER_RADIUS,
    Math.abs(toY - fromY) / 2,
    Math.abs(childEdgeX - trunkX) / 2,
  );

  if (radius <= 0.5) {
    return `M ${trunkX} ${fromY} V ${toY} H ${childEdgeX}`;
  }

  const beforeCornerY = toY - verticalDir * radius;
  const afterCornerX = trunkX + horizontalDir * radius;

  return (
    `M ${trunkX} ${fromY} ` +
    `V ${beforeCornerY} ` +
    `Q ${trunkX} ${toY}, ${afterCornerX} ${toY} ` +
    `H ${childEdgeX}`
  );
}

function bracketGeometry(parent: NodeLayout, children: NodeLayout[]) {
  const onLeft = childIsOnLeft(parent, children[0]!);
  const parentMidY = parent.y + parent.height / 2;
  const parentEdgeX = onLeft ? parent.x : parent.x + parent.width;
  const trunkX = onLeft
    ? parentEdgeX - COLLAPSE_HANDLE_OUTSET - TRUNK_AFTER_HANDLE
    : parentEdgeX + COLLAPSE_HANDLE_OUTSET + TRUNK_AFTER_HANDLE;

  const childEdgeX = (child: NodeLayout) =>
    onLeft ? child.x + child.width : child.x;

  const sorted = [...children].sort(
    (a, b) => a.y + a.height / 2 - (b.y + b.height / 2),
  );

  const childMidYs = sorted.map((child) => child.y + child.height / 2);

  return { onLeft, parentMidY, parentEdgeX, trunkX, childEdgeX, sorted, childMidYs };
}

export function bracketEdges(
  parentId: string,
  parent: NodeLayout,
  children: NodeLayout[],
  branchIndex: number,
): BracketEdge[] {
  if (children.length === 0) return [];

  const color = branchColor(branchIndex);
  const strokeWidth = 2;
  const { onLeft, parentMidY, parentEdgeX, trunkX, childEdgeX, sorted, childMidYs } =
    bracketGeometry(parent, children);

  if (children.length === 1) {
    const child = sorted[0]!;
    const childMidY = childMidYs[0]!;
    return [
      {
        id: `bracket-${parentId}`,
        path:
          `M ${parentEdgeX} ${parentMidY} H ${trunkX} ` +
          roundedBracketPath(trunkX, parentMidY, childMidY, childEdgeX(child), onLeft)
            .replace(`M ${trunkX} ${parentMidY} `, ''),
        color,
        strokeWidth,
      },
    ];
  }

  const trunkStartY = Math.min(parentMidY, ...childMidYs);
  const trunkEndY = Math.max(parentMidY, ...childMidYs);

  const edges: BracketEdge[] = [
    {
      id: `bracket-${parentId}-stem`,
      path: `M ${parentEdgeX} ${parentMidY} H ${trunkX}`,
      color,
      strokeWidth,
    },
    {
      id: `bracket-${parentId}-trunk`,
      path: `M ${trunkX} ${trunkStartY} V ${trunkEndY}`,
      color,
      strokeWidth,
    },
  ];

  sorted.forEach((child, index) => {
    const childMidY = childMidYs[index]!;
    edges.push({
      id: `bracket-${parentId}-${child.x}-${child.y}`,
      path: roundedBracketPath(trunkX, parentMidY, childMidY, childEdgeX(child), onLeft),
      color,
      strokeWidth,
    });
  });

  return edges;
}

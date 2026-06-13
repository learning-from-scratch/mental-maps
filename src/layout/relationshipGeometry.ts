import type { NodeLayout } from './types';
import type { Relationship, RelationshipAnchorSide, Vec2 } from '@/core/model/types';

export type Point = { x: number; y: number };

export interface RelationshipGeometry {
  from: Point;
  to: Point;
  control1: Point;
  control2: Point;
  fromAnchor: Vec2;
  toAnchor: Vec2;
  controlOffsets: [Vec2, Vec2];
}

const DEFAULT_CONTROL_DISTANCE = 48;
const MIN_CURVE_BULGE = 22;
const NODE_INSET = 0.5;
const CURVE_SAMPLE_STEPS = 24;
const MAX_ROUTE_ATTEMPTS = 16;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function anchorToPoint(node: NodeLayout, anchor: Vec2): Point {
  return {
    x: node.x + anchor.x * node.width,
    y: node.y + anchor.y * node.height,
  };
}

export function nodeCenter(node: NodeLayout): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

export function anchorForSide(side: RelationshipAnchorSide): Vec2 {
  switch (side) {
    case 'top':
      return { x: 0.5, y: 0 };
    case 'bottom':
      return { x: 0.5, y: 1 };
    case 'left':
      return { x: 0, y: 0.5 };
    case 'right':
      return { x: 1, y: 0.5 };
    default:
      return { x: 0.5, y: 0 };
  }
}

export function sideFromAnchor(anchor: Vec2): RelationshipAnchorSide {
  const dx = Math.abs(anchor.x - 0.5);
  const dy = Math.abs(anchor.y - 0.5);

  if (dx > dy) {
    return anchor.x < 0.5 ? 'left' : 'right';
  }

  return anchor.y < 0.5 ? 'top' : 'bottom';
}

/** Which side of the node the user is directing toward. */
export function directedNodeSide(node: NodeLayout, point: Point): RelationshipAnchorSide {
  const center = nodeCenter(node);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  if (dx === 0 && dy === 0) {
    return 'top';
  }

  if (Math.abs(dx) * node.height > Math.abs(dy) * node.width) {
    return dx > 0 ? 'right' : 'left';
  }

  return dy > 0 ? 'bottom' : 'top';
}

/** Snap to the directed side, preserving position along that edge. */
export function snapAnchorToDirectedSide(
  node: NodeLayout,
  point: Point,
): { anchor: Vec2; side: RelationshipAnchorSide } {
  const side = directedNodeSide(node, point);
  const projected = projectToNodePerimeter(node, point);

  switch (side) {
    case 'top':
      return { side, anchor: { x: clamp01(projected.x), y: 0 } };
    case 'bottom':
      return { side, anchor: { x: clamp01(projected.x), y: 1 } };
    case 'left':
      return { side, anchor: { x: 0, y: clamp01(projected.y) } };
    case 'right':
      return { side, anchor: { x: 1, y: clamp01(projected.y) } };
  }
}

/** Snap to the center of the edge that best faces `toward`. */
export function bestNodeAnchor(node: NodeLayout, toward: Point): Vec2 {
  const side = directedNodeSide(node, toward);
  return anchorForSide(side);
}

/**
 * Cardinal outward normal for an anchor on a node border.
 * Bottom → (0, 1), top → (0, -1), left → (-1, 0), right → (1, 0).
 */
export function edgeNormalAtAnchor(anchor: Vec2): Vec2 {
  return edgeNormalForSide(sideFromAnchor(anchor));
}

export function edgeNormalForSide(side: RelationshipAnchorSide): Vec2 {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: -1 };
  }
}

/** @deprecated Use edgeNormalAtAnchor. */
export function outwardNormalAtAnchor(anchor: Vec2): Vec2 {
  return edgeNormalAtAnchor(anchor);
}

/** Project a world point to the nearest point on a node's rectangle perimeter (normalized). */
export function projectToNodePerimeter(node: NodeLayout, point: Point): Vec2 {
  const center = nodeCenter(node);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  if (dx === 0 && dy === 0) {
    return { x: 0.5, y: 0 };
  }

  const scaleX = node.width / 2 / Math.max(Math.abs(dx), 1e-6);
  const scaleY = node.height / 2 / Math.max(Math.abs(dy), 1e-6);
  const scale = Math.min(scaleX, scaleY);

  const edgeX = center.x + dx * scale;
  const edgeY = center.y + dy * scale;

  return {
    x: (edgeX - node.x) / node.width,
    y: (edgeY - node.y) / node.height,
  };
}

/** @deprecated Use bestNodeAnchor for automatic snapping. */
export function defaultNodeAnchor(node: NodeLayout, toward: Point): Vec2 {
  return bestNodeAnchor(node, toward);
}

export function controlDistance(from: Point, to: Point, scale = 1): number {
  return Math.max(Math.hypot(to.x - from.x, to.y - from.y) * 0.35, DEFAULT_CONTROL_DISTANCE) * scale;
}

function normalizeVector(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function isParallelToApproach(normal: Vec2, approach: Vec2): boolean {
  const cross = Math.abs(normal.x * approach.y - normal.y * approach.x);
  return cross < 0.15;
}

export function controlOffsetsForAnchors(
  from: Point,
  to: Point,
  fromAnchor: Vec2,
  toAnchor: Vec2,
  scale = 1,
): [Vec2, Vec2] {
  const offset = controlDistance(from, to, scale);
  const fromNormal = edgeNormalAtAnchor(fromAnchor);
  const toNormal = edgeNormalAtAnchor(toAnchor);
  const approach = normalizeVector({ x: to.x - from.x, y: to.y - from.y });
  const perp = routePerpendicular(from, to);
  const bulge = Math.max(MIN_CURVE_BULGE, offset * 0.18);

  const fromOffset = { x: fromNormal.x * offset, y: fromNormal.y * offset };
  const toOffset = { x: toNormal.x * offset, y: toNormal.y * offset };

  if (isParallelToApproach(fromNormal, approach)) {
    fromOffset.x += perp.x * bulge;
    fromOffset.y += perp.y * bulge;
  }

  if (isParallelToApproach(toNormal, approach)) {
    toOffset.x -= perp.x * bulge;
    toOffset.y -= perp.y * bulge;
  }

  return [fromOffset, toOffset];
}

function resolveNodeAnchor(
  node: NodeLayout,
  storedAnchor: Vec2 | undefined,
  storedSide: RelationshipAnchorSide | undefined,
  autoToward: Point,
): { anchor: Vec2; side: RelationshipAnchorSide } {
  if (storedSide) {
    const base = anchorForSide(storedSide);
    if (!storedAnchor) {
      return { anchor: base, side: storedSide };
    }

    switch (storedSide) {
      case 'top':
      case 'bottom':
        return { anchor: { x: clamp01(storedAnchor.x), y: base.y }, side: storedSide };
      case 'left':
      case 'right':
        return { anchor: { x: base.x, y: clamp01(storedAnchor.y) }, side: storedSide };
    }
  }

  const anchor = storedAnchor ?? bestNodeAnchor(node, autoToward);
  return { anchor, side: sideFromAnchor(anchor) };
}

function controlsFromOffsets(
  from: Point,
  to: Point,
  controlOffsets: [Vec2, Vec2],
  routeBias = 0,
  routePerp?: Vec2,
): { control1: Point; control2: Point } {
  let control1 = {
    x: from.x + controlOffsets[0].x,
    y: from.y + controlOffsets[0].y,
  };
  let control2 = {
    x: to.x + controlOffsets[1].x,
    y: to.y + controlOffsets[1].y,
  };

  if (routePerp && routeBias !== 0) {
    control1 = {
      x: control1.x + routePerp.x * routeBias,
      y: control1.y + routePerp.y * routeBias,
    };
    control2 = {
      x: control2.x + routePerp.x * routeBias,
      y: control2.y + routePerp.y * routeBias,
    };
  }

  return { control1, control2 };
}

export function isStrictlyInsideNode(node: NodeLayout, point: Point): boolean {
  return (
    point.x > node.x + NODE_INSET &&
    point.x < node.x + node.width - NODE_INSET &&
    point.y > node.y + NODE_INSET &&
    point.y < node.y + node.height - NODE_INSET
  );
}

export function sampleRelationshipCurve(
  geometry: Pick<RelationshipGeometry, 'from' | 'to' | 'control1' | 'control2'>,
  steps = CURVE_SAMPLE_STEPS,
): Point[] {
  const { from, to, control1, control2 } = geometry;
  const points: Point[] = [];

  for (let index = 1; index < steps; index++) {
    points.push(cubicPoint(from, control1, control2, to, index / steps));
  }

  return points;
}

export function relationshipCurveEntersNodeInterior(
  node: NodeLayout,
  geometry: Pick<RelationshipGeometry, 'from' | 'to' | 'control1' | 'control2'>,
): boolean {
  return sampleRelationshipCurve(geometry).some((point) => isStrictlyInsideNode(node, point));
}

function routePerpendicular(from: Point, to: Point): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function routeDistance(fromNode: NodeLayout, toNode: NodeLayout): number {
  return Math.max(fromNode.width, fromNode.height, toNode.width, toNode.height) * 0.45;
}

function scaleControlOffsets(offsets: [Vec2, Vec2], scale: number): [Vec2, Vec2] {
  return [
    { x: offsets[0].x * scale, y: offsets[0].y * scale },
    { x: offsets[1].x * scale, y: offsets[1].y * scale },
  ];
}

function refineControlsAvoidingNodes(
  from: Point,
  to: Point,
  fromAnchor: Vec2,
  toAnchor: Vec2,
  fromNode: NodeLayout,
  toNode: NodeLayout,
  baseOffsets?: [Vec2, Vec2],
): { control1: Point; control2: Point; controlOffsets: [Vec2, Vec2] } {
  const routePerp = routePerpendicular(from, to);
  const routeStep = routeDistance(fromNode, toNode);

  for (let attempt = 0; attempt < MAX_ROUTE_ATTEMPTS; attempt++) {
    const scale = 1 + attempt * 0.2;
    const routeBias =
      Math.floor(attempt / 4) * routeStep * (attempt % 2 === 0 ? 1 : -1);
    const useExteriorDefaults = baseOffsets == null || attempt >= 4;
    const controlOffsets = useExteriorDefaults
      ? controlOffsetsForAnchors(from, to, fromAnchor, toAnchor, scale)
      : scaleControlOffsets(baseOffsets, scale);
    const { control1, control2 } = controlsFromOffsets(
      from,
      to,
      controlOffsets,
      routeBias,
      routePerp,
    );
    const geometry = { from, to, control1, control2 };

    const avoidsDestination = !relationshipCurveEntersNodeInterior(toNode, geometry);
    const avoidsOrigin = !relationshipCurveEntersNodeInterior(fromNode, geometry);

    if (avoidsDestination && avoidsOrigin) {
      return { control1, control2, controlOffsets };
    }
  }

  const fallbackOffsets = controlOffsetsForAnchors(from, to, fromAnchor, toAnchor, 2.5);
  const { control1, control2 } = controlsFromOffsets(
    from,
    to,
    fallbackOffsets,
    routeStep * 2,
    routePerp,
  );

  return { control1, control2, controlOffsets: fallbackOffsets };
}

function buildRelationshipControls(
  from: Point,
  to: Point,
  fromAnchor: Vec2,
  toAnchor: Vec2,
  fromNode: NodeLayout,
  toNode: NodeLayout,
  baseOffsets?: [Vec2, Vec2],
): { control1: Point; control2: Point; controlOffsets: [Vec2, Vec2] } {
  const initialOffsets =
    baseOffsets ?? controlOffsetsForAnchors(from, to, fromAnchor, toAnchor);
  let { control1, control2 } = controlsFromOffsets(from, to, initialOffsets);

  if (
    relationshipCurveEntersNodeInterior(toNode, { from, to, control1, control2 }) ||
    relationshipCurveEntersNodeInterior(fromNode, { from, to, control1, control2 })
  ) {
    return refineControlsAvoidingNodes(
      from,
      to,
      fromAnchor,
      toAnchor,
      fromNode,
      toNode,
      baseOffsets,
    );
  }

  return { control1, control2, controlOffsets: initialOffsets };
}

export function snapRelationshipAnchors(
  fromNode: NodeLayout,
  toNode: NodeLayout,
): {
  fromAnchor: Vec2;
  toAnchor: Vec2;
  fromSide: RelationshipAnchorSide;
  toSide: RelationshipAnchorSide;
} {
  const fromCenter = nodeCenter(fromNode);
  const toCenter = nodeCenter(toNode);
  const fromSide = directedNodeSide(fromNode, toCenter);
  const toSide = directedNodeSide(toNode, fromCenter);

  return {
    fromAnchor: anchorForSide(fromSide),
    toAnchor: anchorForSide(toSide),
    fromSide,
    toSide,
  };
}

/** Initial anchors and control offsets for a new relationship between two nodes. */
export function initialRelationshipGeometry(
  fromNode: NodeLayout,
  toNode: NodeLayout,
): Pick<RelationshipGeometry, 'fromAnchor' | 'toAnchor' | 'controlOffsets'> & {
  fromSide: RelationshipAnchorSide;
  toSide: RelationshipAnchorSide;
} {
  const { fromAnchor, toAnchor, fromSide, toSide } = snapRelationshipAnchors(fromNode, toNode);
  const from = anchorToPoint(fromNode, fromAnchor);
  const to = anchorToPoint(toNode, toAnchor);
  const controls = buildRelationshipControls(
    from,
    to,
    fromAnchor,
    toAnchor,
    fromNode,
    toNode,
  );

  return {
    fromAnchor,
    toAnchor,
    fromSide,
    toSide,
    controlOffsets: controls.controlOffsets,
  };
}

export function resolveRelationshipGeometry(
  relationship: Relationship,
  fromNode: NodeLayout,
  toNode: NodeLayout,
): RelationshipGeometry {
  const fromResolved = resolveNodeAnchor(
    fromNode,
    relationship.fromAnchor,
    relationship.fromSide,
    nodeCenter(toNode),
  );
  const toResolved = resolveNodeAnchor(
    toNode,
    relationship.toAnchor,
    relationship.toSide,
    nodeCenter(fromNode),
  );
  const fromAnchor = fromResolved.anchor;
  const toAnchor = toResolved.anchor;
  const from = anchorToPoint(fromNode, fromAnchor);
  const to = anchorToPoint(toNode, toAnchor);

  const controls = buildRelationshipControls(
    from,
    to,
    fromAnchor,
    toAnchor,
    fromNode,
    toNode,
    relationship.controlOffsets,
  );

  return {
    from,
    to,
    control1: controls.control1,
    control2: controls.control2,
    fromAnchor,
    toAnchor,
    controlOffsets: controls.controlOffsets,
  };
}

export function relationshipPath(geometry: Pick<RelationshipGeometry, 'from' | 'to' | 'control1' | 'control2'>): string {
  const { from, to, control1, control2 } = geometry;
  return `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`;
}

/** Point on cubic bezier at parameter t (0-1). */
export function cubicPoint(
  from: Point,
  control1: Point,
  control2: Point,
  to: Point,
  t: number,
): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * from.x + 3 * uu * t * control1.x + 3 * u * tt * control2.x + ttt * to.x,
    y: uuu * from.y + 3 * uu * t * control1.y + 3 * u * tt * control2.y + ttt * to.y,
  };
}

export function relationshipMidpoint(geometry: RelationshipGeometry): Point {
  return cubicPoint(geometry.from, geometry.control1, geometry.control2, geometry.to, 0.5);
}

export function tangentAngleAt(
  from: Point,
  control1: Point,
  control2: Point,
  to: Point,
  t: number,
): number {
  const u = 1 - t;
  const dx =
    3 * u * u * (control1.x - from.x) +
    6 * u * t * (control2.x - control1.x) +
    3 * t * t * (to.x - control2.x);
  const dy =
    3 * u * u * (control1.y - from.y) +
    6 * u * t * (control2.y - control1.y) +
    3 * t * t * (to.y - control2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function destinationTangentDirection(geometry: RelationshipGeometry): Vec2 {
  const angle = tangentAngleAt(
    geometry.from,
    geometry.control1,
    geometry.control2,
    geometry.to,
    1,
  );
  const radians = (angle * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function nodeContainsPoint(node: NodeLayout, point: Point): boolean {
  return (
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height
  );
}

export function findNodeAtPoint(
  nodes: Map<string, NodeLayout>,
  point: Point,
  excludeId?: string,
): NodeLayout | null {
  for (const [id, node] of nodes) {
    if (id === excludeId) continue;
    if (nodeContainsPoint(node, point)) return node;
  }
  return null;
}

export function draftRelationshipGeometry(
  fromNode: NodeLayout,
  cursor: Point,
  toNode?: NodeLayout,
): RelationshipGeometry {
  if (toNode) {
    const { anchor: toAnchor, side: toSide } = snapAnchorToDirectedSide(toNode, cursor);
    const to = anchorToPoint(toNode, toAnchor);
    const fromResolved = resolveNodeAnchor(fromNode, undefined, undefined, to);

    return resolveRelationshipGeometry(
      {
        id: 'draft',
        fromId: '',
        toId: '',
        fromAnchor: fromResolved.anchor,
        fromSide: fromResolved.side,
        toAnchor,
        toSide,
      },
      fromNode,
      toNode,
    );
  }

  const fromAnchor = bestNodeAnchor(fromNode, cursor);
  const from = anchorToPoint(fromNode, fromAnchor);
  const fromNormal = edgeNormalAtAnchor(fromAnchor);

  const dx = cursor.x - from.x;
  const dy = cursor.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const approach = { x: dx / distance, y: dy / distance };
  const offset = controlDistance(from, cursor);
  const perp = routePerpendicular(from, cursor);
  const bulge = Math.max(MIN_CURVE_BULGE, offset * 0.18);

  const controlOffsets: [Vec2, Vec2] = [
    { x: fromNormal.x * offset + perp.x * bulge, y: fromNormal.y * offset + perp.y * bulge },
    { x: -approach.x * offset - perp.x * bulge, y: -approach.y * offset - perp.y * bulge },
  ];

  const control1 = {
    x: from.x + controlOffsets[0].x,
    y: from.y + controlOffsets[0].y,
  };
  const control2 = {
    x: cursor.x + controlOffsets[1].x,
    y: cursor.y + controlOffsets[1].y,
  };

  return {
    from,
    to: cursor,
    control1,
    control2,
    fromAnchor,
    toAnchor: { x: 0.5, y: 0.5 },
    controlOffsets,
  };
}

/** Tangent at the destination end should align with the destination border normal. */
export function destinationApproachAngle(geometry: RelationshipGeometry): number {
  return tangentAngleAt(
    geometry.from,
    geometry.control1,
    geometry.control2,
    geometry.to,
    1,
  );
}

/** Geometry to persist when the user confirms a drafted relationship. */
export function confirmRelationshipGeometry(
  fromNode: NodeLayout,
  toNode: NodeLayout,
  cursor: Point,
): Pick<Relationship, 'fromAnchor' | 'toAnchor' | 'fromSide' | 'toSide' | 'controlOffsets'> {
  const effectiveCursor =
    cursor.x === 0 && cursor.y === 0 ? nodeCenter(toNode) : cursor;
  const { anchor: toAnchor, side: toSide } = snapAnchorToDirectedSide(
    toNode,
    effectiveCursor,
  );
  const to = anchorToPoint(toNode, toAnchor);
  const fromResolved = resolveNodeAnchor(fromNode, undefined, undefined, to);
  const geometry = draftRelationshipGeometry(fromNode, effectiveCursor, toNode);

  return {
    fromAnchor: fromResolved.anchor,
    toAnchor,
    fromSide: fromResolved.side,
    toSide,
    controlOffsets: geometry.controlOffsets,
  };
}

/** Recompute controls after the user locks an endpoint to a directed side. */
export function controlsForDirectedAnchor(
  fromNode: NodeLayout,
  toNode: NodeLayout,
  fromAnchor: Vec2,
  toAnchor: Vec2,
  fromSide?: RelationshipAnchorSide,
  toSide?: RelationshipAnchorSide,
): Pick<Relationship, 'fromAnchor' | 'toAnchor' | 'fromSide' | 'toSide' | 'controlOffsets'> {
  const fromResolved = resolveNodeAnchor(fromNode, fromAnchor, fromSide, nodeCenter(toNode));
  const toResolved = resolveNodeAnchor(toNode, toAnchor, toSide, nodeCenter(fromNode));
  const from = anchorToPoint(fromNode, fromResolved.anchor);
  const to = anchorToPoint(toNode, toResolved.anchor);
  const controls = buildRelationshipControls(
    from,
    to,
    fromResolved.anchor,
    toResolved.anchor,
    fromNode,
    toNode,
  );

  return {
    fromAnchor: fromResolved.anchor,
    toAnchor: toResolved.anchor,
    fromSide: fromResolved.side,
    toSide: toResolved.side,
    controlOffsets: controls.controlOffsets,
  };
}

import type { NodeLayout } from './types';
import type { Relationship, Vec2 } from '@/core/model/types';

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

export function anchorToPoint(node: NodeLayout, anchor: Vec2): Point {
  return {
    x: node.x + anchor.x * node.width,
    y: node.y + anchor.y * node.height,
  };
}

/** Project a world point to the nearest point on a node's rectangle perimeter (normalized). */
export function projectToNodePerimeter(node: NodeLayout, point: Point): Vec2 {
  const left = node.x;
  const top = node.y;
  const cx = left + node.width / 2;
  const cy = top + node.height / 2;

  const dx = point.x - cx;
  const dy = point.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: 0.5, y: 0 };
  }

  const scaleX = node.width / 2 / Math.max(Math.abs(dx), 1e-6);
  const scaleY = node.height / 2 / Math.max(Math.abs(dy), 1e-6);
  const scale = Math.min(scaleX, scaleY);

  const edgeX = cx + dx * scale;
  const edgeY = cy + dy * scale;

  return {
    x: (edgeX - left) / node.width,
    y: (edgeY - top) / node.height,
  };
}

export function defaultNodeAnchor(node: NodeLayout, toward: Point): Vec2 {
  return projectToNodePerimeter(node, toward);
}

function defaultControlOffsets(
  from: Point,
  to: Point,
): [Vec2, Vec2] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const offset = Math.max(distance * 0.35, DEFAULT_CONTROL_DISTANCE);
  const signX = dx >= 0 ? 1 : -1;

  return [
    { x: signX * offset, y: dy * 0.15 },
    { x: -signX * offset, y: -dy * 0.15 },
  ];
}

export function resolveRelationshipGeometry(
  relationship: Relationship,
  fromNode: NodeLayout,
  toNode: NodeLayout,
): RelationshipGeometry {
  const fromCenter = {
    x: fromNode.x + fromNode.width / 2,
    y: fromNode.y + fromNode.height / 2,
  };
  const toCenter = {
    x: toNode.x + toNode.width / 2,
    y: toNode.y + toNode.height / 2,
  };

  const fromAnchor =
    relationship.fromAnchor ?? defaultNodeAnchor(fromNode, toCenter);
  const toAnchor = relationship.toAnchor ?? defaultNodeAnchor(toNode, fromCenter);
  const from = anchorToPoint(fromNode, fromAnchor);
  const to = anchorToPoint(toNode, toAnchor);
  const controlOffsets =
    relationship.controlOffsets ?? defaultControlOffsets(from, to);

  const control1 = {
    x: from.x + controlOffsets[0].x,
    y: from.y + controlOffsets[0].y,
  };
  const control2 = {
    x: to.x + controlOffsets[1].x,
    y: to.y + controlOffsets[1].y,
  };

  return {
    from,
    to,
    control1,
    control2,
    fromAnchor,
    toAnchor,
    controlOffsets,
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

export function draftRelationshipGeometry(
  fromNode: NodeLayout,
  cursor: Point,
): RelationshipGeometry {
  const fromAnchor = defaultNodeAnchor(fromNode, cursor);
  const from = anchorToPoint(fromNode, fromAnchor);
  const controlOffsets = defaultControlOffsets(from, cursor);
  const control1 = {
    x: from.x + controlOffsets[0].x,
    y: from.y + controlOffsets[0].y,
  };
  const control2 = {
    x: cursor.x + controlOffsets[1].x * 0.35,
    y: cursor.y + controlOffsets[1].y * 0.35,
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

import type { TopicId } from '@/core/model/types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeMeasurement {
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

export type NodeSide = 'left' | 'right' | 'center';

export interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  side: NodeSide;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  depth: number;
  branchIndex: number;
}

export interface EdgeLayout {
  id: string;
  path: string;
  color: string;
  strokeWidth?: number;
  fromId?: TopicId;
  toId?: TopicId;
  /** Root solo connectors render outside the central-topic exclusion mask. */
  maskExempt?: boolean;
}

export interface LayoutResult {
  nodes: Map<TopicId, NodeLayout>;
  edges: EdgeLayout[];
  bounds: Rect;
}

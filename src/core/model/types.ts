import type { TopicRefLink, UrlLink } from './link';

export type TopicId = string;
export type SheetId = string;
export type MarkerId = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface TopicEquation {
  latex: string;
  scale?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right' | { row: number; col: number };
}

export interface TopicStyle {
  shape?: 'rounded-rect' | 'rect' | 'ellipse' | 'underline' | 'capsule';
  fill?: string;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  branchColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface Topic {
  id: TopicId;
  parentId: TopicId | null;
  childrenIds: TopicId[];
  text: string;
  collapsed: boolean;
  side?: 'left' | 'right';
  position?: Vec2;
  notes?: string;
  webLink?: UrlLink;
  cloudLink?: UrlLink;
  topicLink?: TopicRefLink;
  equation?: TopicEquation;
  labels: string[];
  labelsAutoSort?: boolean;
  markers: MarkerId[];
  style?: TopicStyle;
}

export interface Relationship {
  id: string;
  fromId: TopicId;
  toId: TopicId;
  label?: string;
  style?: { color?: string; lineStyle?: 'dashed' | 'solid' };
  /** Locked attachment side on the origin node. */
  fromSide?: RelationshipAnchorSide;
  /** Locked attachment side on the destination node. */
  toSide?: RelationshipAnchorSide;
  /** Normalized anchor on the from-node bounding box (0-1). */
  fromAnchor?: Vec2;
  /** Normalized anchor on the to-node bounding box (0-1). */
  toAnchor?: Vec2;
  controlOffsets?: [Vec2, Vec2];
}

export type RelationshipAnchorSide = 'top' | 'bottom' | 'left' | 'right';

export interface Boundary {
  id: string;
  parentId: TopicId;
  range: [number, number];
  /** Selected topics that anchor this boundary's visual bounds. */
  topicIds?: TopicId[];
  label?: string;
  paddingTop?: number;
  paddingBottom?: number;
  style?: { fill?: string; stroke?: string };
}

export interface Summary {
  id: string;
  parentId: TopicId;
  range: [number, number];
  summaryTopicId: TopicId;
}

export type ThemeRef = string;

export interface LayoutConfig {
  type: 'mindmap' | 'tree-right' | 'tree-down' | 'fishbone';
  hSpacing: number;
  vSpacing: number;
}

export interface StickerLegendState {
  visible: boolean;
  position: Vec2;
  labelOverrides: Record<MarkerId, string>;
}

export interface Sheet {
  id: SheetId;
  title: string;
  rootTopicId: TopicId;
  floatingTopicIds: TopicId[];
  topicsById: Record<TopicId, Topic>;
  relationships: Relationship[];
  boundaries: Boundary[];
  summaries: Summary[];
  theme: ThemeRef;
  canvasDotsEnabled?: boolean;
  stickerLegend?: StickerLegendState;
  layout: LayoutConfig;
}

export interface MindMapDocument {
  formatVersion: 1;
  id: string;
  title: string;
  createdAt: number;
  modifiedAt: number;
  sheets: SheetId[];
  sheetsById: Record<SheetId, Sheet>;
}

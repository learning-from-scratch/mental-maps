export type TopicId = string;
export type SheetId = string;
export type MarkerId = string;

export interface Vec2 {
  x: number;
  y: number;
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
  link?: { url: string; title?: string };
  labels: string[];
  markers: MarkerId[];
  style?: TopicStyle;
}

export interface Relationship {
  id: string;
  fromId: TopicId;
  toId: TopicId;
  label?: string;
  style?: { color?: string; lineStyle?: 'dashed' | 'solid' };
  controlOffsets?: [Vec2, Vec2];
}

export interface Boundary {
  id: string;
  parentId: TopicId;
  range: [number, number];
  label?: string;
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

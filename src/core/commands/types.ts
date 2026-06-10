import type { MindMapDocument, SheetId, TopicId, TopicStyle } from '../model/types';

export interface CommandContext {
  doc: MindMapDocument;
  sheetId: SheetId;
}

export interface AddChildPayload {
  parentId: TopicId;
  text: string;
  index?: number;
  side?: 'left' | 'right';
}

export interface AddSiblingPayload {
  topicId: TopicId;
  text: string;
}

export interface AddFloatingPayload {
  position: { x: number; y: number };
  text: string;
}

export interface SetTextPayload {
  topicId: TopicId;
  text: string;
}

export interface DeleteTopicsPayload {
  topicIds: TopicId[];
}

export interface DuplicateBranchPayload {
  topicId: TopicId;
}

export interface MoveBranchPayload {
  topicId: TopicId;
  newParentId: TopicId;
  index?: number;
}

export interface ReorderChildPayload {
  topicId: TopicId;
  newIndex: number;
}

export interface ToggleCollapsePayload {
  topicId: TopicId;
}

export interface DetachAsFloatingPayload {
  topicId: TopicId;
  position: { x: number; y: number };
}

export interface AttachFloatingPayload {
  topicId: TopicId;
  parentId: TopicId;
  index?: number;
}

export interface SetStylePayload {
  topicIds: TopicId[];
  patch: Partial<TopicStyle>;
}

export type CommandName =
  | 'addChild'
  | 'addSibling'
  | 'addFloating'
  | 'setText'
  | 'deleteTopics'
  | 'duplicateBranch'
  | 'moveBranch'
  | 'reorderChild'
  | 'toggleCollapse'
  | 'detachAsFloating'
  | 'attachFloating'
  | 'setStyle';

export type CommandPayloadMap = {
  addChild: AddChildPayload;
  addSibling: AddSiblingPayload;
  addFloating: AddFloatingPayload;
  setText: SetTextPayload;
  deleteTopics: DeleteTopicsPayload;
  duplicateBranch: DuplicateBranchPayload;
  moveBranch: MoveBranchPayload;
  reorderChild: ReorderChildPayload;
  toggleCollapse: ToggleCollapsePayload;
  detachAsFloating: DetachAsFloatingPayload;
  attachFloating: AttachFloatingPayload;
  setStyle: SetStylePayload;
};

export type CommandResultMap = {
  addChild: TopicId;
  addSibling: TopicId;
  addFloating: TopicId;
  setText: void;
  deleteTopics: TopicId[];
  duplicateBranch: TopicId;
  moveBranch: void;
  reorderChild: void;
  toggleCollapse: void;
  detachAsFloating: void;
  attachFloating: void;
  setStyle: void;
};

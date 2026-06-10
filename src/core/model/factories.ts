import { nanoid } from 'nanoid';
import type {
  LayoutConfig,
  MindMapDocument,
  Sheet,
  SheetId,
  Topic,
  TopicId,
} from './types';

const DEFAULT_LAYOUT: LayoutConfig = {
  type: 'mindmap',
  hSpacing: 48,
  vSpacing: 16,
};

export function createTopic(
  overrides: Partial<Topic> & Pick<Topic, 'text'> & { id?: TopicId },
): Topic {
  const { id, text, ...rest } = overrides;
  return {
    id: id ?? nanoid(),
    parentId: null,
    childrenIds: [],
    text,
    collapsed: false,
    labels: [],
    markers: [],
    ...rest,
  };
}

export function createSheet(
  overrides: Partial<Sheet> & { title: string; rootText?: string },
): Sheet {
  const root = createTopic({ text: overrides.rootText ?? 'Central Topic' });
  const { title, rootText: _rootText, ...rest } = overrides;

  return {
    id: nanoid(),
    title,
    rootTopicId: root.id,
    floatingTopicIds: [],
    topicsById: { [root.id]: root },
    relationships: [],
    boundaries: [],
    summaries: [],
    theme: 'default',
    layout: DEFAULT_LAYOUT,
    ...rest,
  };
}

export function createDocument(
  overrides: Partial<MindMapDocument> & { title?: string } = {},
): MindMapDocument {
  const sheet = createSheet({ title: 'Sheet 1' });
  const now = Date.now();
  const { title = 'Untitled Map', ...rest } = overrides;

  return {
    formatVersion: 1,
    id: nanoid(),
    title,
    createdAt: now,
    modifiedAt: now,
    sheets: [sheet.id],
    sheetsById: { [sheet.id]: sheet },
    ...rest,
  };
}

export function getSheet(doc: MindMapDocument, sheetId: SheetId): Sheet {
  const sheet = doc.sheetsById[sheetId];
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetId}`);
  }
  return sheet;
}

export function getTopic(sheet: Sheet, topicId: TopicId): Topic {
  const topic = sheet.topicsById[topicId];
  if (!topic) {
    throw new Error(`Topic not found: ${topicId}`);
  }
  return topic;
}

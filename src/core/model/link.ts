import type { SheetId, TopicId } from './types';

export type TopicLinkKind = 'webpage' | 'cloud' | 'topic';

export interface UrlLink {
  url: string;
  title?: string;
}

export interface TopicRefLink {
  targetSheetId: SheetId;
  targetTopicId: TopicId;
  title?: string;
}

/** @deprecated Migrated to webLink, cloudLink, and topicLink on load. */
export interface LegacyTopicLink {
  kind?: TopicLinkKind;
  url?: string;
  title?: string;
  targetSheetId?: SheetId;
  targetTopicId?: TopicId;
}

export function hasUrlLink(link?: UrlLink): boolean {
  return Boolean(link?.url?.trim());
}

export function hasTopicRefLink(link?: TopicRefLink): boolean {
  return Boolean(link?.targetSheetId && link?.targetTopicId);
}

export function topicDisplayText(text: string): string {
  const trimmed = text.trim();
  return trimmed || '<Empty Text>';
}

export function createTopicLinkRef(
  targetSheetId: SheetId,
  targetTopicId: TopicId,
  title?: string,
): TopicRefLink {
  return {
    targetSheetId,
    targetTopicId,
    title,
  };
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function migrateLegacyTopicLink(topic: {
  link?: LegacyTopicLink;
  webLink?: UrlLink;
  cloudLink?: UrlLink;
  topicLink?: TopicRefLink;
}): void {
  if (!topic.link || topic.webLink || topic.cloudLink || topic.topicLink) return;

  const legacy = topic.link;
  if (legacy.kind === 'topic' && legacy.targetSheetId && legacy.targetTopicId) {
    topic.topicLink = {
      targetSheetId: legacy.targetSheetId,
      targetTopicId: legacy.targetTopicId,
      title: legacy.title,
    };
  } else if (legacy.kind === 'cloud' && legacy.url?.trim()) {
    topic.cloudLink = { url: legacy.url, title: legacy.title };
  } else if (legacy.url?.trim()) {
    topic.webLink = { url: legacy.url, title: legacy.title };
  }

  delete topic.link;
}

export function soleLinkKind(attachments: {
  webLink?: UrlLink;
  cloudLink?: UrlLink;
  topicLink?: TopicRefLink;
}): TopicLinkKind | null {
  const kinds: TopicLinkKind[] = [];
  if (hasUrlLink(attachments.webLink)) kinds.push('webpage');
  if (hasUrlLink(attachments.cloudLink)) kinds.push('cloud');
  if (hasTopicRefLink(attachments.topicLink)) kinds.push('topic');
  return kinds.length === 1 ? kinds[0]! : null;
}

export function clearTopicLinksToTargets(
  sheetsById: Record<SheetId, { topicsById: Record<TopicId, { topicLink?: TopicRefLink }> }>,
  targetSheetId: SheetId,
  deletedTopicIds: Iterable<TopicId>,
): void {
  const deleted = new Set(deletedTopicIds);
  if (deleted.size === 0) return;

  for (const sheet of Object.values(sheetsById)) {
    for (const topic of Object.values(sheet.topicsById)) {
      const ref = topic.topicLink;
      if (
        ref?.targetSheetId === targetSheetId &&
        ref.targetTopicId &&
        deleted.has(ref.targetTopicId)
      ) {
        topic.topicLink = undefined;
      }
    }
  }
}

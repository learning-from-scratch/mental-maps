import {
  hasTopicRefLink,
  hasUrlLink,
  type TopicRefLink,
  type UrlLink,
} from '@/core/model/link';
import { topicHasNotes } from '@/core/model/notes';

export type TopicAttachmentIndicator = 'none' | 'notes' | 'link' | 'multiple';

export interface TopicLinkAttachments {
  webLink?: UrlLink;
  cloudLink?: UrlLink;
  topicLink?: TopicRefLink;
}

export function countTopicAttachments(
  notes?: string,
  links?: TopicLinkAttachments,
): number {
  let count = 0;
  if (topicHasNotes(notes)) count += 1;
  if (hasUrlLink(links?.webLink)) count += 1;
  if (hasUrlLink(links?.cloudLink)) count += 1;
  if (hasTopicRefLink(links?.topicLink)) count += 1;
  return count;
}

export function getTopicAttachmentIndicator(
  notes?: string,
  links?: TopicLinkAttachments,
): TopicAttachmentIndicator {
  const count = countTopicAttachments(notes, links);
  if (count === 0) return 'none';
  if (count === 1) return topicHasNotes(notes) ? 'notes' : 'link';
  return 'multiple';
}

export function topicShowsAttachmentAffordance(
  notes?: string,
  links?: TopicLinkAttachments,
): boolean {
  return getTopicAttachmentIndicator(notes, links) !== 'none';
}

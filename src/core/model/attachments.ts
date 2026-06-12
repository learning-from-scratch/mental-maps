import { topicHasLink } from '@/core/model/link';
import { topicHasNotes } from '@/core/model/notes';
import type { TopicLink } from '@/core/model/link';

export type TopicAttachmentIndicator = 'none' | 'notes' | 'link' | 'multiple';

export function getTopicAttachmentIndicator(
  notes?: string,
  link?: TopicLink,
): TopicAttachmentIndicator {
  const hasNotes = topicHasNotes(notes);
  const hasLink = topicHasLink(link);

  if (hasNotes && hasLink) return 'multiple';
  if (hasNotes) return 'notes';
  if (hasLink) return 'link';
  return 'none';
}

export function topicShowsAttachmentAffordance(notes?: string, link?: TopicLink): boolean {
  return getTopicAttachmentIndicator(notes, link) !== 'none';
}

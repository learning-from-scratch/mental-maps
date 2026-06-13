import { nanoid } from 'nanoid';
import type { Relationship, TopicId } from './types';

export const DEFAULT_RELATIONSHIP_LABEL = 'Relationship';

/** True when the user has committed a non-empty label for this relationship. */
export function hasOfficialRelationshipLabel(label: string | undefined): boolean {
  return Boolean(label?.trim());
}

export function createRelationship(fromId: TopicId, toId: TopicId): Relationship {
  return {
    id: nanoid(),
    fromId,
    toId,
    style: { lineStyle: 'dashed', color: '#8f8f94' },
  };
}

export const DEFAULT_RELATIONSHIP_COLOR = '#8f8f94';

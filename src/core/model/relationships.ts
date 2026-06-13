import { nanoid } from 'nanoid';
import type { Relationship, TopicId } from './types';

export function createRelationship(fromId: TopicId, toId: TopicId): Relationship {
  return {
    id: nanoid(),
    fromId,
    toId,
    label: 'Relationship',
    style: { lineStyle: 'dashed', color: '#8f8f94' },
  };
}

export const DEFAULT_RELATIONSHIP_COLOR = '#8f8f94';

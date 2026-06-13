import { describe, expect, it } from 'vitest';
import { createSheet } from './factories';
import { layoutSheet } from '@/layout';
import { normalizeSheet } from './projectFactory';

describe('normalizeSheet', () => {
  it('fills missing legacy array fields so layout and relationships render', () => {
    const sheet = createSheet({ title: 'Legacy' });
    const legacy = {
      ...sheet,
      relationships: undefined,
      boundaries: undefined,
      summaries: undefined,
      floatingTopicIds: undefined,
    } as unknown as typeof sheet;

    const normalized = normalizeSheet(legacy);

    expect(normalized.relationships).toEqual([]);
    expect(normalized.boundaries).toEqual([]);
    expect(normalized.summaries).toEqual([]);
    expect(normalized.floatingTopicIds).toEqual([]);

    expect(() => layoutSheet(normalized)).not.toThrow();
    expect(normalized.relationships.map(() => 1)).toEqual([]);
  });
});

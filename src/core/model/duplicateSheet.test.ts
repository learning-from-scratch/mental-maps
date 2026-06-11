import { describe, expect, it } from 'vitest';
import { createSampleDocument } from '@/demo/sampleDocument';
import { duplicateSheet } from './duplicateSheet';

describe('duplicateSheet', () => {
  it('clones a sheet with new ids', () => {
    const doc = createSampleDocument();
    const source = doc.sheetsById[doc.sheets[0]!]!;
    const copy = duplicateSheet(source);

    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toBe(`${source.title} copy`);
    expect(copy.rootTopicId).not.toBe(source.rootTopicId);
    expect(Object.keys(copy.topicsById).length).toBe(Object.keys(source.topicsById).length);

    for (const topic of Object.values(copy.topicsById)) {
      if (!topic.parentId) continue;
      expect(copy.topicsById[topic.parentId]).toBeDefined();
      expect(copy.topicsById[topic.parentId]?.childrenIds).toContain(topic.id);
    }
  });
});

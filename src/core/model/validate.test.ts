import { describe, expect, it } from 'vitest';
import { createDocument, createSheet, createTopic } from './factories';
import { validate } from './validate';

describe('validate', () => {
  it('accepts a fresh document', () => {
    expect(validate(createDocument())).toEqual([]);
  });

  it('detects parent/child mismatches', () => {
    const sheet = createSheet({ title: 'Test' });
    const child = createTopic({ text: 'Child', parentId: sheet.rootTopicId });
    sheet.topicsById[child.id] = child;
    sheet.topicsById[sheet.rootTopicId]!.childrenIds = [];

    const doc = createDocument({
      sheets: [sheet.id],
      sheetsById: { [sheet.id]: sheet },
    });

    const issues = validate(doc);
    expect(issues.some((issue) => issue.code === 'parent-child-mismatch')).toBe(true);
  });

  it('detects orphan topics', () => {
    const sheet = createSheet({ title: 'Test' });
    const orphan = createTopic({ text: 'Orphan' });
    sheet.topicsById[orphan.id] = orphan;

    const doc = createDocument({
      sheets: [sheet.id],
      sheetsById: { [sheet.id]: sheet },
    });

    const issues = validate(doc);
    expect(issues.some((issue) => issue.code === 'orphan-topic')).toBe(true);
  });
});

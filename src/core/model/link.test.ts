import { describe, expect, it } from 'vitest';
import {
  clearTopicLinksToTargets,
  createTopicLinkRef,
  hasTopicRefLink,
  hasUrlLink,
  migrateLegacyTopicLink,
  normalizeUrl,
  soleLinkKind,
} from './link';

describe('link', () => {
  it('normalizes URLs', () => {
    expect(normalizeUrl('fs.blog/learning/')).toBe('https://fs.blog/learning/');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeUrl('')).toBeNull();
  });

  it('detects url links', () => {
    expect(hasUrlLink({ url: 'https://example.com' })).toBe(true);
    expect(hasUrlLink(undefined)).toBe(false);
  });

  it('detects topic reference links', () => {
    expect(
      hasTopicRefLink({
        targetSheetId: 'sheet-1',
        targetTopicId: 'topic-1',
      }),
    ).toBe(true);
    expect(hasTopicRefLink(undefined)).toBe(false);
  });

  it('creates topic link refs', () => {
    expect(createTopicLinkRef('sheet-1', 'topic-1', 'Target')).toEqual({
      targetSheetId: 'sheet-1',
      targetTopicId: 'topic-1',
      title: 'Target',
    });
  });

  it('migrates legacy single link field', () => {
    const topic: {
      link?: { kind: 'cloud'; url: string };
      cloudLink?: { url: string };
    } = {
      link: { kind: 'cloud', url: 'https://drive.google.com/file' },
    };
    migrateLegacyTopicLink(topic);
    expect(topic.cloudLink).toEqual({ url: 'https://drive.google.com/file' });
    expect(topic.link).toBeUndefined();
  });

  it('resolves sole link kind', () => {
    expect(
      soleLinkKind({
        webLink: { url: 'https://example.com' },
      }),
    ).toBe('webpage');
    expect(
      soleLinkKind({
        cloudLink: { url: 'https://drive.google.com' },
        topicLink: createTopicLinkRef('s', 't'),
      }),
    ).toBe(null);
  });

  it('clears topic links to deleted targets across sheets', () => {
    const sheetsById = {
      'sheet-a': {
        topicsById: {
          t1: {
            topicLink: createTopicLinkRef('sheet-b', 't9'),
          },
        },
      },
      'sheet-b': {
        topicsById: {
          t9: {},
          t2: {
            topicLink: createTopicLinkRef('sheet-b', 't9'),
          },
        },
      },
    };

    clearTopicLinksToTargets(sheetsById, 'sheet-b', ['t9']);

    expect(sheetsById['sheet-a'].topicsById.t1.topicLink).toBeUndefined();
    expect(sheetsById['sheet-b'].topicsById.t2.topicLink).toBeUndefined();
  });
});

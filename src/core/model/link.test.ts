import { describe, expect, it } from 'vitest';
import { normalizeUrl, topicHasLink, topicLinkKind } from './link';

describe('link', () => {
  it('normalizes URLs', () => {
    expect(normalizeUrl('fs.blog/learning/')).toBe('https://fs.blog/learning/');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeUrl('')).toBeNull();
  });

  it('detects topic links', () => {
    expect(topicHasLink({ url: 'https://example.com' })).toBe(true);
    expect(topicHasLink(undefined)).toBe(false);
  });

  it('resolves link kind', () => {
    expect(topicLinkKind({ url: 'https://example.com' })).toBe('webpage');
    expect(topicLinkKind({ url: 'https://example.com', kind: 'cloud' })).toBe('cloud');
  });
});

import { describe, expect, it } from 'vitest';
import { getTopicAttachmentIndicator } from './attachments';

describe('attachments', () => {
  it('chooses the correct indicator', () => {
    expect(getTopicAttachmentIndicator(undefined, { url: 'https://a.com' })).toBe('link');
    expect(getTopicAttachmentIndicator('<p>note</p>', undefined)).toBe('notes');
    expect(
      getTopicAttachmentIndicator('<p>note</p>', { url: 'https://a.com' }),
    ).toBe('multiple');
    expect(getTopicAttachmentIndicator(undefined, undefined)).toBe('none');
  });
});

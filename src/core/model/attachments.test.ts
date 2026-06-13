import { describe, expect, it } from 'vitest';
import { getTopicAttachmentIndicator } from './attachments';

describe('attachments', () => {
  it('chooses the correct indicator', () => {
    expect(getTopicAttachmentIndicator(undefined, { webLink: { url: 'https://a.com' } })).toBe(
      'link',
    );
    expect(getTopicAttachmentIndicator('<p>note</p>', undefined)).toBe('notes');
    expect(
      getTopicAttachmentIndicator('<p>note</p>', { webLink: { url: 'https://a.com' } }),
    ).toBe('multiple');
    expect(
      getTopicAttachmentIndicator('<p>note</p>', {
        topicLink: { targetSheetId: 'sheet-1', targetTopicId: 'topic-1' },
      }),
    ).toBe('multiple');
    expect(
      getTopicAttachmentIndicator('<p>note</p>', {
        cloudLink: { url: 'https://drive.google.com/file' },
      }),
    ).toBe('multiple');
    expect(getTopicAttachmentIndicator(undefined, undefined)).toBe('none');
  });

  it('treats multiple link types as multiple attachments', () => {
    expect(
      getTopicAttachmentIndicator(undefined, {
        webLink: { url: 'https://a.com' },
        cloudLink: { url: 'https://drive.google.com' },
        topicLink: { targetSheetId: 'sheet-1', targetTopicId: 'topic-1' },
      }),
    ).toBe('multiple');
  });
});

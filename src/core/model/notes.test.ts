import { describe, expect, it } from 'vitest';
import { notesContentIsEmpty, topicHasNotes } from './notes';

describe('notes helpers', () => {
  it('treats blank html as empty', () => {
    expect(notesContentIsEmpty('')).toBe(true);
    expect(notesContentIsEmpty('<br>')).toBe(true);
    expect(notesContentIsEmpty('<p> </p>')).toBe(true);
    expect(notesContentIsEmpty('<p>note</p>')).toBe(false);
  });

  it('detects attached notes on topics', () => {
    expect(topicHasNotes(undefined)).toBe(false);
    expect(topicHasNotes('<p>idea</p>')).toBe(true);
    expect(topicHasNotes('<br>')).toBe(false);
  });
});

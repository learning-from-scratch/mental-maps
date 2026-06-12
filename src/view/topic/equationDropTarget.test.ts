import { describe, expect, it } from 'vitest';
import {
  topicIsEmptyForEquationDrop,
  topicUsesSingleEquationGrid,
} from '@/view/topic/equationDropTarget';

describe('topicIsEmptyForEquationDrop', () => {
  it('accepts textless topics without an equation', () => {
    expect(topicIsEmptyForEquationDrop('', undefined)).toBe(true);
    expect(topicIsEmptyForEquationDrop('   ', undefined)).toBe(true);
  });

  it('rejects topics with text or an equation', () => {
    expect(topicIsEmptyForEquationDrop('Hello', undefined)).toBe(false);
    expect(topicIsEmptyForEquationDrop('', { latex: 'x^2' })).toBe(false);
  });
});

describe('topicUsesSingleEquationGrid', () => {
  it('uses a single grid zone for textless topics', () => {
    expect(topicUsesSingleEquationGrid('')).toBe(true);
    expect(topicUsesSingleEquationGrid('   ')).toBe(true);
  });

  it('uses a split grid when the topic has visible text', () => {
    expect(topicUsesSingleEquationGrid('Hello')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  finalizeLabels,
  formatLabelsForInput,
  LABEL_MARGIN_BOTTOM,
  measureLabelsBlock,
  parseLabelInput,
} from './labels';

describe('labels', () => {
  it('parses comma-separated labels', () => {
    expect(parseLabelInput('egg, yolk')).toEqual(['egg', 'yolk']);
    expect(parseLabelInput('one,two, three ,')).toEqual(['one', 'two', 'three']);
  });

  it('formats labels for input', () => {
    expect(formatLabelsForInput(['egg', 'yolk'])).toBe('egg, yolk');
  });

  it('deduplicates and optionally sorts labels', () => {
    expect(finalizeLabels(['yolk', 'egg', 'yolk'], true)).toEqual(['egg', 'yolk']);
    expect(finalizeLabels(['yolk', 'egg'], false)).toEqual(['yolk', 'egg']);
  });

  it('measures wrapped label block height', () => {
    const labels = ['bubi', 'egg', 'ipot', 'kamote', 'kantot', 'yolk'];
    expect(measureLabelsBlock(labels, 120)).toBeGreaterThan(24 + LABEL_MARGIN_BOTTOM);
    expect(measureLabelsBlock([], 120)).toBe(0);
  });
});

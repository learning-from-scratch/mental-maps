import { describe, expect, it } from 'vitest';
import { connectorStrokeColor, getBranchTheme, relativeLuminance } from './theme';

describe('connectorStrokeColor', () => {
  it('keeps saturated classic branch colors unchanged', () => {
    expect(connectorStrokeColor(0, 'classic')).toBe(getBranchTheme(0, 'classic').color);
    expect(connectorStrokeColor(2, 'classic')).toBe(getBranchTheme(2, 'classic').color);
  });

  it('darkens pale branch accents for readable connectors', () => {
    const branch = getBranchTheme(5, 'intj');
    const stroke = connectorStrokeColor(5, 'intj');

    expect(stroke).not.toBe(branch.light);
    expect(relativeLuminance(stroke)).toBeLessThan(relativeLuminance(branch.color));
    expect(relativeLuminance(stroke)).toBeLessThan(0.72);
  });
});

export interface BranchTheme {
  color: string;
  light: string;
  textOnMain: string;
}

export const BRANCH_PALETTE: BranchTheme[] = [
  { color: '#E85757', light: '#FDECEC', textOnMain: '#ffffff' },
  { color: '#F59E42', light: '#FEF4E8', textOnMain: '#ffffff' },
  { color: '#4CBF7A', light: '#E8F8EF', textOnMain: '#ffffff' },
  { color: '#3DB8B0', light: '#E6F7F6', textOnMain: '#ffffff' },
  { color: '#5B8DEF', light: '#EBF2FD', textOnMain: '#ffffff' },
  { color: '#9B6BD4', light: '#F3EDFB', textOnMain: '#ffffff' },
];

export function getBranchTheme(branchIndex: number): BranchTheme {
  if (branchIndex < 0) {
    return { color: '#2d2d2d', light: '#ffffff', textOnMain: '#2d2d2d' };
  }
  return BRANCH_PALETTE[branchIndex % BRANCH_PALETTE.length]!;
}

export function branchThemeIndexForColor(color?: string): number | null {
  if (!color) return null;
  const index = BRANCH_PALETTE.findIndex(
    (theme) => theme.color.toLowerCase() === color.toLowerCase(),
  );
  return index >= 0 ? index : null;
}

export function branchColorForIndex(index: number): string {
  return getBranchTheme(index).color;
}

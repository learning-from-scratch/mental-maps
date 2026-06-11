export interface BranchTheme {
  color: string;
  light: string;
  textOnMain: string;
}

export interface MapCanvasStyle {
  background: string;
  dotColor: string;
}

export interface MapTheme {
  id: string;
  label: string;
  colors: string[];
  canvas: MapCanvasStyle;
}

/** One palette per MBTI type (essence-matched 6-color ramps) plus the default Classic theme. */
export const MAP_THEMES: MapTheme[] = [
  {
    id: 'classic',
    label: 'Classic',
    colors: ['#E85757', '#F59E42', '#4CBF7A', '#3DB8B0', '#5B8DEF', '#9B6BD4'],
    canvas: { background: '#FAF9F7', dotColor: '#D0CEC9' },
  },
  {
    id: 'intj',
    label: 'INTJ · Architect',
    colors: ['#1E2A44', '#2F3E5E', '#4E5F82', '#8C7A5B', '#C9B37E', '#E6E1D3'],
    canvas: { background: '#F3F1EA', dotColor: '#D6D0C2' },
  },
  {
    id: 'intp',
    label: 'INTP · Logician',
    colors: ['#203040', '#2F4A63', '#486581', '#7B8794', '#B8C7D9', '#E8F1F8'],
    canvas: { background: '#F1F6FA', dotColor: '#CBD8E3' },
  },
  {
    id: 'entj',
    label: 'ENTJ · Commander',
    colors: ['#2B2D42', '#4A2C3A', '#7A1F2B', '#B08968', '#D6C6A8', '#F2EEE6'],
    canvas: { background: '#F4EFE8', dotColor: '#D9C7B6' },
  },
  {
    id: 'entp',
    label: 'ENTP · Debater',
    colors: ['#24304F', '#313A66', '#00A6A6', '#F2C14E', '#F78154', '#F7F7FF'],
    canvas: { background: '#F7F5ED', dotColor: '#D8D2BF' },
  },
  {
    id: 'infj',
    label: 'INFJ · Advocate',
    colors: ['#2B1A3D', '#3B1F5C', '#6D5A8D', '#A89CC8', '#D8C8F0', '#F5EEF8'],
    canvas: { background: '#F7F1FA', dotColor: '#DDD1E8' },
  },
  {
    id: 'infp',
    label: 'INFP · Mediator',
    colors: ['#3A2458', '#765898', '#BFA2DB', '#F3C6D3', '#F8E7A1', '#FFF7F0'],
    canvas: { background: '#FFF5F8', dotColor: '#EAD2DC' },
  },
  {
    id: 'enfj',
    label: 'ENFJ · Protagonist',
    colors: ['#4A243E', '#8A3A5B', '#D96C75', '#F2A65A', '#F6D6AD', '#FFF3E8'],
    canvas: { background: '#FFF3EA', dotColor: '#E7C8B5' },
  },
  {
    id: 'enfp',
    label: 'ENFP · Campaigner',
    colors: ['#4B1D5A', '#7A1E7A', '#F05D5E', '#F7B32B', '#7AC74F', '#FFF8E8'],
    canvas: { background: '#FFF8E8', dotColor: '#EAD8A8' },
  },
  {
    id: 'istj',
    label: 'ISTJ · Logistician',
    colors: ['#2F3A45', '#3E4C59', '#616E7C', '#8D6E63', '#C2B280', '#ECE7DD'],
    canvas: { background: '#F3F0E8', dotColor: '#D4CEC0' },
  },
  {
    id: 'isfj',
    label: 'ISFJ · Defender',
    colors: ['#354F52', '#52796F', '#84A98C', '#CAD2C5', '#F2E8CF', '#FFF8F0'],
    canvas: { background: '#F4F8F1', dotColor: '#D4DED0' },
  },
  {
    id: 'estj',
    label: 'ESTJ · Executive',
    colors: ['#374151', '#4B5563', '#5C677D', '#9A6A3A', '#D6A756', '#F4EBD0'],
    canvas: { background: '#F5F0E3', dotColor: '#D9CDB8' },
  },
  {
    id: 'esfj',
    label: 'ESFJ · Consul',
    colors: ['#5C2A3D', '#A44A5F', '#E07A5F', '#F2CC8F', '#F4F1DE', '#DDE5B6'],
    canvas: { background: '#FFF3EC', dotColor: '#E8CFC4' },
  },
  {
    id: 'istp',
    label: 'ISTP · Virtuoso',
    colors: ['#263445', '#334155', '#64748B', '#94A3B8', '#D1D5DB', '#F8FAFC'],
    canvas: { background: '#F2F5F7', dotColor: '#CCD5DD' },
  },
  {
    id: 'isfp',
    label: 'ISFP · Adventurer',
    colors: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#FFF3E2'],
    canvas: { background: '#FFF4E8', dotColor: '#E8D2BA' },
  },
  {
    id: 'estp',
    label: 'ESTP · Entrepreneur',
    colors: ['#27324A', '#8B1E2D', '#EF233C', '#FCA311', '#00B4D8', '#EDF2F4'],
    canvas: { background: '#F2F6F8', dotColor: '#CAD8DF' },
  },
  {
    id: 'esfp',
    label: 'ESFP · Entertainer',
    colors: ['#3A0CA3', '#7209B7', '#F72585', '#FFB703', '#4CC9F0', '#FFF1E6'],
    canvas: { background: '#FFF4F0', dotColor: '#EBCBC4' },
  },
];

export const DEFAULT_MAP_THEME_ID = 'classic';

const LEGACY_SHEET_THEME_IDS: Record<string, string> = {
  default: DEFAULT_MAP_THEME_ID,
  colorful: DEFAULT_MAP_THEME_ID,
};

/** Resolve a sheet's theme ref to a known map theme id. */
export function resolveSheetThemeId(
  themeRef: string,
  fallback: string = DEFAULT_MAP_THEME_ID,
): string {
  const candidate = LEGACY_SHEET_THEME_IDS[themeRef] ?? themeRef;
  return MAP_THEMES.some((theme) => theme.id === candidate) ? candidate : fallback;
}

function mixHexChannel(channel: number, target: number, ratio: number): string {
  return Math.round(channel + (target - channel) * ratio)
    .toString(16)
    .padStart(2, '0');
}

/** Mix a hex color toward white to derive the light child-node tint. */
function mixWithWhite(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `#${mixHexChannel(r, 255, ratio)}${mixHexChannel(g, 255, ratio)}${mixHexChannel(
    b,
    255,
    ratio,
  )}`;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function buildPalette(colors: string[]): BranchTheme[] {
  return colors.map((color) => ({
    color,
    light: mixWithWhite(color, 0.88),
    textOnMain: relativeLuminance(color) > 0.55 ? '#2d2d2d' : '#ffffff',
  }));
}

export const BRANCH_PALETTE: BranchTheme[] = buildPalette(MAP_THEMES[0]!.colors);

const paletteCache = new Map<string, BranchTheme[]>();

function paletteForTheme(themeId: string): BranchTheme[] {
  const cached = paletteCache.get(themeId);
  if (cached) return cached;

  const theme = MAP_THEMES.find((candidate) => candidate.id === themeId);
  const palette = theme ? buildPalette(theme.colors) : BRANCH_PALETTE;
  paletteCache.set(themeId, palette);
  return palette;
}

export function getBranchTheme(
  branchIndex: number,
  themeId: string = DEFAULT_MAP_THEME_ID,
): BranchTheme {
  if (branchIndex < 0) {
    return { color: '#2d2d2d', light: '#ffffff', textOnMain: '#2d2d2d' };
  }
  const palette = paletteForTheme(themeId);
  return palette[branchIndex % palette.length]!;
}

export function branchColorForIndex(
  index: number,
  themeId: string = DEFAULT_MAP_THEME_ID,
): string {
  return getBranchTheme(index, themeId).color;
}

const DEFAULT_CANVAS: MapCanvasStyle = MAP_THEMES[0]!.canvas;

export function getMapTheme(themeId: string): MapTheme | undefined {
  return MAP_THEMES.find((candidate) => candidate.id === themeId);
}

export function getMapCanvasStyle(themeId: string): MapCanvasStyle {
  return getMapTheme(themeId)?.canvas ?? DEFAULT_CANVAS;
}

import { MAP_THEMES } from '@/layout/theme';

interface ThemeSidebarPanelProps {
  activeThemeId: string;
  canvasDotsEnabled: boolean;
  onCanvasDotsChange: (enabled: boolean) => void;
  onSelectTheme: (themeId: string) => void;
}

export function ThemeSidebarPanel({
  activeThemeId,
  canvasDotsEnabled,
  onCanvasDotsChange,
  onSelectTheme,
}: ThemeSidebarPanelProps) {
  return (
    <aside className="right-sidebars__panel theme-sidebar__panel" aria-label="Map color themes">
      <div className="theme-sidebar__dots-toggle" role="group" aria-label="Dotted background">
        <span className="theme-sidebar__dots-label">Dotted background</span>
        <button
          type="button"
          role="switch"
          className={`theme-sidebar__switch${canvasDotsEnabled ? ' theme-sidebar__switch--on' : ''}`}
          aria-checked={canvasDotsEnabled}
          aria-label="Dotted background"
          onClick={() => onCanvasDotsChange(!canvasDotsEnabled)}
        >
          <span className="theme-sidebar__switch-thumb" />
        </button>
      </div>
      <div className="theme-sidebar__header">Map theme</div>
      <div className="theme-sidebar__list">
        {MAP_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-sidebar__item${
              theme.id === activeThemeId ? ' theme-sidebar__item--active' : ''
            }`}
            onClick={() => onSelectTheme(theme.id)}
          >
            <span className="theme-sidebar__name">{theme.label}</span>
            <span className="theme-sidebar__swatches">
              {theme.colors.map((color) => (
                <span
                  key={color}
                  className="theme-sidebar__swatch"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

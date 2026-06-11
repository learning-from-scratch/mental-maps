import { Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MAP_THEMES } from '@/layout/theme';
import { appIcon } from '@/view/icons';

interface ThemeSidebarProps {
  activeThemeId: string;
  canvasDotsEnabled: boolean;
  onCanvasDotsChange: (enabled: boolean) => void;
  onSelectTheme: (themeId: string) => void;
}

export function ThemeSidebar({
  activeThemeId,
  canvasDotsEnabled,
  onCanvasDotsChange,
  onSelectTheme,
}: ThemeSidebarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="theme-sidebar">
      <button
        type="button"
        className={`theme-sidebar__toggle${open ? ' theme-sidebar__toggle--active' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Close theme panel' : 'Open theme panel'}
        title="Map themes"
      >
        <Palette {...appIcon('theme-sidebar__toggle-icon')} />
      </button>
      {open && (
        <aside className="theme-sidebar__panel" aria-label="Map color themes">
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
      )}
    </div>
  );
}

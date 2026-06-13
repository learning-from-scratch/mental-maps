import { Palette, Sticker } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { StickerSidebarPanel } from '@/view/sidebar/StickerSidebar';
import { ThemeSidebarPanel } from '@/view/sidebar/ThemeSidebar';
import type { MarkerId } from '@/core/model/types';
import { appIcon } from '@/view/icons';

type SidebarPanel = 'theme' | 'sticker' | null;

interface RightSidebarsProps {
  activeThemeId: string;
  canvasDotsEnabled: boolean;
  onCanvasDotsChange: (enabled: boolean) => void;
  onSelectTheme: (themeId: string) => void;
  selectedTopicId: string | null;
  rootTopicId: string;
  selectedTopicMarkers: MarkerId[];
  stickerLegendVisible: boolean;
  onToggleStickerLegend: () => void;
  onSelectSticker: (stickerId: MarkerId) => void;
  stickerPanelRequest?: number;
}

export function RightSidebars({
  activeThemeId,
  canvasDotsEnabled,
  onCanvasDotsChange,
  onSelectTheme,
  selectedTopicId,
  rootTopicId,
  selectedTopicMarkers,
  stickerLegendVisible,
  onToggleStickerLegend,
  onSelectSticker,
  stickerPanelRequest = 0,
}: RightSidebarsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<SidebarPanel>(null);

  useEffect(() => {
    if (stickerPanelRequest > 0) {
      setOpenPanel('sticker');
    }
  }, [stickerPanelRequest]);

  useEffect(() => {
    if (!openPanel) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openPanel]);

  const togglePanel = (panel: Exclude<SidebarPanel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
    <div ref={rootRef} className="right-sidebars">
      <div className="right-sidebars__toolbar" role="toolbar" aria-label="Map tools">
        <button
          type="button"
          className={`right-sidebars__button${openPanel === 'sticker' ? ' right-sidebars__button--active' : ''}`}
          onClick={() => togglePanel('sticker')}
          aria-expanded={openPanel === 'sticker'}
          aria-label={openPanel === 'sticker' ? 'Close sticker panel' : 'Open sticker panel'}
          title="Stickers"
        >
          <Sticker {...appIcon('right-sidebars__button-icon')} />
        </button>
        <button
          type="button"
          className={`right-sidebars__button${openPanel === 'theme' ? ' right-sidebars__button--active' : ''}`}
          onClick={() => togglePanel('theme')}
          aria-expanded={openPanel === 'theme'}
          aria-label={openPanel === 'theme' ? 'Close theme panel' : 'Open theme panel'}
          title="Map themes"
        >
          <Palette {...appIcon('right-sidebars__button-icon')} />
        </button>
      </div>
      {openPanel === 'sticker' ? (
        <StickerSidebarPanel
          themeId={activeThemeId}
          selectedTopicId={selectedTopicId}
          rootTopicId={rootTopicId}
          markers={selectedTopicMarkers}
          legendVisible={stickerLegendVisible}
          onToggleLegend={onToggleStickerLegend}
          onSelectSticker={onSelectSticker}
        />
      ) : null}
      {openPanel === 'theme' ? (
        <ThemeSidebarPanel
          activeThemeId={activeThemeId}
          canvasDotsEnabled={canvasDotsEnabled}
          onCanvasDotsChange={onCanvasDotsChange}
          onSelectTheme={onSelectTheme}
        />
      ) : null}
    </div>
  );
}

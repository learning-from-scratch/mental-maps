import { ChevronDown } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { getStickerCategoriesForTheme, getStickerDefinition, sortTopicStickers } from '@/core/model/stickers';
import type { MarkerId } from '@/core/model/types';
import { appIcon } from '@/view/icons';
import { StickerIcon } from '@/view/topic/stickerIcons';

interface StickerSidebarPanelProps {
  themeId: string;
  selectedTopicId: string | null;
  rootTopicId: string;
  markers: MarkerId[];
  legendVisible: boolean;
  onToggleLegend: () => void;
  onSelectSticker: (stickerId: MarkerId) => void;
}

function PickerTaskGlyph({ glyph }: { glyph: string }) {
  const progress = Number.parseInt(glyph, 10);
  if (Number.isNaN(progress)) return null;

  const angle = (progress / 100) * 360;
  return (
    <span
      className="sticker-picker__task-progress"
      style={{ '--task-progress': `${angle}deg` } as CSSProperties}
      aria-hidden
    />
  );
}

function PickerStickerContent({ sticker }: { sticker: ReturnType<typeof getStickerCategoriesForTheme>[number]['stickers'][number] }) {
  if (sticker.category === 'tag') {
    return null;
  }

  if (sticker.glyph) {
    if (sticker.category === 'task' && sticker.glyph !== '100') {
      return <PickerTaskGlyph glyph={sticker.glyph} />;
    }

    return <span className="sticker-picker__glyph">{sticker.glyph}</span>;
  }

  if (sticker.icon) {
    return <StickerIcon name={sticker.icon} className="sticker-picker__icon" />;
  }

  return null;
}

export function StickerSidebarPanel({
  themeId,
  selectedTopicId,
  rootTopicId,
  markers,
  legendVisible,
  onToggleLegend,
  onSelectSticker,
}: StickerSidebarPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selectedStickers = sortTopicStickers(markers);
  const hasSelection = selectedTopicId !== null;
  const allowsStickers = hasSelection && selectedTopicId !== rootTopicId;
  const categories = useMemo(() => getStickerCategoriesForTheme(themeId), [themeId]);

  const toggleSection = (sectionId: string) => {
    setCollapsed((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  return (
    <aside className="right-sidebars__panel sticker-sidebar__panel" aria-label="Topic stickers">
      <div className="sticker-sidebar__header">Sticker</div>
      <button
        type="button"
        className="sticker-sidebar__legend-toggle"
        onClick={onToggleLegend}
        aria-pressed={legendVisible}
      >
        {legendVisible ? 'Hide Legend' : 'Show Legend'}
      </button>
      <div className="sticker-sidebar__divider" aria-hidden />
      {!hasSelection ? (
        <p className="sticker-sidebar__hint">Select a topic to add stickers.</p>
      ) : !allowsStickers ? (
        <p className="sticker-sidebar__hint">Stickers cannot be added to the central topic.</p>
      ) : (
        <div className="sticker-sidebar__sections">
          {categories.map((section) => {
            const isCollapsed = collapsed[section.id] ?? false;
            return (
              <section key={section.id} className="sticker-sidebar__section">
                <button
                  type="button"
                  className="sticker-sidebar__section-toggle"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown
                    {...appIcon('sticker-sidebar__section-chevron')}
                    className={`sticker-sidebar__section-chevron${
                      isCollapsed ? ' sticker-sidebar__section-chevron--collapsed' : ''
                    }`}
                  />
                  <span>{section.label}</span>
                </button>
                {!isCollapsed && (
                  <div className="sticker-sidebar__grid">
                    {section.stickers.map((sticker) => {
                      const selected = selectedStickers.includes(sticker.id);
                      return (
                        <button
                          key={sticker.id}
                          type="button"
                          className={`sticker-picker__button${
                            selected ? ' sticker-picker__button--selected' : ''
                          }`}
                          style={{ backgroundColor: sticker.color }}
                          title={getStickerDefinition(sticker.id)?.label ?? sticker.label}
                          aria-label={sticker.label}
                          aria-pressed={selected}
                          onClick={() => onSelectSticker(sticker.id)}
                        >
                          <PickerStickerContent sticker={sticker} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}

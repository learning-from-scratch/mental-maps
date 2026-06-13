import type { CSSProperties } from 'react';
import { getStickerDefinition, resolveStickerColor, sortTopicStickers } from '@/core/model/stickers';
import type { MarkerId } from '@/core/model/types';
import { DEFAULT_MAP_THEME_ID } from '@/layout/theme';
import { StickerIcon } from '@/view/topic/stickerIcons';

interface TopicStickersProps {
  markers: MarkerId[];
  themeId?: string;
  onStickerClick?: (markerId: MarkerId, element: HTMLElement) => void;
}

function TaskGlyph({ glyph }: { glyph: string }) {
  const progress = Number.parseInt(glyph, 10);
  if (Number.isNaN(progress)) return null;

  const angle = (progress / 100) * 360;
  return (
    <span
      className="topic-stickers__task-progress"
      style={
        {
          '--task-progress': `${angle}deg`,
        } as CSSProperties
      }
      aria-hidden
    />
  );
}

function StickerGlyph({ markerId }: { markerId: MarkerId }) {
  const sticker = getStickerDefinition(markerId);
  if (!sticker) return null;

  if (sticker.glyph) {
    if (sticker.category === 'task' && sticker.glyph !== '100') {
      return <TaskGlyph glyph={sticker.glyph} />;
    }

    return <span className="topic-stickers__glyph">{sticker.glyph}</span>;
  }

  if (sticker.icon) {
    return <StickerIcon name={sticker.icon} className="topic-stickers__icon" />;
  }

  return null;
}

export function TopicStickers({
  markers,
  themeId = DEFAULT_MAP_THEME_ID,
  onStickerClick,
}: TopicStickersProps) {
  const stickers = sortTopicStickers(markers);
  if (stickers.length === 0) return null;

  return (
    <span className="topic-stickers" aria-label="Topic stickers">
      {stickers.map((markerId, index) => {
        const sticker = getStickerDefinition(markerId);
        if (!sticker) return null;

        return (
          <button
            key={markerId}
            type="button"
            className="topic-stickers__item"
            style={
              {
                '--sticker-index': index + 1,
                backgroundColor: resolveStickerColor(sticker, themeId),
              } as CSSProperties
            }
            aria-label={sticker.label}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onStickerClick?.(markerId, event.currentTarget);
            }}
          >
            <StickerGlyph markerId={markerId} />
          </button>
        );
      })}
    </span>
  );
}

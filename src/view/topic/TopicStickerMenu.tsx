import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  getStickerDefinition,
  getStickersForCategory,
  stickerCategory,
} from '@/core/model/stickers';
import type { MarkerId } from '@/core/model/types';
import { DEFAULT_MAP_THEME_ID } from '@/layout/theme';
import { appIcon } from '@/view/icons';
import { StickerIcon } from '@/view/topic/stickerIcons';

interface TopicStickerMenuProps {
  activeMarkerId: MarkerId;
  themeId?: string;
  caretLeft?: number;
  onSelectSticker: (stickerId: MarkerId) => void;
  onDelete: () => void;
  onClose: () => void;
}

function MenuTaskGlyph({ glyph }: { glyph: string }) {
  const progress = Number.parseInt(glyph, 10);
  if (Number.isNaN(progress)) return null;

  const angle = (progress / 100) * 360;
  return (
    <span
      className="topic-sticker-menu__task-progress"
      style={{ '--task-progress': `${angle}deg` } as CSSProperties}
      aria-hidden
    />
  );
}

function MenuStickerContent({
  sticker,
}: {
  sticker: ReturnType<typeof getStickersForCategory>[number];
}) {
  if (sticker.category === 'tag') {
    return null;
  }

  if (sticker.glyph) {
    if (sticker.category === 'task' && sticker.glyph !== '100') {
      return <MenuTaskGlyph glyph={sticker.glyph} />;
    }

    return <span className="topic-sticker-menu__glyph">{sticker.glyph}</span>;
  }

  if (sticker.icon) {
    return <StickerIcon name={sticker.icon} className="topic-sticker-menu__icon" />;
  }

  return null;
}

export function TopicStickerMenu({
  activeMarkerId,
  themeId = DEFAULT_MAP_THEME_ID,
  caretLeft,
  onSelectSticker,
  onDelete,
  onClose,
}: TopicStickerMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const category = stickerCategory(activeMarkerId);
  const stickers = useMemo(
    () => (category ? getStickersForCategory(category, themeId) : []),
    [category, themeId],
  );

  useEffect(() => {
    let onPointerDown: ((event: PointerEvent) => void) | null = null;
    const timeout = window.setTimeout(() => {
      onPointerDown = (event: PointerEvent) => {
        if (!wrapRef.current?.contains(event.target as Node)) {
          onClose();
        }
      };
      window.addEventListener('pointerdown', onPointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      if (onPointerDown) window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!category || stickers.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className="topic-sticker-menu-wrap"
      style={
        caretLeft !== undefined
          ? ({ '--sticker-menu-caret-left': `${caretLeft}px` } as CSSProperties)
          : undefined
      }
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="topic-sticker-menu__caret" aria-hidden />
      <div className="topic-sticker-menu">
        <div className="topic-sticker-menu__glass" aria-hidden />
        <div className="topic-sticker-menu__stickers">
          {stickers.map((sticker) => {
            const selected = sticker.id === activeMarkerId;
            return (
              <button
                key={sticker.id}
                type="button"
                className={`topic-sticker-menu__sticker${
                  selected ? ' topic-sticker-menu__sticker--selected' : ''
                }`}
                style={{ backgroundColor: sticker.color }}
                aria-label={getStickerDefinition(sticker.id)?.label ?? sticker.label}
                aria-pressed={selected}
                onClick={() => {
                  onSelectSticker(sticker.id);
                  onClose();
                }}
              >
                <MenuStickerContent sticker={sticker} />
              </button>
            );
          })}
        </div>
        <span className="topic-sticker-menu__divider" aria-hidden />
        <button
          type="button"
          className="topic-sticker-menu__delete"
          aria-label="Remove sticker"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 {...appIcon('topic-sticker-menu__delete-icon')} />
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  getStickerDefinition,
  getStickersForCategory,
  resolveStickerColor,
  resolveStickerLegendLabel,
} from '@/core/model/stickers';
import type { MarkerId, Vec2 } from '@/core/model/types';
import { DEFAULT_MAP_THEME_ID } from '@/layout/theme';
import { StickerIcon } from '@/view/topic/stickerIcons';

interface StickerLegendProps {
  markerIds: MarkerId[];
  themeId?: string;
  position: Vec2;
  labelOverrides: Record<MarkerId, string>;
  zoom: number;
  onPositionChange: (position: Vec2) => void;
  onLabelChange: (markerId: MarkerId, label: string) => void;
}

function LegendTaskGlyph({ glyph }: { glyph: string }) {
  const progress = Number.parseInt(glyph, 10);
  if (Number.isNaN(progress)) return null;

  const angle = (progress / 100) * 360;
  return (
    <span
      className="sticker-legend__task-progress"
      style={{ '--task-progress': `${angle}deg` } as CSSProperties}
      aria-hidden
    />
  );
}

function LegendStickerGlyph({ markerId }: { markerId: MarkerId }) {
  const sticker = getStickerDefinition(markerId);
  if (!sticker) return null;

  if (sticker.glyph) {
    if (sticker.category === 'task' && sticker.glyph !== '100') {
      return <LegendTaskGlyph glyph={sticker.glyph} />;
    }

    return <span className="sticker-legend__glyph">{sticker.glyph}</span>;
  }

  if (sticker.icon) {
    return <StickerIcon name={sticker.icon} className="sticker-legend__icon" />;
  }

  return null;
}

function LegendLabel({
  markerId,
  label,
  onCommit,
}: {
  markerId: MarkerId;
  label: string;
  onCommit: (label: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = label;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing, label]);

  const commit = () => {
    const next =
      editorRef.current?.textContent?.trim() ||
      getStickerDefinition(markerId)?.label ||
      markerId;
    onCommit(next);
    setIsEditing(false);
  };

  const cancel = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <span
        ref={editorRef}
        className="sticker-legend__label sticker-legend__label--editing"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Edit legend label"
        onBlur={commit}
        onInput={(event) => {
          const editor = event.currentTarget;
          const text = editor.textContent ?? '';
          if (text.includes('\n')) {
            editor.textContent = text.replace(/\n/g, ' ');
          }
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      />
    );
  }

  return (
    <span
      className="sticker-legend__label"
      onDoubleClick={(event) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
    >
      {label}
    </span>
  );
}

export function StickerLegend({
  markerIds,
  themeId = DEFAULT_MAP_THEME_ID,
  position,
  labelOverrides,
  zoom,
  onPositionChange,
  onLabelChange,
}: StickerLegendProps) {
  const positionRef = useRef(position);
  positionRef.current = position;
  const draggingRef = useRef(false);

  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [endDrag]);

  if (markerIds.length === 0) return null;

  return (
    <div
      className="sticker-legend"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="sticker-legend__header"
        onPointerDown={(event) => {
          event.stopPropagation();
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          const next = {
            x: positionRef.current.x + event.movementX / zoom,
            y: positionRef.current.y + event.movementY / zoom,
          };
          positionRef.current = next;
          onPositionChange(next);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          draggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        Legend
      </div>
      <div className="sticker-legend__divider" aria-hidden />
      <ul className="sticker-legend__list">
        {markerIds.map((markerId) => {
          const sticker = getStickerDefinition(markerId);
          if (!sticker) return null;
          const themed = getStickersForCategory(sticker.category, themeId).find(
            (entry) => entry.id === markerId,
          );

          return (
            <li key={markerId} className="sticker-legend__item">
              <span
                className="sticker-legend__swatch"
                style={{ backgroundColor: themed?.color ?? resolveStickerColor(sticker, themeId) }}
                aria-hidden
              >
                <LegendStickerGlyph markerId={markerId} />
              </span>
              <LegendLabel
                markerId={markerId}
                label={resolveStickerLegendLabel(markerId, labelOverrides)}
                onCommit={(nextLabel) => onLabelChange(markerId, nextLabel)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

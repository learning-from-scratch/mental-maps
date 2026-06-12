import { Cloud, Link2, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { topicHasLink, topicLinkKind, type TopicLink } from '@/core/model/link';
import { notesPreviewText, topicHasNotes } from '@/core/model/notes';
import { appIcon } from '@/view/icons';

interface TopicAttachmentsMenuProps {
  notes?: string;
  link?: TopicLink;
  onEditNote: () => void;
  onEditLink: () => void;
  onOpenLink: (url: string) => void;
  onDeleteNote: () => void;
  onDeleteLink: () => void;
  onClose: () => void;
}

export function TopicAttachmentsMenu({
  notes,
  link,
  onEditNote,
  onEditLink,
  onOpenLink,
  onDeleteNote,
  onDeleteLink,
  onClose,
}: TopicAttachmentsMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasNotes = topicHasNotes(notes);
  const hasLink = topicHasLink(link);
  const linkKind = topicLinkKind(link);

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

  return (
    <div ref={wrapRef} className="topic-attachments-menu-wrap">
      <span className="topic-attachments-menu__caret" aria-hidden />
      <div className="topic-attachments-menu">
        <div className="topic-attachments-menu__glass" aria-hidden />
        {hasNotes ? (
          <div className="topic-attachments-menu__item">
            <button
              type="button"
              className="topic-attachments-menu__main"
              onClick={onEditNote}
            >
              <SquarePen {...appIcon('topic-attachments-menu__icon')} />
              <span className="topic-attachments-menu__text">{notesPreviewText(notes)}</span>
            </button>
            <button
              type="button"
              className="topic-attachments-menu__delete"
              aria-label="Delete note"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteNote();
                onClose();
              }}
            >
              <Trash2 {...appIcon('topic-attachments-menu__delete-icon')} />
            </button>
          </div>
        ) : null}
        {hasLink ? (
          <div className="topic-attachments-menu__item topic-attachments-menu__item--link">
            <button
              type="button"
              className="topic-attachments-menu__icon-button"
              aria-label="Edit link"
              onClick={onEditLink}
            >
              {linkKind === 'cloud' ? (
                <Cloud {...appIcon('topic-attachments-menu__icon')} />
              ) : (
                <Link2 {...appIcon('topic-attachments-menu__icon')} />
              )}
            </button>
            <button
              type="button"
              className="topic-attachments-menu__link-text"
              onClick={() => {
                if (link?.url) onOpenLink(link.url);
              }}
            >
              <span className="topic-attachments-menu__text">{link?.url}</span>
            </button>
            <button
              type="button"
              className="topic-attachments-menu__delete"
              aria-label="Delete link"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteLink();
                onClose();
              }}
            >
              <Trash2 {...appIcon('topic-attachments-menu__delete-icon')} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { Cloud, ExternalLink, Link2, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { TopicLinkKind, TopicRefLink, UrlLink } from '@/core/model/link';
import { notesPreviewText, topicHasNotes } from '@/core/model/notes';
import { appIcon } from '@/view/icons';

interface TopicAttachmentsMenuProps {
  notes?: string;
  webLink?: UrlLink;
  cloudLink?: UrlLink;
  topicLink?: TopicRefLink;
  topicLinkLabel?: string;
  caretLeft?: number;
  onEditNote: () => void;
  onEditWebLink: () => void;
  onEditCloudLink: () => void;
  onEditTopicLink: () => void;
  onOpenWebLink: (url: string) => void;
  onOpenCloudLink: (url: string) => void;
  onFollowTopicLink: () => void;
  onDeleteNote: () => void;
  onDeleteWebLink: () => void;
  onDeleteCloudLink: () => void;
  onDeleteTopicLink: () => void;
  onClose: () => void;
}

function linkEditAriaLabel(linkKind: TopicLinkKind): string {
  if (linkKind === 'topic') return 'Edit topic link';
  if (linkKind === 'cloud') return 'Edit cloud storage link';
  return 'Edit webpage link';
}

function LinkKindIcon({ linkKind }: { linkKind: TopicLinkKind }) {
  if (linkKind === 'cloud') {
    return <Cloud {...appIcon('topic-attachments-menu__icon')} />;
  }
  if (linkKind === 'topic') {
    return <Link2 {...appIcon('topic-attachments-menu__icon')} />;
  }
  return <ExternalLink {...appIcon('topic-attachments-menu__icon')} />;
}

interface LinkRowProps {
  linkKind: TopicLinkKind;
  label: string;
  onEdit: () => void;
  onOpen: () => void;
  onDelete: () => void;
}

function LinkRow({ linkKind, label, onEdit, onOpen, onDelete }: LinkRowProps) {
  return (
    <div className="topic-attachments-menu__item topic-attachments-menu__item--link">
      <button
        type="button"
        className="topic-attachments-menu__icon-button"
        aria-label={linkEditAriaLabel(linkKind)}
        onClick={onEdit}
      >
        <LinkKindIcon linkKind={linkKind} />
      </button>
      <button type="button" className="topic-attachments-menu__link-text" onClick={onOpen}>
        <span className="topic-attachments-menu__text">{label}</span>
      </button>
      <button
        type="button"
        className="topic-attachments-menu__delete"
        aria-label="Delete link"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 {...appIcon('topic-attachments-menu__delete-icon')} />
      </button>
    </div>
  );
}

export function TopicAttachmentsMenu({
  notes,
  webLink,
  cloudLink,
  topicLink,
  topicLinkLabel,
  caretLeft,
  onEditNote,
  onEditWebLink,
  onEditCloudLink,
  onEditTopicLink,
  onOpenWebLink,
  onOpenCloudLink,
  onFollowTopicLink,
  onDeleteNote,
  onDeleteWebLink,
  onDeleteCloudLink,
  onDeleteTopicLink,
  onClose,
}: TopicAttachmentsMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasNotes = topicHasNotes(notes);

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
    <div
      ref={wrapRef}
      className="topic-attachments-menu-wrap"
      style={
        caretLeft != null
          ? ({ '--attachments-menu-caret-left': `${caretLeft}px` } as CSSProperties)
          : undefined
      }
    >
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
        {webLink?.url ? (
          <LinkRow
            linkKind="webpage"
            label={webLink.url}
            onEdit={onEditWebLink}
            onOpen={() => onOpenWebLink(webLink.url)}
            onDelete={() => {
              onDeleteWebLink();
              onClose();
            }}
          />
        ) : null}
        {cloudLink?.url ? (
          <LinkRow
            linkKind="cloud"
            label={cloudLink.url}
            onEdit={onEditCloudLink}
            onOpen={() => onOpenCloudLink(cloudLink.url)}
            onDelete={() => {
              onDeleteCloudLink();
              onClose();
            }}
          />
        ) : null}
        {topicLink ? (
          <LinkRow
            linkKind="topic"
            label={topicLinkLabel ?? 'Linked topic'}
            onEdit={onEditTopicLink}
            onOpen={onFollowTopicLink}
            onDelete={() => {
              onDeleteTopicLink();
              onClose();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

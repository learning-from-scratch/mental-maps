import { X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { normalizeUrl } from '@/core/model/link';
import { appIcon } from '@/view/icons';

interface InsertWebLinkModalProps {
  title?: string;
  initialUrl?: string;
  onInsert: (link: { url: string }) => void;
  onCancel: () => void;
}

export function InsertWebLinkModal({
  title = 'Insert Web Link',
  initialUrl = '',
  onInsert,
  onCancel,
}: InsertWebLinkModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (initialUrl) inputRef.current?.select();
  }, [initialUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) return;

    onInsert({ url: normalized });
  };

  const canInsert = Boolean(normalizeUrl(url));

  return createPortal(
    <div className="web-link-modal" role="presentation" onClick={onCancel}>
      <div
        className="web-link-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-link-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="web-link-modal__header">
          <h2 id="web-link-modal-title" className="web-link-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="web-link-modal__close"
            aria-label="Close"
            onClick={onCancel}
          >
            <X {...appIcon('web-link-modal__close-icon')} />
          </button>
        </div>

        <form className="web-link-modal__form" onSubmit={handleSubmit}>
          <div className="web-link-modal__url-wrap">
            <input
              ref={inputRef}
              className="web-link-modal__url-input"
              type="url"
              value={url}
              placeholder="https://"
              onChange={(event) => setUrl(event.target.value)}
            />
            {url ? (
              <button
                type="button"
                className="web-link-modal__url-clear"
                aria-label="Clear URL"
                onClick={() => setUrl('')}
              >
                <X {...appIcon('web-link-modal__url-clear-icon')} />
              </button>
            ) : null}
          </div>

          <div className="web-link-modal__actions">
            <button
              type="button"
              className="web-link-modal__button web-link-modal__button--cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="web-link-modal__button web-link-modal__button--insert"
              disabled={!canInsert}
            >
              Insert
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

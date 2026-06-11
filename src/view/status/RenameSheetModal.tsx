import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { SheetId } from '@/core/model/types';

interface RenameSheetModalProps {
  sheetId: SheetId;
  initialTitle: string;
  onConfirm: (sheetId: SheetId, title: string) => void;
  onCancel: () => void;
}

export function RenameSheetModal({
  sheetId,
  initialTitle,
  onConfirm,
  onCancel,
}: RenameSheetModalProps) {
  const [draft, setDraft] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = draft.trim();
    if (!nextTitle) return;
    onConfirm(sheetId, nextTitle);
  };

  return createPortal(
    <div className="rename-sheet-modal" role="presentation" onClick={onCancel}>
      <div
        className="rename-sheet-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="rename-sheet-title" className="rename-sheet-modal__title">
          Rename Sheet
        </h2>

        <form className="rename-sheet-modal__form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="rename-sheet-modal__input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          <div className="rename-sheet-modal__actions">
            <button
              type="button"
              className="rename-sheet-modal__button rename-sheet-modal__button--cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rename-sheet-modal__button rename-sheet-modal__button--ok"
              disabled={!draft.trim()}
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

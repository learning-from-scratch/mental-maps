import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { setExternalLinkConfirmSkipped } from '@/prefs/externalLinkConfirm';
import { appIcon } from '@/view/icons';

interface OpenExternalLinkModalProps {
  url: string;
  onCancel: () => void;
}

export function OpenExternalLinkModal({ url, onCancel }: OpenExternalLinkModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const handleContinue = () => {
    if (dontShowAgain) setExternalLinkConfirmSkipped(true);
    window.open(url, '_blank', 'noopener,noreferrer');
    onCancel();
  };

  return createPortal(
    <div className="external-link-modal" role="presentation" onClick={onCancel}>
      <div
        className="external-link-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-link-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="external-link-modal__header">
          <h2 id="external-link-modal-title" className="external-link-modal__header-title">
            Open External Link
          </h2>
          <button
            type="button"
            className="external-link-modal__close"
            aria-label="Close"
            onClick={onCancel}
          >
            <X {...appIcon('external-link-modal__close-icon')} />
          </button>
        </div>

        <div className="external-link-modal__body">
          <div className="external-link-modal__warning-row">
            <AlertTriangle {...appIcon('external-link-modal__warning-icon')} />
            <p className="external-link-modal__subtitle">
              Continue only if you fully trust this link.
            </p>
          </div>

          <button
            type="button"
            className="external-link-modal__continue"
            onClick={handleContinue}
          >
            <ArrowRight {...appIcon('external-link-modal__continue-icon')} />
            Continue
          </button>
        </div>

        <div className="external-link-modal__footer">
          <label className="external-link-modal__remember">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            <span>Don&apos;t show this message again.</span>
          </label>
          <button
            type="button"
            className="external-link-modal__cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

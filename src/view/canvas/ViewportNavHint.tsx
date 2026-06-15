import { X } from 'lucide-react';
import { appIcon } from '@/view/icons';

interface ViewportNavHintProps {
  onDismiss: () => void;
}

export function ViewportNavHint({ onDismiss }: ViewportNavHintProps) {
  return (
    <div className="viewport__hud">
      <span className="viewport__hud-text">
        Drag to select · Right-drag or two-finger swipe to pan · Scroll or pinch to zoom
      </span>
      <button
        type="button"
        className="viewport__hud-dismiss"
        aria-label="Dismiss navigation hint"
        onClick={onDismiss}
      >
        <X {...appIcon('viewport__hud-dismiss-icon')} />
      </button>
    </div>
  );
}

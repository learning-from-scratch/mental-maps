import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface ProjectContextMenuProps {
  anchorRef: RefObject<HTMLElement | null>;
  position: { left: number; top: number };
  onRename: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function ProjectContextMenu({
  anchorRef,
  position,
  onRename,
  onRemove,
  onClose,
}: ProjectContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    const timer = window.setTimeout(() => {
      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
        onClose();
      };

      window.addEventListener('pointerdown', handlePointerDown);
      removeListener = () => window.removeEventListener('pointerdown', handlePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      removeListener?.();
    };
  }, [anchorRef, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="recents-context-menu"
      role="menu"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="recents-context-menu__item"
        role="menuitem"
        onClick={(event) => {
          event.stopPropagation();
          onRename();
          onClose();
        }}
      >
        Rename
      </button>
      <div className="recents-context-menu__divider" role="separator" />
      <button
        type="button"
        className="recents-context-menu__item recents-context-menu__item--danger"
        role="menuitem"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
          onClose();
        }}
      >
        Remove
      </button>
    </div>,
    document.body,
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { SheetId } from '@/core/model/types';

interface SheetTabMenuProps {
  sheetId: SheetId;
  canDelete: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onCopyLink: (sheetId: SheetId) => void;
  onRename: (sheetId: SheetId) => void;
  onDuplicate: (sheetId: SheetId) => void;
  onDelete: (sheetId: SheetId) => void;
  onClose: () => void;
}

export function SheetTabMenu({
  sheetId,
  canDelete,
  anchorRef,
  onCopyLink,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: SheetTabMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      setPosition({
        left: rect.left,
        top: rect.top - 8,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

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

  if (!position) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="sheet-tab-menu"
      role="menu"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <button
        type="button"
        className="sheet-tab-menu__item"
        role="menuitem"
        onClick={() => {
          onCopyLink(sheetId);
          onClose();
        }}
      >
        Copy link
      </button>
      <div className="sheet-tab-menu__divider" role="separator" />
      <button
        type="button"
        className="sheet-tab-menu__item"
        role="menuitem"
        onClick={() => {
          onRename(sheetId);
          onClose();
        }}
      >
        Rename
      </button>
      <button
        type="button"
        className="sheet-tab-menu__item"
        role="menuitem"
        onClick={() => {
          onDuplicate(sheetId);
          onClose();
        }}
      >
        Duplicate
      </button>
      <div className="sheet-tab-menu__divider" role="separator" />
      <button
        type="button"
        className="sheet-tab-menu__item sheet-tab-menu__item--danger"
        role="menuitem"
        disabled={!canDelete}
        onClick={() => {
          if (!canDelete) return;
          onDelete(sheetId);
          onClose();
        }}
      >
        Delete
      </button>
    </div>,
    document.body,
  );
}

import { useEffect, useRef, type RefObject } from 'react';
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [anchorRef, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div ref={menuRef} className="sheet-tab-menu" role="menu">
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
    </div>
  );
}

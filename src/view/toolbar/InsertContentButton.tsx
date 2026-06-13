import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { appIcon } from '@/view/icons';
import { InsertMenu } from './InsertMenu';
import { ToolbarTooltip } from './ToolbarTooltip';

interface InsertContentButtonProps {
  hasSelection: boolean;
  onAddNote: () => void;
  onAddLabel: () => void;
  onAddWebpage: () => void;
  onAddTopicLink: () => void;
  onAddCloudStorage: () => void;
  onAddEquation: () => void;
  onAddComment: () => void;
  onAddSticker: () => void;
}

export function InsertContentButton({
  hasSelection,
  onAddNote,
  onAddLabel,
  onAddWebpage,
  onAddTopicLink,
  onAddCloudStorage,
  onAddEquation,
  onAddComment,
  onAddSticker,
}: InsertContentButtonProps) {
  const [open, setOpen] = useState(false);
  const [linkSubmenuOpen, setLinkSubmenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setOpen(false);
    setLinkSubmenuOpen(false);
    setHovered(false);
  };

  const toggleMenu = () => {
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`insert-content-btn${open ? ' insert-content-btn--open' : ''}`}
    >
      <div
        className="insert-content-btn__controls"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          className="insert-content-btn__main"
          aria-label="Insert content"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={toggleMenu}
        >
          <Plus {...appIcon('insert-content-btn__icon')} />
        </button>
        <button
          type="button"
          className="insert-content-btn__caret"
          aria-label="Insert content options"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={toggleMenu}
        >
          <ChevronDown {...appIcon('insert-content-btn__caret-icon')} />
        </button>

        {hovered && !open && (
          <ToolbarTooltip
            title="Insert"
            description="Add other elements to the selected topics"
          />
        )}
      </div>

      <InsertMenu
        open={open}
        hasSelection={hasSelection}
        linkSubmenuOpen={linkSubmenuOpen}
        onLinkHover={setLinkSubmenuOpen}
        onNote={() => {
          onAddNote();
          closeMenu();
        }}
        onLabel={() => {
          onAddLabel();
          closeMenu();
        }}
        onWebpage={() => {
          onAddWebpage();
          closeMenu();
        }}
        onTopicLink={() => {
          onAddTopicLink();
          closeMenu();
        }}
        onCloudStorage={() => {
          onAddCloudStorage();
          closeMenu();
        }}
        onEquation={() => {
          onAddEquation();
          closeMenu();
        }}
        onSticker={() => {
          onAddSticker();
          closeMenu();
        }}
        onComment={() => {
          onAddComment();
          closeMenu();
        }}
      />
    </div>
  );
}

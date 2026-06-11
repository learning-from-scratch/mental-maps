import {
  Bookmark,
  ChevronRight,
  ExternalLink,
  Globe,
  ImagePlus,
  Paperclip,
  Sigma,
  SquarePen,
  Sticker,
  Tag,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { appIcon } from '@/view/icons';

interface InsertMenuProps {
  open: boolean;
  onClose: () => void;
  linkSubmenuOpen: boolean;
  onLinkHover: (open: boolean) => void;
  onNote?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  hasSubmenu?: boolean;
}

const insertIcon = (className = 'insert-menu__svg') => appIcon(className);

const MENU_SECTIONS: MenuItem[][] = [
  [
    { id: 'note', label: 'Note', icon: <SquarePen {...insertIcon()} /> },
    { id: 'label', label: 'Label', icon: <Tag {...insertIcon()} /> },
    {
      id: 'link',
      label: 'Link',
      icon: <ExternalLink {...insertIcon()} />,
      hasSubmenu: true,
    },
  ],
  [{ id: 'attachment', label: 'Attachment', icon: <Paperclip {...insertIcon()} /> }],
  [
    { id: 'sticker', label: 'Sticker', icon: <Sticker {...insertIcon()} /> },
    { id: 'local-image', label: 'Local Image', icon: <ImagePlus {...insertIcon()} /> },
    { id: 'equation', label: 'Equation', icon: <Sigma {...insertIcon()} /> },
  ],
];

const LINK_ITEMS: MenuItem[] = [
  { id: 'webpage', label: 'Webpage', icon: <Globe {...insertIcon()} /> },
  { id: 'topic', label: 'Topic', icon: <Bookmark {...insertIcon()} /> },
];

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <>
      <span className="insert-menu__icon" aria-hidden>
        {item.icon}
      </span>
      <span className="insert-menu__label">{item.label}</span>
      {item.hasSubmenu && <ChevronRight {...appIcon('insert-menu__chevron')} />}
    </>
  );
}

export function InsertMenu({
  open,
  onClose,
  linkSubmenuOpen,
  onLinkHover,
  onNote,
}: InsertMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open, onClose]);

  const handleItemClick = (itemId: string) => {
    if (itemId === 'note') {
      onNote?.();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="insert-menu" ref={menuRef}>
      {MENU_SECTIONS.map((section, sectionIndex) => (
        <div key={sectionIndex} className="insert-menu__section">
          {section.map((item) =>
            item.hasSubmenu ? (
              <div
                key={item.id}
                className="insert-menu__submenu-wrap"
                onMouseEnter={() => onLinkHover(true)}
                onMouseLeave={() => onLinkHover(false)}
              >
                <div
                  className={`insert-menu__item ${linkSubmenuOpen ? 'insert-menu__item--active' : ''}`}
                >
                  <MenuRow item={item} />
                </div>
                {linkSubmenuOpen && (
                  <div className="insert-menu__submenu">
                    {LINK_ITEMS.map((linkItem) => (
                      <button
                        key={linkItem.id}
                        type="button"
                        className="insert-menu__submenu-item"
                      >
                        <MenuRow item={linkItem} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                className="insert-menu__item insert-menu__item--button"
                onClick={() => handleItemClick(item.id)}
              >
                <MenuRow item={item} />
              </button>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

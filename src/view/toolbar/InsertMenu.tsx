import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronRightIcon } from './ToolbarIcons';
import {
  AttachmentIcon,
  EquationIcon,
  IllustrationIcon,
  LabelIcon,
  LinkIcon,
  LocalImageIcon,
  NoteIcon,
  StickerIcon,
  TaskIcon,
  TodoIcon,
  TopicLinkIcon,
  WebpageIcon,
  ZoneIcon,
} from './InsertMenuIcons';

interface InsertMenuProps {
  open: boolean;
  onClose: () => void;
  linkSubmenuOpen: boolean;
  onLinkHover: (open: boolean) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  hasSubmenu?: boolean;
}

const MENU_SECTIONS: MenuItem[][] = [
  [{ id: 'zone', label: 'Zone', icon: <ZoneIcon className="insert-menu__svg" /> }],
  [
    { id: 'note', label: 'Note', icon: <NoteIcon className="insert-menu__svg" /> },
    { id: 'label', label: 'Label', icon: <LabelIcon className="insert-menu__svg" /> },
    { id: 'todo', label: 'To-Do', icon: <TodoIcon className="insert-menu__svg" /> },
    { id: 'task', label: 'Task', icon: <TaskIcon className="insert-menu__svg" /> },
    {
      id: 'link',
      label: 'Link',
      icon: <LinkIcon className="insert-menu__svg" />,
      hasSubmenu: true,
    },
  ],
  [{ id: 'attachment', label: 'Attachment', icon: <AttachmentIcon className="insert-menu__svg" /> }],
  [
    { id: 'sticker', label: 'Sticker', icon: <StickerIcon className="insert-menu__svg" /> },
    {
      id: 'illustration',
      label: 'Illustration',
      icon: <IllustrationIcon className="insert-menu__svg" />,
    },
    {
      id: 'local-image',
      label: 'Local Image',
      icon: <LocalImageIcon className="insert-menu__svg" />,
    },
    { id: 'equation', label: 'Equation', icon: <EquationIcon className="insert-menu__svg" /> },
  ],
];

const LINK_ITEMS: MenuItem[] = [
  { id: 'webpage', label: 'Webpage', icon: <WebpageIcon className="insert-menu__svg" /> },
  { id: 'topic', label: 'Topic', icon: <TopicLinkIcon className="insert-menu__svg" /> },
];

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <>
      <span className="insert-menu__icon" aria-hidden>
        {item.icon}
      </span>
      <span className="insert-menu__label">{item.label}</span>
      {item.hasSubmenu && <ChevronRightIcon className="insert-menu__chevron" />}
    </>
  );
}

export function InsertMenu({ open, onClose, linkSubmenuOpen, onLinkHover }: InsertMenuProps) {
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
                      <button key={linkItem.id} type="button" className="insert-menu__submenu-item">
                        <MenuRow item={linkItem} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key={item.id} className="insert-menu__item">
                <MenuRow item={item} />
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

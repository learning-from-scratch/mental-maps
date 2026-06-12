import {
  Bookmark,
  ChevronRight,
  Cloud,
  ExternalLink,
  Globe,
  MessageSquare,
  Sigma,
  SquarePen,
  Sticker,
  Tag,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { appIcon } from '@/view/icons';

interface InsertMenuProps {
  open: boolean;
  hasSelection: boolean;
  linkSubmenuOpen: boolean;
  onLinkHover: (open: boolean) => void;
  onNote?: () => void;
  onLabel?: () => void;
  onWebpage?: () => void;
  onCloudStorage?: () => void;
  onEquation?: () => void;
  onComment?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  hasSubmenu?: boolean;
}

const insertIcon = (className = 'insert-menu__svg') => appIcon(className);

const LINK_ITEMS: MenuItem[] = [
  { id: 'webpage', label: 'Webpage', icon: <Globe {...insertIcon()} /> },
  { id: 'topic', label: 'Topic', icon: <Bookmark {...insertIcon()} /> },
];

const OTHER_SECTIONS: MenuItem[][] = [
  [{ id: 'cloud-storage', label: 'Cloud Storage', icon: <Cloud {...insertIcon()} /> }],
  [
    { id: 'sticker', label: 'Sticker', icon: <Sticker {...insertIcon()} /> },
    { id: 'equation', label: 'Equation', icon: <Sigma {...insertIcon()} /> },
  ],
];

function buildFirstSection(hasSelection: boolean): MenuItem[] {
  const section: MenuItem[] = [
    { id: 'note', label: 'Note', icon: <SquarePen {...insertIcon()} /> },
    { id: 'label', label: 'Label', icon: <Tag {...insertIcon()} /> },
  ];

  if (!hasSelection) {
    section.push({ id: 'comment', label: 'Comment', icon: <MessageSquare {...insertIcon()} /> });
  }

  section.push({
    id: 'link',
    label: 'Link',
    icon: <ExternalLink {...insertIcon()} />,
    hasSubmenu: true,
  });

  return section;
}

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

function isItemDisabled(itemId: string, hasSelection: boolean): boolean {
  if (itemId === 'comment') return false;
  return !hasSelection;
}

export function InsertMenu({
  open,
  hasSelection,
  linkSubmenuOpen,
  onLinkHover,
  onNote,
  onLabel,
  onWebpage,
  onCloudStorage,
  onEquation,
  onComment,
}: InsertMenuProps) {
  const handleItemClick = (itemId: string) => {
    if (isItemDisabled(itemId, hasSelection)) return;

    if (itemId === 'note') {
      onNote?.();
      return;
    }

    if (itemId === 'label') {
      onLabel?.();
      return;
    }

    if (itemId === 'cloud-storage') {
      onCloudStorage?.();
      return;
    }

    if (itemId === 'equation') {
      onEquation?.();
      return;
    }

    if (itemId === 'comment') {
      onComment?.();
    }
  };

  if (!open) return null;

  const sections = [buildFirstSection(hasSelection), ...OTHER_SECTIONS];

  return (
    <div className="insert-menu insert-menu--anchored">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="insert-menu__section">
          {section.map((item) =>
            item.hasSubmenu ? (
              <div
                key={item.id}
                className="insert-menu__submenu-wrap"
                onMouseEnter={() => {
                  if (!isItemDisabled(item.id, hasSelection)) onLinkHover(true);
                }}
                onMouseLeave={() => onLinkHover(false)}
              >
                <div
                  className={`insert-menu__item${
                    linkSubmenuOpen ? ' insert-menu__item--active' : ''
                  }${isItemDisabled(item.id, hasSelection) ? ' insert-menu__item--disabled' : ''}`}
                >
                  <MenuRow item={item} />
                </div>
                {linkSubmenuOpen && !isItemDisabled(item.id, hasSelection) && (
                  <div className="insert-menu__submenu">
                    {LINK_ITEMS.map((linkItem) => (
                      <button
                        key={linkItem.id}
                        type="button"
                        className="insert-menu__submenu-item"
                        onClick={() => {
                          if (linkItem.id === 'webpage') onWebpage?.();
                        }}
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
                className={`insert-menu__item insert-menu__item--button${
                  isItemDisabled(item.id, hasSelection) ? ' insert-menu__item--disabled' : ''
                }`}
                disabled={isItemDisabled(item.id, hasSelection)}
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

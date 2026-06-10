import { useState, type ReactNode } from 'react';
import type { TopicId } from '@/core/model/types';
import { InsertMenu } from './InsertMenu';
import {
  AddSiblingIcon,
  AddSubtopicIcon,
  BoundaryIcon,
  ChevronDownIcon,
  PlusIcon,
  RelationshipIcon,
  SummaryIcon,
} from './ToolbarIcons';

interface FloatingToolbarProps {
  selectedTopicId: TopicId | null;
}

interface ToolbarButton {
  id: string;
  icon: ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  isInsertMenu?: boolean;
}

function ToolbarButtonItem({
  button,
  hoveredId,
  insertOpen,
  onHover,
  onInsertToggle,
  onInsertClose,
  linkSubmenuOpen,
  onLinkHover,
}: {
  button: ToolbarButton;
  hoveredId: string | null;
  insertOpen: boolean;
  onHover: (id: string | null) => void;
  onInsertToggle: () => void;
  onInsertClose: () => void;
  linkSubmenuOpen: boolean;
  onLinkHover: (open: boolean) => void;
}) {
  return (
    <div className="floating-toolbar__item-wrap">
      <button
        type="button"
        className={`toolbar__button ${button.disabled ? 'toolbar__button--disabled' : ''} ${insertOpen && button.isInsertMenu ? 'toolbar__button--active' : ''}`}
        disabled={button.disabled}
        aria-label={button.label}
        onMouseEnter={() => onHover(button.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => {
          if (button.isInsertMenu) onInsertToggle();
        }}
      >
        {button.icon}
      </button>
      {hoveredId === button.id && !button.disabled && (
        <div className="toolbar__tooltip" role="tooltip">
          <span>{button.label}</span>
          {button.shortcut && <kbd className="toolbar__shortcut">{button.shortcut}</kbd>}
        </div>
      )}
      {button.isInsertMenu && (
        <InsertMenu
          open={insertOpen}
          onClose={onInsertClose}
          linkSubmenuOpen={linkSubmenuOpen}
          onLinkHover={onLinkHover}
        />
      )}
    </div>
  );
}

export function FloatingToolbar({ selectedTopicId }: FloatingToolbarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [linkSubmenuOpen, setLinkSubmenuOpen] = useState(false);

  const hasSelection = selectedTopicId !== null;
  const canUseStructureTools = false;

  const buttons: ToolbarButton[] = [
    {
      id: 'add-subtopic',
      icon: <AddSubtopicIcon className="toolbar__icon" />,
      label: 'Add subtopic',
      shortcut: 'Tab',
      disabled: !hasSelection,
    },
    {
      id: 'add-sibling',
      icon: <AddSiblingIcon className="toolbar__icon" />,
      label: 'Add topic after the selected topic',
      shortcut: 'Enter',
      disabled: !hasSelection,
    },
    {
      id: 'relationship',
      icon: <RelationshipIcon className="toolbar__icon" />,
      label: 'Add relationship',
      disabled: !canUseStructureTools,
    },
    {
      id: 'summary',
      icon: <SummaryIcon className="toolbar__icon" />,
      label: 'Add summary',
      disabled: !canUseStructureTools,
    },
    {
      id: 'boundary',
      icon: <BoundaryIcon className="toolbar__icon" />,
      label: 'Add boundary',
      disabled: !canUseStructureTools,
    },
    {
      id: 'insert-plus',
      icon: <PlusIcon className="toolbar__icon" />,
      label: 'Add content',
    },
    {
      id: 'insert-menu',
      icon: <ChevronDownIcon className="toolbar__icon" />,
      label: 'Insert / Add content',
      isInsertMenu: true,
    },
  ];

  const closeInsert = () => {
    setInsertOpen(false);
    setLinkSubmenuOpen(false);
  };

  return (
    <div className="floating-toolbar-wrap" role="toolbar" aria-label="Mind map tools">
      <div className="floating-toolbar">
        {buttons.map((button) => (
          <ToolbarButtonItem
            key={button.id}
            button={button}
            hoveredId={hoveredId}
            insertOpen={insertOpen}
            onHover={setHoveredId}
            onInsertToggle={() => setInsertOpen((open) => !open)}
            onInsertClose={closeInsert}
            linkSubmenuOpen={linkSubmenuOpen}
            onLinkHover={setLinkSubmenuOpen}
          />
        ))}
      </div>
    </div>
  );
}

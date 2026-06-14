import { CloudOff, Home, Menu } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { TopicId } from '@/core/model/types';
import type { SaveStatus } from '@/hooks/useDebouncedSave';
import { appIcon } from '@/view/icons';
import { MindMapIcons } from '@/view/icons/mindMapIcons';
import { InsertContentButton } from './InsertContentButton';
import { MainMenu } from './MainMenu';
import { ToolbarTooltip } from './ToolbarTooltip';

interface FloatingToolbarProps {
  selectedTopicId: TopicId | null;
  hasTopicSelection?: boolean;
  onInsertSibling: () => void;
   onInsertChild: () => void;
   onAddRelationship: () => void;
   relationshipModeActive?: boolean;
   onAddBoundary?: () => void;
   onAddContent: () => void;
   onAddLabel: () => void;
   onAddWebpage: () => void;
   onAddTopicLink: () => void;
   onAddCloudStorage: () => void;
   onAddEquation: () => void;
  onAddSticker: () => void;
  saveStatus?: SaveStatus;
  projectTitle: string;
  onRenameProject: (title: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onNewBlankMap?: () => void;
  onOpenHome?: () => void;
  onSignOut?: () => void;
}

interface ToolbarButton {
   id: string;
   icon: ReactNode;
   title: string;
   description: string;
   shortcut?: string;
   disabled?: boolean;
   active?: boolean;
   onClick?: () => void;
}

function ToolbarButtonItem({
   button,
   hoveredId,
   onHover,
}: {
   button: ToolbarButton;
   hoveredId: string | null;
   onHover: (id: string | null) => void;
}) {
   return (
      <div
         className="floating-toolbar__item-wrap"
         onMouseEnter={() => onHover(button.id)}
         onMouseLeave={() => onHover(null)}
      >
         <button
            type="button"
            className={`toolbar__button${button.disabled ? ' toolbar__button--disabled' : ''}${button.active ? ' toolbar__button--active' : ''}`}
            disabled={button.disabled}
            aria-label={button.description}
            onClick={() => button.onClick?.()}
         >
            {button.icon}
         </button>
         {hoveredId === button.id && (
            <ToolbarTooltip
               title={button.title}
               description={button.description}
               shortcut={button.shortcut}
            />
         )}
      </div>
   );
}

function saveStatusAriaLabel(status: SaveStatus | undefined): string {
   switch (status) {
      case 'idle':
         return 'Unsaved changes';
      case 'saving':
         return 'Saving';
      case 'saved':
         return 'Saved';
      case 'error':
         return 'Save failed';
      default:
         return 'Save status';
   }
}

function HollowCloudIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SavedCloudIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function EditableProjectTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLSpanElement>(null);
  const isEditingRef = useRef(false);

  const beginEdit = useCallback(() => {
    isEditingRef.current = true;
    setIsEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    isEditingRef.current = false;
    setIsEditing(false);
  }, []);

  const commitEdit = useCallback(() => {
    if (!isEditingRef.current) return;
    const nextTitle = editorRef.current?.textContent?.replace(/\n/g, '').trim() ?? '';
    isEditingRef.current = false;
    setIsEditing(false);
    if (!nextTitle || nextTitle === title) return;
    onRename(nextTitle);
  }, [onRename, title]);

  useLayoutEffect(() => {
    if (!isEditing) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (editorRef.current?.contains(target)) return;
      commitEdit();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isEditing, commitEdit]);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = title;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing, title]);

  if (isEditing) {
    return (
      <span
        ref={editorRef}
        className="project-toolbar__title project-toolbar__title--editing"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-label="Project name"
        onBlur={commitEdit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitEdit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelEdit();
          }
        }}
        onInput={(event) => {
          const editor = event.currentTarget;
          if (editor.textContent?.includes('\n')) {
            editor.textContent = editor.textContent.replace(/\n/g, '');
          }
        }}
      />
    );
  }

  return (
    <span
      className="project-toolbar__title project-toolbar__title--editable"
      role="button"
      tabIndex={0}
      aria-label={`Project name: ${title}. Click to rename.`}
      onClick={beginEdit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          beginEdit();
        }
      }}
    >
      {title}
    </span>
  );
}

function ProjectSaveStatus({ status }: { status?: SaveStatus }) {
   if (!status) return null;

   let icon: ReactNode;
   if (status === 'saved') {
      icon = <SavedCloudIcon className="project-toolbar__save-icon" />;
   } else if (status === 'saving') {
      icon = <SavedCloudIcon className="project-toolbar__save-icon" />;
   } else if (status === 'error') {
      icon = <CloudOff {...appIcon('project-toolbar__save-icon')} />;
   } else {
      icon = <HollowCloudIcon className="project-toolbar__save-icon" />;
   }

   return (
      <span
         className={`project-toolbar__save-status project-toolbar__save-status--${status}`}
         aria-label={saveStatusAriaLabel(status)}
         title={saveStatusAriaLabel(status)}
         aria-live="polite"
      >
         {icon}
      </span>
   );
}

function ProjectSwitcher({
  projectTitle,
  saveStatus,
  onRenameProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewBlankMap,
  onOpenHome,
  onSignOut,
}: {
  projectTitle: string;
  saveStatus?: SaveStatus;
  onRenameProject: (title: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewBlankMap: () => void;
  onOpenHome: () => void;
  onSignOut?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuWrapRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen, closeMenu]);

  const runMenuAction = (action: () => void) => {
    action();
    closeMenu();
  };

  return (
    <div className="project-toolbar" aria-label="Project navigation">
      <div
        ref={menuWrapRef}
        className={`project-toolbar__menu-wrap${menuOpen ? ' project-toolbar__menu-wrap--open' : ''}`}
      >
        <button
          type="button"
          className="project-toolbar__menu"
          aria-label="Open main menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu {...appIcon('project-toolbar__menu-icon')} />
        </button>
        <MainMenu
          open={menuOpen}
          canUndo={canUndo}
          canRedo={canRedo}
          showSignOut={Boolean(onSignOut)}
          onUndo={() => runMenuAction(onUndo)}
          onRedo={() => runMenuAction(onRedo)}
          onNewBlankMap={() => runMenuAction(onNewBlankMap)}
          onOpenHome={() => runMenuAction(onOpenHome)}
          onSignOut={onSignOut ? () => runMenuAction(onSignOut) : undefined}
        />
      </div>
      <button
        type="button"
        className="project-toolbar__home"
        aria-label="Go to my works"
        onClick={onOpenHome}
      >
        <Home {...appIcon('project-toolbar__home-icon')} />
      </button>
      <div className="project-toolbar__meta">
        <EditableProjectTitle title={projectTitle} onRename={onRenameProject} />
        <ProjectSaveStatus status={saveStatus} />
      </div>
    </div>
  );
}

export function FloatingToolbar({
  selectedTopicId,
  hasTopicSelection,
  onInsertSibling,
   onInsertChild,
   onAddRelationship,
   relationshipModeActive = false,
   onAddBoundary,
   onAddContent,
   onAddLabel,
   onAddWebpage,
   onAddTopicLink,
   onAddCloudStorage,
   onAddEquation,
  onAddSticker,
  saveStatus,
  projectTitle,
  onRenameProject,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onNewBlankMap,
  onOpenHome,
  onSignOut,
}: FloatingToolbarProps) {
   const [hoveredId, setHoveredId] = useState<string | null>(null);

   const hasSelection = hasTopicSelection ?? selectedTopicId !== null;
   const canUseSummary = false;

   const buttons: ToolbarButton[] = [
      {
         id: 'add-subtopic',
         icon: <MindMapIcons.Topic className="toolbar__icon" />,
         title: 'Topic',
         shortcut: 'Enter',
         description: 'Add a topic after a selected topic',
         disabled: !hasSelection,
         onClick: onInsertSibling,
      },
      {
         id: 'add-sibling',
         icon: <MindMapIcons.Subtopic className="toolbar__icon" />,
         title: 'Subtopic',
         shortcut: 'Tab',
         description: 'Add a child topic to the selected topic',
         disabled: !hasSelection,
         onClick: onInsertChild,
      },
      {
         id: 'relationship',
         icon: <MindMapIcons.Relationship className="toolbar__icon" />,
         title: 'Relationship',
         shortcut: 'Ctrl Shift R',
         description: 'Create a relationship between the two topics',
         active: relationshipModeActive,
         onClick: onAddRelationship,
      },
      {
         id: 'summary',
         icon: <MindMapIcons.Summary className="toolbar__icon" />,
         title: 'Summary',
         description: 'Add a summary to the selected topics',
         disabled: !hasSelection || !canUseSummary,
      },
      {
         id: 'boundary',
         icon: <MindMapIcons.Boundary className="toolbar__icon" />,
         title: 'Boundary',
         shortcut: 'Ctrl Shift B',
         description: 'Group the selected topics with boundary',
         disabled: !hasSelection,
         onClick: onAddBoundary,
      },
   ];

   return (
      <div className="floating-toolbar-wrap" role="toolbar" aria-label="Mind map tools">
      <ProjectSwitcher
        projectTitle={projectTitle}
        saveStatus={saveStatus}
        onRenameProject={onRenameProject}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo ?? (() => {})}
        onRedo={onRedo ?? (() => {})}
        onNewBlankMap={onNewBlankMap ?? (() => {})}
        onOpenHome={onOpenHome ?? (() => {})}
        onSignOut={onSignOut}
      />
         <div className="floating-toolbar" aria-label="Topic editing tools">
            {buttons.map((button, index) => (
               <Fragment key={button.id}>
                  {index === 2 && <div className="floating-toolbar__separator" aria-hidden="true" />}
                  <ToolbarButtonItem
                     button={button}
                     hoveredId={hoveredId}
                     onHover={setHoveredId}
                  />
               </Fragment>
            ))}
            <InsertContentButton
               hasSelection={hasSelection}
               onAddNote={onAddContent}
               onAddLabel={onAddLabel}
               onAddWebpage={onAddWebpage}
               onAddTopicLink={onAddTopicLink}
               onAddCloudStorage={onAddCloudStorage}
               onAddEquation={onAddEquation}
               onAddSticker={onAddSticker}
            />
         </div>
      </div>
   );
}

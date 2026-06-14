import { Cloud, Plus, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import type { Sheet } from '@/core/model/types';
import { appIcon } from '@/view/icons';
import { MapThumbnail } from './MapThumbnail';
import { ProjectContextMenu } from './ProjectContextMenu';

export interface RecentsProject {
  id: string;
  title: string;
  createdAt?: number;
  firstSheet: Sheet | undefined;
}

function projectSortTime(project: RecentsProject): number {
  if (project.createdAt) return project.createdAt;
  const localMatch = /^local-(\d+)$/.exec(project.id);
  if (localMatch) return Number(localMatch[1]);
  return 0;
}

interface RecentsModalProps {
  projects: RecentsProject[];
  showCloudIcon?: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onNewBlankMap: () => void;
  onRenameProject: (projectId: string, title: string) => void;
  onRemoveProject: (projectId: string) => void;
}

function EditableProjectLabel({
  title,
  isEditing,
  onBeginEdit,
  onCommit,
  onCancelEdit,
}: {
  title: string;
  isEditing: boolean;
  onBeginEdit: () => void;
  onCommit: (title: string) => void;
  onCancelEdit: () => void;
}) {
  const editorRef = useRef<HTMLSpanElement>(null);
  const isEditingRef = useRef(false);

  const commitEdit = useCallback(() => {
    if (!isEditingRef.current) return;
    const nextTitle = editorRef.current?.textContent?.replace(/\n/g, '').trim() ?? '';
    isEditingRef.current = false;
    if (!nextTitle || nextTitle === title) {
      onCancelEdit();
      return;
    }
    onCommit(nextTitle);
  }, [onCancelEdit, onCommit, title]);

  const cancelEdit = useCallback(() => {
    isEditingRef.current = false;
    onCancelEdit();
  }, [onCancelEdit]);

  useLayoutEffect(() => {
    isEditingRef.current = isEditing;
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
        className="recents-card__label recents-card__label--editing"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-label="Project name"
        onBlur={commitEdit}
        onKeyDown={(event) => {
          event.stopPropagation();
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
        onClick={(event) => event.stopPropagation()}
      />
    );
  }

  return (
    <span
      className="recents-card__label"
      title={title}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onBeginEdit();
      }}
    >
      {title}
    </span>
  );
}

export function RecentsModal({
  projects,
  showCloudIcon = false,
  onClose,
  onSelectProject,
  onNewBlankMap,
  onRenameProject,
  onRemoveProject,
}: RecentsModalProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    projectId: string;
    left: number;
    top: number;
  } | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = !query
      ? projects
      : projects.filter((project) => project.title.toLowerCase().includes(query));
    return [...matches].sort((a, b) => projectSortTime(a) - projectSortTime(b));
  }, [projects, searchQuery]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (renamingProjectId) return;
      if (contextMenu) {
        event.stopPropagation();
        setContextMenu(null);
        return;
      }
      if (searchOpen) {
        event.stopPropagation();
        setSearchOpen(false);
        setSearchQuery('');
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, searchOpen, contextMenu, renamingProjectId]);

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setSearchQuery('');
      return !open;
    });
  };

  const openContextMenu = (projectId: string, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      projectId,
      left: event.clientX,
      top: event.clientY,
    });
  };

  return (
    <div
      className="recents-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="recents-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Recents"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="recents-modal__header">
          {searchOpen ? (
            <input
              ref={searchInputRef}
              type="search"
              className="recents-modal__search"
              placeholder="Search projects…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search projects"
            />
          ) : (
            <h2 className="recents-modal__title">Recents</h2>
          )}
          <div className="recents-modal__controls">
            <button
              type="button"
              className={`recents-modal__control${
                searchOpen ? ' recents-modal__control--active' : ''
              }`}
              aria-label={searchOpen ? 'Close search' : 'Search projects'}
              aria-pressed={searchOpen}
              onClick={toggleSearch}
            >
              <Search {...appIcon('recents-modal__control-icon')} />
            </button>
            <button
              type="button"
              className="recents-modal__control"
              aria-label="Close"
              onClick={onClose}
            >
              <X {...appIcon('recents-modal__control-icon')} />
            </button>
          </div>
        </header>

        <div className="recents-modal__grid">
          <button
            type="button"
            className="recents-card recents-card--new"
            onClick={() => {
              onNewBlankMap();
              onClose();
            }}
          >
            <div className="recents-card__preview recents-card__preview--new">
              <Plus {...appIcon('recents-card__new-icon')} />
            </div>
            <span className="recents-card__label">New Project</span>
          </button>

          {filteredProjects.map((project) => {
            const isRenaming = renamingProjectId === project.id;

            return (
              <div
                key={project.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(project.id, node);
                  else cardRefs.current.delete(project.id);
                }}
                className={`recents-card${isRenaming ? ' recents-card--renaming' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isRenaming) return;
                  onSelectProject(project.id);
                  onClose();
                }}
                onKeyDown={(event) => {
                  if (isRenaming) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectProject(project.id);
                    onClose();
                  }
                }}
                onContextMenu={(event) => openContextMenu(project.id, event)}
              >
                <div className="recents-card__preview">
                  {project.firstSheet ? (
                    <MapThumbnail sheet={project.firstSheet} />
                  ) : (
                    <div className="recents-card__empty" aria-hidden="true" />
                  )}
                </div>
                <span className="recents-card__meta">
                  {showCloudIcon ? (
                    <Cloud {...appIcon('recents-card__cloud-icon')} aria-hidden="true" />
                  ) : null}
                  <EditableProjectLabel
                    title={project.title}
                    isEditing={isRenaming}
                    onBeginEdit={() => setRenamingProjectId(project.id)}
                    onCommit={(title) => {
                      onRenameProject(project.id, title);
                      setRenamingProjectId(null);
                    }}
                    onCancelEdit={() => setRenamingProjectId(null)}
                  />
                </span>
              </div>
            );
          })}

          {filteredProjects.length === 0 && searchQuery.trim() ? (
            <p className="recents-modal__empty">No projects match your search.</p>
          ) : null}
        </div>
      </div>

      {contextMenu ? (
        <ProjectContextMenu
          anchorRef={{ current: cardRefs.current.get(contextMenu.projectId) ?? null }}
          position={{ left: contextMenu.left, top: contextMenu.top }}
          onRename={() => setRenamingProjectId(contextMenu.projectId)}
          onRemove={() => onRemoveProject(contextMenu.projectId)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}

import {
  ArrowRightToLine,
  Braces,
  ChevronDown,
  ChevronRight,
  Home,
  ListTree,
  Menu,
  Plus,
  SquareDashed,
  Waypoints,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { TopicId } from '@/core/model/types';
import { appIcon } from '@/view/icons';
import { InsertMenu } from './InsertMenu';

export interface ProjectSummary {
  id: string;
  title: string;
}

interface FloatingToolbarProps {
  selectedTopicId: TopicId | null;
  projects: ProjectSummary[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onAddContent: () => void;
}

interface ToolbarButton {
  id: string;
  icon: ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  isInsertMenu?: boolean;
  onClick?: () => void;
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
  onAddContent,
}: {
  button: ToolbarButton;
  hoveredId: string | null;
  insertOpen: boolean;
  onHover: (id: string | null) => void;
  onInsertToggle: () => void;
  onInsertClose: () => void;
  linkSubmenuOpen: boolean;
  onLinkHover: (open: boolean) => void;
  onAddContent: () => void;
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
          else button.onClick?.();
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
          onNote={onAddContent}
        />
      )}
    </div>
  );
}

function ProjectSwitcher({
  projects,
  activeProjectId,
  projectOpen,
  onProjectToggle,
  onProjectClose,
  onSelectProject,
  onCreateProject,
}: {
  projects: ProjectSummary[];
  activeProjectId: string;
  projectOpen: boolean;
  onProjectToggle: () => void;
  onProjectClose: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
}) {
  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    <div className="project-toolbar" aria-label="Project navigation">
      <button type="button" className="project-toolbar__menu" aria-label="Open main menu">
        <Menu {...appIcon('project-toolbar__menu-icon')} />
      </button>
      <button type="button" className="project-toolbar__home" aria-label="Go to my works">
        <Home {...appIcon('project-toolbar__home-icon')} />
      </button>
      <div className="project-toolbar__meta">
        <button
          type="button"
          className="project-toolbar__title-button"
          aria-label="Switch project"
          aria-expanded={projectOpen}
          onClick={onProjectToggle}
        >
          <span className="project-toolbar__title">{activeProject?.title ?? 'Untitled'}</span>
          <ChevronDown {...appIcon('project-toolbar__chevron')} />
        </button>
        <div className="project-toolbar__crumbs" aria-label="Project location">
          <span>My Works</span>
          <ChevronRight {...appIcon('project-toolbar__crumb-icon')} />
          <span>All</span>
        </div>
        {projectOpen && (
          <div className="project-menu">
            <div className="project-menu__list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`project-menu__item ${project.id === activeProjectId ? 'project-menu__item--active' : ''}`}
                  onClick={() => {
                    onSelectProject(project.id);
                    onProjectClose();
                  }}
                >
                  {project.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="project-menu__create"
              onClick={() => {
                onCreateProject();
                onProjectClose();
              }}
            >
              New project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FloatingToolbar({
  selectedTopicId,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onAddContent,
}: FloatingToolbarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [linkSubmenuOpen, setLinkSubmenuOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const hasSelection = selectedTopicId !== null;
  const canUseStructureTools = false;

  const buttons: ToolbarButton[] = [
    {
      id: 'add-subtopic',
      icon: <ListTree {...appIcon('toolbar__icon')} />,
      label: 'Add subtopic',
      shortcut: 'Tab',
      disabled: !hasSelection,
    },
    {
      id: 'add-sibling',
      icon: <ArrowRightToLine {...appIcon('toolbar__icon')} />,
      label: 'Add topic after the selected topic',
      shortcut: 'Enter',
      disabled: !hasSelection,
    },
    {
      id: 'relationship',
      icon: <Waypoints {...appIcon('toolbar__icon')} />,
      label: 'Add relationship',
      disabled: !canUseStructureTools,
    },
    {
      id: 'summary',
      icon: <Braces {...appIcon('toolbar__icon')} />,
      label: 'Add summary',
      disabled: !canUseStructureTools,
    },
    {
      id: 'boundary',
      icon: <SquareDashed {...appIcon('toolbar__icon')} />,
      label: 'Add boundary',
      disabled: !canUseStructureTools,
    },
    {
      id: 'insert-plus',
      icon: <Plus {...appIcon('toolbar__icon')} />,
      label: 'Add content',
      disabled: !hasSelection,
      onClick: onAddContent,
    },
    {
      id: 'insert-menu',
      icon: <ChevronDown {...appIcon('toolbar__icon')} />,
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
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        projectOpen={projectOpen}
        onProjectToggle={() => setProjectOpen((open) => !open)}
        onProjectClose={() => setProjectOpen(false)}
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
      />
      <div className="floating-toolbar" aria-label="Topic editing tools">
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
            onAddContent={onAddContent}
          />
        ))}
      </div>
    </div>
  );
}

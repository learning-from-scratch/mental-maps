import { ChevronDown, ChevronRight, Home, Menu } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import type { TopicId } from '@/core/model/types';
import { appIcon } from '@/view/icons';
import { MindMapIcons } from '@/view/icons/mindMapIcons';
import { InsertContentButton } from './InsertContentButton';
import { ToolbarTooltip } from './ToolbarTooltip';

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
  onInsertSibling: () => void;
  onInsertChild: () => void;
  onAddContent: () => void;
  onAddLabel: () => void;
  onAddWebpage: () => void;
  onAddTopicLink: () => void;
  onAddCloudStorage: () => void;
  onAddEquation: () => void;
  onAddComment: () => void;
  onAddSticker: () => void;
}

interface ToolbarButton {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  shortcut?: string;
  disabled?: boolean;
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
        className={`toolbar__button ${button.disabled ? 'toolbar__button--disabled' : ''}`}
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
  onInsertSibling,
  onInsertChild,
  onAddContent,
  onAddLabel,
  onAddWebpage,
  onAddTopicLink,
  onAddCloudStorage,
  onAddEquation,
  onAddComment,
  onAddSticker,
}: FloatingToolbarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [projectOpen, setProjectOpen] = useState(false);

  const hasSelection = selectedTopicId !== null;
  const canUseStructureTools = false;

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
      disabled: hasSelection && !canUseStructureTools,
    },
    {
      id: 'summary',
      icon: <MindMapIcons.Summary className="toolbar__icon" />,
      title: 'Summary',
      description: 'Add a summary to the selected topics',
      disabled: !hasSelection || !canUseStructureTools,
    },
    {
      id: 'boundary',
      icon: <MindMapIcons.Boundary className="toolbar__icon" />,
      title: 'Boundary',
      shortcut: 'Ctrl Shift B',
      description: 'Group the selected topics with boundary',
      disabled: !hasSelection || !canUseStructureTools,
    },
  ];

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
          onAddComment={onAddComment}
          onAddSticker={onAddSticker}
        />
      </div>
    </div>
  );
}

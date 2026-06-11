interface ToolbarTooltipProps {
  title: string;
  description: string;
  shortcut?: string;
}

export function ToolbarTooltip({ title, description, shortcut }: ToolbarTooltipProps) {
  return (
    <div className="toolbar__tooltip" role="tooltip">
      <div className="toolbar__tooltip-header">
        <span className="toolbar__tooltip-title">{title}</span>
        {shortcut && <span className="toolbar__tooltip-shortcut">{shortcut}</span>}
      </div>
      <p className="toolbar__tooltip-description">{description}</p>
    </div>
  );
}

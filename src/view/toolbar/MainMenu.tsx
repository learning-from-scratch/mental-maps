interface MainMenuProps {
  open: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showSignOut: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewBlankMap: () => void;
  onOpenHome: () => void;
  onSignOut?: () => void;
}

interface MenuItemProps {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}

function MenuItem({ label, shortcut, disabled, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      className="main-menu__item"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="main-menu__label">{label}</span>
      {shortcut ? <span className="main-menu__shortcut">{shortcut}</span> : null}
    </button>
  );
}

export function MainMenu({
  open,
  canUndo,
  canRedo,
  showSignOut,
  onUndo,
  onRedo,
  onNewBlankMap,
  onOpenHome,
  onSignOut,
}: MainMenuProps) {
  if (!open) return null;

  return (
    <div className="main-menu" role="menu">
      <MenuItem label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
      <MenuItem label="Redo" shortcut="Ctrl+Y" disabled={!canRedo} onClick={onRedo} />
      <div className="main-menu__divider" role="separator" />
      <MenuItem label="New Blank Map" shortcut="Ctrl+N" onClick={onNewBlankMap} />
      <MenuItem label="Open Home" shortcut="Ctrl+H" onClick={onOpenHome} />
      {showSignOut ? (
        <>
          <div className="main-menu__divider" role="separator" />
          <MenuItem label="Sign out" onClick={() => onSignOut?.()} />
        </>
      ) : null}
    </div>
  );
}

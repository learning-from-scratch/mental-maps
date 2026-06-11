import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Sheet, SheetId } from '@/core/model/types';
import { appIcon } from '@/view/icons';
import { RenameSheetModal } from './RenameSheetModal';
import { SheetTabMenu } from './SheetTabMenu';

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];

interface BottomPanelProps {
  projectId: string;
  sheets: SheetId[];
  sheetsById: Record<SheetId, Sheet>;
  activeSheetId: SheetId;
  topicCount: number;
  zoom: number;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onSignOut?: () => void;
  onSelectSheet: (sheetId: SheetId) => void;
  onRenameSheet: (sheetId: SheetId, title: string) => void;
  onDuplicateSheet: (sheetId: SheetId) => void;
  onDeleteSheet: (sheetId: SheetId) => void;
  onAddSheet: () => void;
  onZoomChange: (zoom: number) => void;
}

function truncateTitle(title: string, maxLength = 28): string {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 1)}…`;
}

function saveStatusLabel(status: BottomPanelProps['saveStatus']): string | null {
  switch (status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Save failed';
    default:
      return null;
  }
}

function buildSheetLink(projectId: string, sheetId: SheetId): string {
  const url = new URL(window.location.href);
  url.searchParams.set('project', projectId);
  url.searchParams.set('sheet', sheetId);
  return url.toString();
}

interface SheetTabProps {
  sheet: Sheet;
  isActive: boolean;
  canDelete: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onCopyLink: (sheetId: SheetId) => void;
  onRename: (sheetId: SheetId) => void;
  onDuplicate: (sheetId: SheetId) => void;
  onDelete: (sheetId: SheetId) => void;
}

function SheetTab({
  sheet,
  isActive,
  canDelete,
  menuOpen,
  onSelect,
  onOpenMenu,
  onCloseMenu,
  onCopyLink,
  onRename,
  onDuplicate,
  onDelete,
}: SheetTabProps) {
  const tabRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={tabRef}
      className={`bottom-panel__tab-wrap${isActive ? ' bottom-panel__tab-wrap--active' : ''}${
        menuOpen ? ' bottom-panel__tab-wrap--menu-open' : ''
      }`}
    >
      <button
        type="button"
        className="bottom-panel__tab"
        onClick={onSelect}
        onDoubleClick={(event) => {
          event.preventDefault();
          onSelect();
          onRename(sheet.id);
        }}
        title={sheet.title}
      >
        <span className="bottom-panel__tab-label">{truncateTitle(sheet.title)}</span>
      </button>
      <button
        type="button"
        className="bottom-panel__tab-caret"
        aria-label={`Options for ${sheet.title}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (menuOpen) onCloseMenu();
          else onOpenMenu();
        }}
      >
        <ChevronDown {...appIcon('bottom-panel__tab-caret-icon')} />
      </button>
      {menuOpen ? (
        <SheetTabMenu
          sheetId={sheet.id}
          canDelete={canDelete}
          anchorRef={tabRef}
          onCopyLink={onCopyLink}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onClose={onCloseMenu}
        />
      ) : null}
    </div>
  );
}

export function BottomPanel({
  projectId,
  sheets,
  sheetsById,
  activeSheetId,
  topicCount,
  zoom,
  saveStatus,
  onSignOut,
  onSelectSheet,
  onRenameSheet,
  onDuplicateSheet,
  onDeleteSheet,
  onAddSheet,
  onZoomChange,
}: BottomPanelProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [renamingSheetId, setRenamingSheetId] = useState<SheetId | null>(null);
  const [menuSheetId, setMenuSheetId] = useState<SheetId | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const zoomRef = useRef<HTMLDivElement>(null);
  const renamingSheet = renamingSheetId ? sheetsById[renamingSheetId] : null;
  const canDeleteSheet = sheets.length > 1;

  useEffect(() => {
    if (!zoomOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!zoomRef.current?.contains(event.target as Node)) {
        setZoomOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [zoomOpen]);

  useEffect(() => {
    if (!linkCopied) return;
    const timer = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  const handleCopyLink = async (sheetId: SheetId) => {
    try {
      await navigator.clipboard.writeText(buildSheetLink(projectId, sheetId));
      setLinkCopied(true);
    } catch {
      // Clipboard may be unavailable outside secure context.
    }
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <footer className="bottom-panel">
      <div className="bottom-panel__tabs">
        {sheets.map((sheetId) => {
          const sheet = sheetsById[sheetId];
          if (!sheet) return null;
          const isActive = sheetId === activeSheetId;

          return (
            <SheetTab
              key={sheetId}
              sheet={sheet}
              isActive={isActive}
              canDelete={canDeleteSheet}
              menuOpen={menuSheetId === sheetId}
              onSelect={() => {
                setMenuSheetId(null);
                onSelectSheet(sheetId);
              }}
              onOpenMenu={() => setMenuSheetId(sheetId)}
              onCloseMenu={() => setMenuSheetId(null)}
              onCopyLink={handleCopyLink}
              onRename={setRenamingSheetId}
              onDuplicate={onDuplicateSheet}
              onDelete={onDeleteSheet}
            />
          );
        })}
        <span className="bottom-panel__divider" aria-hidden="true" />
        <button
          type="button"
          className="bottom-panel__add"
          onClick={onAddSheet}
          aria-label="Add mind map"
          title="Add mind map"
        >
          <Plus {...appIcon('bottom-panel__add-icon')} />
        </button>
      </div>

      <div className="bottom-panel__stats">
        {linkCopied ? (
          <>
            <span className="bottom-panel__save-status">Link copied</span>
            <span className="bottom-panel__divider" aria-hidden="true" />
          </>
        ) : null}
        {saveStatusLabel(saveStatus) ? (
          <>
            <span
              className={`bottom-panel__save-status${
                saveStatus === 'error' ? ' bottom-panel__save-status--error' : ''
              }`}
            >
              {saveStatusLabel(saveStatus)}
            </span>
            <span className="bottom-panel__divider" aria-hidden="true" />
          </>
        ) : null}
        <span className="bottom-panel__topic-count">Topics: {topicCount}</span>
        <span className="bottom-panel__divider" aria-hidden="true" />
        {onSignOut ? (
          <>
            <button type="button" className="bottom-panel__sign-out" onClick={onSignOut}>
              Sign out
            </button>
            <span className="bottom-panel__divider" aria-hidden="true" />
          </>
        ) : null}
        <div className="bottom-panel__zoom" ref={zoomRef}>
          <button
            type="button"
            className="bottom-panel__zoom-button"
            onClick={() => setZoomOpen((open) => !open)}
            aria-expanded={zoomOpen}
            aria-haspopup="listbox"
          >
            {zoomPercent}%
            <ChevronDown {...appIcon('bottom-panel__zoom-chevron')} />
          </button>
          {zoomOpen && (
            <ul className="bottom-panel__zoom-menu" role="listbox">
              {ZOOM_PRESETS.map((preset) => (
                <li key={preset}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={Math.round(preset * 100) === zoomPercent}
                    className={`bottom-panel__zoom-option${
                      Math.round(preset * 100) === zoomPercent
                        ? ' bottom-panel__zoom-option--active'
                        : ''
                    }`}
                    onClick={() => {
                      onZoomChange(preset);
                      setZoomOpen(false);
                    }}
                  >
                    {Math.round(preset * 100)}%
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {renamingSheet && renamingSheetId ? (
        <RenameSheetModal
          sheetId={renamingSheetId}
          initialTitle={renamingSheet.title}
          onConfirm={(sheetId, title) => {
            onRenameSheet(sheetId, title);
            setRenamingSheetId(null);
          }}
          onCancel={() => setRenamingSheetId(null)}
        />
      ) : null}
    </footer>
  );
}

import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { collectDescendantIds } from '@/core/commands/tree';
import { topicDisplayText } from '@/core/model/link';
import type { ProjectState } from '@/core/model/project';
import type { Sheet, SheetId, TopicId } from '@/core/model/types';
import { appIcon } from '@/view/icons';

export interface TopicLinkSelection {
  sheetId: SheetId;
  topicId: TopicId;
}

interface InsertTopicLinkModalProps {
  project: ProjectState;
  sourceSheetId: SheetId;
  sourceTopicId: TopicId;
  initialSelection?: TopicLinkSelection;
  onInsert: (selection: TopicLinkSelection, bidirectional: boolean) => void;
  onCancel: () => void;
}

function countDescendants(sheet: Sheet, topicId: TopicId): number {
  return collectDescendantIds(sheet, topicId).length;
}

function topicMatchesQuery(text: string, query: string): boolean {
  return topicDisplayText(text).toLowerCase().includes(query);
}

function sheetHasMatchingTopic(sheet: Sheet, query: string): boolean {
  return Object.values(sheet.topicsById).some((topic) => topicMatchesQuery(topic.text, query));
}

function subtreeHasMatch(
  sheet: Sheet,
  topicId: TopicId,
  query: string,
  invalidIds: Set<TopicId>,
): boolean {
  const topic = sheet.topicsById[topicId];
  if (!topic) return false;
  if (!invalidIds.has(topicId) && topicMatchesQuery(topic.text, query)) return true;
  return topic.childrenIds.some((childId) => subtreeHasMatch(sheet, childId, query, invalidIds));
}

interface TopicTreeNodeProps {
  sheet: Sheet;
  topicId: TopicId;
  selectedTopicId: TopicId | null;
  invalidIds: Set<TopicId>;
  expandedIds: Set<string>;
  searchQuery: string;
  onToggleExpand: (key: string) => void;
  onSelect: (topicId: TopicId) => void;
}

function TopicTreeNode({
  sheet,
  topicId,
  selectedTopicId,
  invalidIds,
  expandedIds,
  searchQuery,
  onToggleExpand,
  onSelect,
}: TopicTreeNodeProps) {
  const topic = sheet.topicsById[topicId];
  if (!topic) return null;

  const isInvalid = invalidIds.has(topicId);
  const childCount = topic.childrenIds.length;
  const hasChildren = childCount > 0;
  const expandKey = `${sheet.id}:${topicId}`;
  const isSearching = searchQuery.length > 0;
  const matchesSearch = !isSearching || topicMatchesQuery(topic.text, searchQuery);
  const childHasMatch =
    isSearching &&
    topic.childrenIds.some((childId) =>
      subtreeHasMatch(sheet, childId, searchQuery, invalidIds),
    );
  const expanded = isSearching ? matchesSearch || childHasMatch : expandedIds.has(expandKey);
  const selectable = !isInvalid;

  if (isSearching && !matchesSearch && !childHasMatch) return null;

  return (
    <>
      <div
        className={`topic-link-modal__row topic-link-modal__row--topic${
          selectedTopicId === topicId ? ' topic-link-modal__row--selected' : ''
        }${!selectable ? ' topic-link-modal__row--disabled' : ''}`}
      >
        {hasChildren ? (
          <button
            type="button"
            className="topic-link-modal__expand"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={() => onToggleExpand(expandKey)}
          >
            {expanded ? (
              <ChevronDown {...appIcon('topic-link-modal__expand-icon')} />
            ) : (
              <ChevronRight {...appIcon('topic-link-modal__expand-icon')} />
            )}
          </button>
        ) : (
          <span className="topic-link-modal__bullet" aria-hidden />
        )}
        <button
          type="button"
          className="topic-link-modal__label-button"
          disabled={!selectable}
          onClick={() => {
            if (selectable) onSelect(topicId);
          }}
        >
          <span className="topic-link-modal__label">{topicDisplayText(topic.text)}</span>
          {hasChildren ? (
            <span className="topic-link-modal__badge">{countDescendants(sheet, topicId)}</span>
          ) : null}
        </button>
      </div>
      {hasChildren && expanded ? (
        <div className="topic-link-modal__branch">
          {topic.childrenIds.map((childId) => (
            <TopicTreeNode
              key={childId}
              sheet={sheet}
              topicId={childId}
              selectedTopicId={selectedTopicId}
              invalidIds={invalidIds}
              expandedIds={expandedIds}
              searchQuery={searchQuery}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

interface SheetTreeNodeProps {
  sheet: Sheet;
  selected: TopicLinkSelection | null;
  invalidIds: Set<TopicId>;
  expandedIds: Set<string>;
  searchQuery: string;
  onToggleExpand: (key: string) => void;
  onSelect: (sheetId: SheetId, topicId: TopicId) => void;
}

function SheetTreeNode({
  sheet,
  selected,
  invalidIds,
  expandedIds,
  searchQuery,
  onToggleExpand,
  onSelect,
}: SheetTreeNodeProps) {
  const isSearching = searchQuery.length > 0;
  const sheetMatches =
    !isSearching ||
    sheet.title.toLowerCase().includes(searchQuery) ||
    sheetHasMatchingTopic(sheet, searchQuery);
  const expandKey = `sheet:${sheet.id}`;
  const expanded = isSearching ? sheetMatches : expandedIds.has(expandKey);
  const topicCount = Object.keys(sheet.topicsById).length;

  if (!sheetMatches) return null;

  return (
    <>
      <div className="topic-link-modal__row topic-link-modal__row--sheet">
        <button
          type="button"
          className="topic-link-modal__expand"
          aria-label={expanded ? 'Collapse map' : 'Expand map'}
          onClick={() => onToggleExpand(expandKey)}
        >
          {expanded ? (
            <ChevronDown {...appIcon('topic-link-modal__expand-icon')} />
          ) : (
            <ChevronRight {...appIcon('topic-link-modal__expand-icon')} />
          )}
        </button>
        <span className="topic-link-modal__label">{sheet.title}</span>
        <span className="topic-link-modal__badge">{topicCount}</span>
      </div>
      {expanded ? (
        <div className="topic-link-modal__branch">
          <TopicTreeNode
            sheet={sheet}
            topicId={sheet.rootTopicId}
            selectedTopicId={selected?.sheetId === sheet.id ? selected.topicId : null}
            invalidIds={invalidIds}
            expandedIds={expandedIds}
            searchQuery={searchQuery}
            onToggleExpand={onToggleExpand}
            onSelect={(topicId) => onSelect(sheet.id, topicId)}
          />
        </div>
      ) : null}
    </>
  );
}

export function InsertTopicLinkModal({
  project,
  sourceSheetId,
  sourceTopicId,
  initialSelection,
  onInsert,
  onCancel,
}: InsertTopicLinkModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bidirectional, setBidirectional] = useState(true);
  const [selected, setSelected] = useState<TopicLinkSelection | null>(
    initialSelection ?? null,
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const sourceSheet = project.sheetsById[sourceSheetId];
  const invalidIds = useMemo(() => {
    if (!sourceSheet) return new Set<TopicId>();
    const ids = new Set<TopicId>([sourceTopicId]);
    for (const id of collectDescendantIds(sourceSheet, sourceTopicId)) {
      ids.add(id);
    }
    return ids;
  }, [sourceSheet, sourceTopicId]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const toggleExpand = (key: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canInsert = selected !== null;

  return createPortal(
    <div className="topic-link-modal" role="presentation" onClick={onCancel}>
      <div
        className="topic-link-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-link-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="topic-link-modal__header">
          <h2 id="topic-link-modal-title" className="topic-link-modal__title">
            Select a topic to insert link.
          </h2>
          <button
            type="button"
            className="topic-link-modal__close"
            aria-label="Close"
            onClick={onCancel}
          >
            <X {...appIcon('topic-link-modal__close-icon')} />
          </button>
        </div>

        <div className="topic-link-modal__search-wrap">
          <Search {...appIcon('topic-link-modal__search-icon')} />
          <input
            className="topic-link-modal__search-input"
            type="search"
            value={searchQuery}
            placeholder="Find"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="topic-link-modal__tree" role="tree">
          {project.sheets.map((sheetId) => {
            const sheet = project.sheetsById[sheetId];
            if (!sheet) return null;
            return (
              <SheetTreeNode
                key={sheetId}
                sheet={sheet}
                selected={selected}
                invalidIds={invalidIds}
                expandedIds={expandedIds}
                searchQuery={normalizedQuery}
                onToggleExpand={toggleExpand}
                onSelect={(nextSheetId, topicId) => {
                  setSelected({ sheetId: nextSheetId, topicId });
                }}
              />
            );
          })}
        </div>

        <label className="topic-link-modal__checkbox">
          <input
            type="checkbox"
            checked={bidirectional}
            onChange={(event) => setBidirectional(event.target.checked)}
          />
          <span>Add Link for Both Topics</span>
        </label>

        <div className="topic-link-modal__actions">
          <button
            type="button"
            className="topic-link-modal__button topic-link-modal__button--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="topic-link-modal__button topic-link-modal__button--insert"
            disabled={!canInsert}
            onClick={() => {
              if (selected) onInsert(selected, bidirectional);
            }}
          >
            Insert
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

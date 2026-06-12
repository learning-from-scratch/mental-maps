import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  finalizeLabels,
  formatLabelsForInput,
  parseLabelInput,
} from '@/core/model/labels';

export interface LabelPanelAnchor {
  left: number;
  top: number;
  zoom: number;
}

interface TopicLabelPanelProps {
  anchor: LabelPanelAnchor;
  labels: string[];
  autoSort: boolean;
  onChange: (labels: string[], autoSort: boolean) => void;
  onClose: () => void;
  registerCommit: (commit: (() => void) | null) => void;
}

function LabelToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Auto Sort"
      className={`topic-label-panel__toggle${checked ? ' topic-label-panel__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="topic-label-panel__toggle-knob" />
    </button>
  );
}

export function TopicLabelPanel({
  anchor,
  labels,
  autoSort,
  onChange,
  onClose,
  registerCommit,
}: TopicLabelPanelProps) {
  const [draft, setDraft] = useState(() => formatLabelsForInput(labels));
  const [autoSortEnabled, setAutoSortEnabled] = useState(autoSort);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const previewLabels = useMemo(
    () => finalizeLabels(parseLabelInput(draft), autoSortEnabled),
    [draft, autoSortEnabled],
  );

  const previewLabelsRef = useRef(previewLabels);
  const autoSortRef = useRef(autoSortEnabled);
  previewLabelsRef.current = previewLabels;
  autoSortRef.current = autoSortEnabled;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const commit = () => {
      onChangeRef.current(previewLabelsRef.current, autoSortRef.current);
    };
    registerCommit(commit);
    return () => registerCommit(null);
  }, [registerCommit]);

  useEffect(() => {
    let onPointerDown: ((event: PointerEvent) => void) | null = null;
    const timeout = window.setTimeout(() => {
      onPointerDown = (event: PointerEvent) => {
        if (!wrapRef.current?.contains(event.target as Node)) {
          onClose();
        }
      };
      window.addEventListener('pointerdown', onPointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      if (onPointerDown) window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={wrapRef}
      className="topic-label-panel-wrap"
      style={
        {
          left: anchor.left,
          top: anchor.top,
          '--label-zoom': anchor.zoom,
        } as CSSProperties
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="topic-label-panel__caret" aria-hidden />
      <div className="topic-label-panel">
        <div className="topic-label-panel__glass" aria-hidden />
        <div className="topic-label-panel__header">
          <span className="topic-label-panel__title">Label</span>
          <div className="topic-label-panel__auto-sort">
            <span className="topic-label-panel__auto-sort-label">Auto Sort</span>
            <LabelToggle checked={autoSortEnabled} onChange={setAutoSortEnabled} />
          </div>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="topic-label-panel__input"
          value={draft}
          placeholder="Enter labels, separated by commas"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onChangeRef.current(previewLabelsRef.current, autoSortRef.current);
              onClose();
            }
          }}
        />
        {previewLabels.length > 0 ? (
          <div className="topic-label-panel__preview" aria-label="Label preview">
            {previewLabels.map((label) => (
              <span key={label} className="topic-label-panel__preview-pill">
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

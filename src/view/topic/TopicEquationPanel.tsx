import { CircleHelp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { renderLatex } from '@/lib/katexRender';
import { appIcon } from '@/view/icons';

export interface EquationPanelAnchor {
  left: number;
  top: number;
  zoom: number;
}

interface TopicEquationPanelProps {
  anchor: EquationPanelAnchor;
  initialLatex: string;
  onChange: (latex: string) => void;
  onClose: () => void;
  registerCommit: (commit: (() => void) | null) => void;
}

export function TopicEquationPanel({
  anchor,
  initialLatex,
  onChange,
  onClose,
  registerCommit,
}: TopicEquationPanelProps) {
  const [latex, setLatex] = useState(initialLatex);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialLatexRef = useRef(initialLatex);
  initialLatexRef.current = initialLatex;

  useEffect(() => {
    inputRef.current?.focus();
    const input = inputRef.current;
    if (!input) return;
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  useEffect(() => {
    const commit = () => {
      const trimmed = latex.trim();
      if (!trimmed) {
        onChangeRef.current('');
        return;
      }
      if (renderLatex(trimmed).ok) {
        onChangeRef.current(trimmed);
        return;
      }
      onChangeRef.current(initialLatexRef.current);
    };

    registerCommit(commit);
    return () => registerCommit(null);
  }, [latex, registerCommit]);

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

  const preview = renderLatex(latex);

  return (
    <div
      ref={wrapRef}
      className="topic-equation-panel-wrap"
      style={
        {
          left: anchor.left,
          top: anchor.top,
          '--equation-zoom': anchor.zoom,
        } as CSSProperties
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="topic-equation-panel__caret" aria-hidden />
      <div className="topic-equation-panel" role="dialog" aria-labelledby="topic-equation-panel-title">
        <div className="topic-equation-panel__header">
          <h2 id="topic-equation-panel-title" className="topic-equation-panel__title">
            Equation
          </h2>
          <button
            type="button"
            className="topic-equation-panel__help"
            aria-label="LaTeX help"
            title="Enter standard LaTeX math, e.g. \\frac{a}{b}"
          >
            <CircleHelp {...appIcon('topic-equation-panel__help-icon')} />
          </button>
        </div>
        <textarea
          ref={inputRef}
          className="topic-equation-panel__input"
          value={latex}
          placeholder="Type or paste LaTeX"
          rows={3}
          spellCheck={false}
          onChange={(event) => setLatex(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <div
          className={`topic-equation-panel__preview${
            !preview.ok && latex.trim() ? ' topic-equation-panel__preview--invalid' : ''
          }`}
          aria-live="polite"
        >
          {!latex.trim() ? (
            <span className="topic-equation-panel__preview-placeholder">Equation Preview</span>
          ) : preview.ok ? (
            <span
              className="topic-equation-panel__preview-math"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <span className="topic-equation-panel__preview-error">Invalid Equation</span>
          )}
        </div>
      </div>
    </div>
  );
}

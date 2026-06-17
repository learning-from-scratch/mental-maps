import {
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { notesContentIsEmpty } from '@/core/model/notes';
import { appIcon } from '@/view/icons';

export interface NotesPanelAnchor {
  left: number;
  top: number;
  zoom: number;
}

interface TopicNotesPanelProps {
  anchor: NotesPanelAnchor;
  notes: string;
  onChange: (notes: string) => void;
  onClose: () => void;
  registerCommit: (commit: (() => void) | null) => void;
}

function execFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function TopicNotesPanel({
  anchor,
  notes,
  onChange,
  onClose,
  registerCommit,
}: TopicNotesPanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== notes) {
      editor.innerHTML = notes || '';
    }
  }, [notes]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  useEffect(() => {
    const commit = () => {
      const html = editorRef.current?.innerHTML ?? '';
      onChangeRef.current(notesContentIsEmpty(html) ? '' : html);
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
      className="topic-notes-panel-wrap"
      style={
        {
          left: anchor.left,
          top: anchor.top,
          '--notes-zoom': anchor.zoom,
        } as CSSProperties
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="topic-notes-panel__caret" aria-hidden />
      <div className="topic-notes-panel">
        <div className="topic-notes-panel__glass" aria-hidden />
      <div className="topic-notes-panel__toolbar" role="toolbar" aria-label="Note formatting">
        <button
          type="button"
          className="topic-notes-panel__tool"
          aria-label="Bold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => execFormat('bold')}
        >
          <Bold {...appIcon('topic-notes-panel__tool-icon')} />
        </button>
        <button
          type="button"
          className="topic-notes-panel__tool"
          aria-label="Italic"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => execFormat('italic')}
        >
          <Italic {...appIcon('topic-notes-panel__tool-icon')} />
        </button>
        <button
          type="button"
          className="topic-notes-panel__tool"
          aria-label="Underline"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => execFormat('underline')}
        >
          <Underline {...appIcon('topic-notes-panel__tool-icon')} />
        </button>
        <button
          type="button"
          className="topic-notes-panel__tool"
          aria-label="Bulleted list"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => execFormat('insertUnorderedList')}
        >
          <List {...appIcon('topic-notes-panel__tool-icon')} />
        </button>
        <button
          type="button"
          className="topic-notes-panel__tool"
          aria-label="Numbered list"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => execFormat('insertOrderedList')}
        >
          <ListOrdered {...appIcon('topic-notes-panel__tool-icon')} />
        </button>
        <button
          type="button"
          className="topic-notes-panel__tool"
          aria-label="Insert link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const url = window.prompt('Link URL');
            if (url) execFormat('createLink', url);
          }}
        >
          <Link {...appIcon('topic-notes-panel__tool-icon')} />
        </button>
      </div>
      <div
        ref={editorRef}
        className="topic-notes-panel__editor"
        contentEditable
        role="textbox"
        aria-multiline
        data-placeholder="Add notes…"
      />
      </div>
    </div>
  );
}

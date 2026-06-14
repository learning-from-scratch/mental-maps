import { describe, expect, it } from 'vitest';
import { parseOutline } from './parseOutline';

describe('parseOutline', () => {
  it('parses tab-indented outlines', () => {
    const text = `Mind Map App
\tCore Features
\t\tCreate topics
\t\tAdd subtopics
\tInput Methods
\t\tPaste outline
\t\tImport Markdown`;

    expect(parseOutline(text)).toEqual([
      {
        text: 'Mind Map App',
        children: [
          {
            text: 'Core Features',
            children: [
              { text: 'Create topics', children: [] },
              { text: 'Add subtopics', children: [] },
            ],
          },
          {
            text: 'Input Methods',
            children: [
              { text: 'Paste outline', children: [] },
              { text: 'Import Markdown', children: [] },
            ],
          },
        ],
      },
    ]);
  });

  it('parses markdown headings', () => {
    const text = `# Mind Map App

## Core Features
### Create topics
### Add subtopics

## Input Methods
### Paste outline
### Import Markdown`;

    expect(parseOutline(text)).toEqual([
      {
        text: 'Mind Map App',
        children: [
          {
            text: 'Core Features',
            children: [
              { text: 'Create topics', children: [] },
              { text: 'Add subtopics', children: [] },
            ],
          },
          {
            text: 'Input Methods',
            children: [
              { text: 'Paste outline', children: [] },
              { text: 'Import Markdown', children: [] },
            ],
          },
        ],
      },
    ]);
  });

  it('treats flat multi-line text as sibling top-level nodes', () => {
    expect(parseOutline('One\nTwo\nThree')).toEqual([
      { text: 'One', children: [] },
      { text: 'Two', children: [] },
      { text: 'Three', children: [] },
    ]);
  });

  it('returns null for empty clipboard text', () => {
    expect(parseOutline('   \n\n  ')).toBeNull();
  });
});

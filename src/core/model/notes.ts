export function notesContentIsEmpty(html: string): boolean {
  if (!html || html === '<br>') return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}

export function topicHasNotes(notes?: string): boolean {
  if (!notes) return false;
  return !notesContentIsEmpty(notes);
}

export function notesPreviewText(notes?: string, maxLength = 80): string {
  if (!notes) return '';
  const plain = notes
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}…`;
}

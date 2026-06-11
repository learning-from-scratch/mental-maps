export function notesContentIsEmpty(html: string): boolean {
  if (!html || html === '<br>') return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}

export function topicHasNotes(notes?: string): boolean {
  if (!notes) return false;
  return !notesContentIsEmpty(notes);
}

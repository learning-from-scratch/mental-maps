import { produce } from 'immer';
import type { Boundary, Relationship, Summary } from '../model/types';
import type { DocumentState } from '../commands/undo';

export function mutateDoc(state: DocumentState, recipe: (draft: DocumentState['doc']) => void): void {
  state.doc = produce(state.doc, recipe);
}

export function addRelationship(
  state: DocumentState,
  relationship: Relationship,
): void {
  mutateDoc(state, (draft) => {
    const sheetId = draft.sheets[0];
    if (!sheetId) return;
    draft.sheetsById[sheetId]!.relationships.push(relationship);
  });
}

export function addBoundary(state: DocumentState, boundary: Boundary): void {
  mutateDoc(state, (draft) => {
    const sheetId = draft.sheets[0];
    if (!sheetId) return;
    draft.sheetsById[sheetId]!.boundaries.push(boundary);
  });
}

export function addSummary(state: DocumentState, summary: Summary): void {
  mutateDoc(state, (draft) => {
    const sheetId = draft.sheets[0];
    if (!sheetId) return;
    draft.sheetsById[sheetId]!.summaries.push(summary);
  });
}

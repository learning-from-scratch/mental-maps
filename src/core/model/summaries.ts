import { boundariesFromSelection, boundaryMatchesSelection } from './boundaries';
import type { Boundary, Sheet, Summary, TopicId } from './types';

export const DEFAULT_SUMMARY_TEXT = 'Summary';

export function summariesFromSelection(
  sheet: Sheet,
  selectedTopicIds: TopicId[],
): Omit<Summary, 'id' | 'summaryTopicId'>[] {
  return boundariesFromSelection(sheet, selectedTopicIds).map((candidate) => ({
    parentId: candidate.parentId,
    range: candidate.range,
    topicIds: candidate.topicIds,
    paddingTop: candidate.paddingTop,
    paddingBottom: candidate.paddingBottom,
  }));
}

export function summaryMatchesSelection(
  summary: Summary,
  candidate: Pick<Summary, 'parentId' | 'range' | 'topicIds'>,
): boolean {
  return boundaryMatchesSelection(
    {
      id: '',
      parentId: summary.parentId,
      range: summary.range,
      topicIds: summary.topicIds,
    },
    candidate as Pick<Boundary, 'parentId' | 'range' | 'topicIds'>,
  );
}

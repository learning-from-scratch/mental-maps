import { describe, expect, it } from 'vitest';
import { createDocument, getSheet } from '@/core/model/factories';
import { DEFAULT_SUMMARY_TEXT } from '@/core/model/summaries';
import { summariesFromSelection, summaryMatchesSelection } from '@/core/model/summaries';
import {
  buildSummaryBracePath,
  buildSummaryConnectorLine,
  computeSummaryGroupContentRect,
  computeSummaryGroupRect,
  computeSummaryLayout,
  measureSummaryBoxSize,
  snapSummaryFromVerticalBand,
  snapSummaryResizeBand,
  SUMMARY_BOX_GAP,
  SUMMARY_BOX_OFFSET,
  SUMMARY_BRACE_WIDTH,
  SUMMARY_HOOK_LENGTH,
  SUMMARY_CONNECTOR_LENGTH,
  SUMMARY_CONNECTOR_WIDTH,
  SUMMARY_MAX_WIDTH,
  summaryConnectorStartX,
} from '@/layout/summaryGeometry';
import { layoutSheet } from '@/layout';
import type { Summary } from '@/core/model/types';
import type { NodeLayout } from '@/layout/types';

function sheetWithTopics() {
  const doc = createDocument();
  const sheet = getSheet(doc, doc.sheets[0]!);
  const rootId = sheet.rootTopicId;

  const addChild = (parentId: string, text: string) => {
    const id = `topic-${text}`;
    const parent = sheet.topicsById[parentId]!;
    sheet.topicsById[id] = {
      id,
      parentId,
      childrenIds: [],
      text,
      collapsed: false,
      labels: [],
      markers: [],
    };
    parent.childrenIds.push(id);
    return id;
  };

  const sexyland = addChild(rootId, 'Sexyland');
  addChild(sexyland, 'Subtopic 1');
  addChild(sexyland, 'Subtopic 2');
  const main5 = addChild(rootId, 'Main Topic 5');

  return { sheet, rootId, sexyland, main5 };
}

function nodeLayout(x: number, y: number, width: number, height: number): NodeLayout {
  return {
    x,
    y,
    width,
    height,
    side: 'right',
    lines: ['Topic'],
    fontSize: 14,
    lineHeight: 18,
    depth: 1,
    branchIndex: 0,
  };
}

describe('summariesFromSelection', () => {
  it('groups contiguous siblings into one summary candidate', () => {
    const { sheet, sexyland, main5 } = sheetWithTopics();
    const candidates = summariesFromSelection(sheet, [sexyland, main5]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      parentId: sheet.rootTopicId,
      range: [0, 1],
      topicIds: [sexyland, main5],
    });
  });

  it('uses only the parent when parent and child are both selected', () => {
    const { sheet, sexyland } = sheetWithTopics();
    const sub1 = sheet.topicsById[sexyland]!.childrenIds[0]!;
    const candidates = summariesFromSelection(sheet, [sexyland, sub1]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.topicIds).toEqual([sexyland]);
  });

  it('ignores the root topic in selection', () => {
    const { sheet } = sheetWithTopics();
    expect(summariesFromSelection(sheet, [sheet.rootTopicId])).toHaveLength(0);
  });
});

describe('summary geometry', () => {
  it('builds the original parenthesis curve with left-pointing end hooks', () => {
    const brace = buildSummaryBracePath(100, SUMMARY_BRACE_WIDTH);
    expect(brace).toContain(`M ${-SUMMARY_HOOK_LENGTH} 0`);
    expect(brace).toContain('L 0 0');
    expect(brace).toContain(`Q ${SUMMARY_BRACE_WIDTH} 50 0 100`);
    expect(brace).toContain(`L ${-SUMMARY_HOOK_LENGTH} 100`);
  });

  it('extends a short horizontal tick from the parenthesis waist', () => {
    const line = buildSummaryConnectorLine(80);
    const mid = 40;
    const startX = summaryConnectorStartX(SUMMARY_BRACE_WIDTH);
    expect(line).toBe(`M ${startX} ${mid} L ${startX + SUMMARY_CONNECTOR_LENGTH} ${mid}`);
  });

  it('leaves a gap between the connector tick and the summary box', () => {
    expect(SUMMARY_BOX_OFFSET).toBe(SUMMARY_CONNECTOR_WIDTH + SUMMARY_BOX_GAP);
  });

  it('sizes the default Summary label on one line without clipping descenders', () => {
    const size = measureSummaryBoxSize(DEFAULT_SUMMARY_TEXT);
    expect(size.singleLine).toBe(true);
    expect(size.width).toBeLessThan(SUMMARY_MAX_WIDTH);
    expect(size.height).toBeGreaterThanOrEqual(37);
  });

  it('wraps long text and caps width at the max', () => {
    const longText =
      'This is an example of the most beautiful thing ever created and it keeps going for a while';
    const size = measureSummaryBoxSize(longText);
    expect(size.width).toBe(SUMMARY_MAX_WIDTH);
    expect(size.height).toBeGreaterThan(40);
  });

  it('computes group rect including descendants', () => {
    const { sheet, sexyland } = sheetWithTopics();
    const layout = layoutSheet(sheet);
    const summary: Summary = {
      id: 'summary-1',
      parentId: sheet.rootTopicId,
      range: [0, 0],
      topicIds: [sexyland],
      summaryTopicId: 'summary-topic-1',
      paddingTop: 12,
      paddingBottom: 12,
    };

    const rect = computeSummaryGroupRect(layout.nodes, sheet, summary);
    expect(rect).not.toBeNull();
    expect(rect!.height).toBeGreaterThan(40);
  });

  it('uses the padded group rect for brace height when inactive', () => {
    const { sheet, sexyland } = sheetWithTopics();
    const mapLayout = layoutSheet(sheet);
    const summary: Summary = {
      id: 'summary-1',
      parentId: sheet.rootTopicId,
      range: [0, 0],
      topicIds: [sexyland],
      summaryTopicId: 'summary-topic-1',
      paddingTop: 12,
      paddingBottom: 12,
    };

    const groupRect = computeSummaryGroupRect(mapLayout.nodes, sheet, summary);
    const inactiveLayout = computeSummaryLayout(
      mapLayout.nodes,
      sheet,
      summary,
      DEFAULT_SUMMARY_TEXT,
    );
    const activeLayout = computeSummaryLayout(
      mapLayout.nodes,
      sheet,
      summary,
      DEFAULT_SUMMARY_TEXT,
      groupRect,
    );

    expect(inactiveLayout).not.toBeNull();
    expect(activeLayout).not.toBeNull();
    expect(inactiveLayout!.connectorWrap.height).toBe(activeLayout!.connectorWrap.height);
    expect(inactiveLayout!.connectorWrap.y).toBe(activeLayout!.connectorWrap.y);
  });

  it('vertically centers the summary box on the grouped content', () => {
    const { sheet, sexyland } = sheetWithTopics();
    const mapLayout = layoutSheet(sheet);
    const summary: Summary = {
      id: 'summary-1',
      parentId: sheet.rootTopicId,
      range: [0, 0],
      topicIds: [sexyland],
      summaryTopicId: 'summary-topic-1',
      paddingTop: 12,
      paddingBottom: 12,
    };

    const layout = computeSummaryLayout(
      mapLayout.nodes,
      sheet,
      summary,
      DEFAULT_SUMMARY_TEXT,
    );

    expect(layout).not.toBeNull();
    expect(layout!.boxRect.y + layout!.boxRect.height / 2).toBeCloseTo(layout!.midY, 0);
  });

  it('snaps resize bands to ancestor node edges while dragging', () => {
    const { sheet, rootId, sexyland, main5 } = sheetWithTopics();
    const nodes = new Map<string, NodeLayout>([
      [sexyland, nodeLayout(100, 100, 80, 40)],
      [main5, nodeLayout(100, 160, 80, 40)],
    ]);
    const summary: Summary = {
      id: 'summary-1',
      parentId: rootId,
      range: [0, 1],
      topicIds: [sexyland, main5],
      summaryTopicId: 'summary-topic-1',
      paddingTop: 12,
      paddingBottom: 12,
    };

    const snapped = snapSummaryResizeBand(nodes, sheet, summary, 103, 200, 'top', 1);

    expect(snapped.top).toBe(100);
    expect(snapped.bottom).toBe(200);
  });

  it('drops an ancestor and its descendants when the band no longer covers the ancestor', () => {
    const { sheet, rootId, sexyland, main5 } = sheetWithTopics();
    const sub1 = sheet.topicsById[sexyland]!.childrenIds[0]!;
    const sub2 = sheet.topicsById[sexyland]!.childrenIds[1]!;
    const nodes = new Map<string, NodeLayout>([
      [sexyland, nodeLayout(100, 100, 80, 40)],
      [sub1, nodeLayout(40, 150, 70, 28)],
      [sub2, nodeLayout(40, 190, 70, 28)],
      [main5, nodeLayout(100, 240, 80, 40)],
    ]);
    const summary: Summary = {
      id: 'summary-1',
      parentId: rootId,
      range: [0, 1],
      topicIds: [sexyland, main5],
      summaryTopicId: 'summary-topic-1',
      paddingTop: 12,
      paddingBottom: 12,
    };

    const snapped = snapSummaryFromVerticalBand(sheet, nodes, summary, 230, 290);

    expect(snapped.topicIds).toEqual([main5]);
    expect(snapped.range).toEqual([1, 1]);

    const content = computeSummaryGroupContentRect(nodes, sheet, {
      ...summary,
      topicIds: snapped.topicIds!,
      range: snapped.range!,
    });
    expect(content).not.toBeNull();
    expect(content!.y).toBe(240);
    expect(content!.height).toBe(40);
  });

  it('keeps an ancestor and its descendants when the ancestor remains covered', () => {
    const { sheet, rootId, sexyland } = sheetWithTopics();
    const sub1 = sheet.topicsById[sexyland]!.childrenIds[0]!;
    const sub2 = sheet.topicsById[sexyland]!.childrenIds[1]!;
    const nodes = new Map<string, NodeLayout>([
      [sexyland, nodeLayout(100, 100, 80, 40)],
      [sub1, nodeLayout(40, 150, 70, 28)],
      [sub2, nodeLayout(40, 190, 70, 28)],
    ]);
    const summary: Summary = {
      id: 'summary-1',
      parentId: rootId,
      range: [0, 0],
      topicIds: [sexyland],
      summaryTopicId: 'summary-topic-1',
      paddingTop: 12,
      paddingBottom: 12,
    };

    const snapped = snapSummaryFromVerticalBand(sheet, nodes, summary, 100, 218);

    expect(snapped.topicIds).toEqual([sexyland]);
    const content = computeSummaryGroupContentRect(nodes, sheet, {
      ...summary,
      ...snapped,
      topicIds: snapped.topicIds!,
    });
    expect(content).not.toBeNull();
    expect(content!.y).toBe(100);
    expect(content!.height).toBe(118);
  });
});

describe('summaryMatchesSelection', () => {
  it('matches equivalent topic id sets', () => {
    const summary: Summary = {
      id: 's1',
      parentId: 'root',
      range: [0, 1],
      topicIds: ['a', 'b'],
      summaryTopicId: 'st',
    };

    expect(
      summaryMatchesSelection(summary, {
        parentId: 'root',
        range: [0, 1],
        topicIds: ['b', 'a'],
      }),
    ).toBe(true);
  });
});

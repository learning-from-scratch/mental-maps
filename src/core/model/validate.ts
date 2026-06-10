import type { MindMapDocument, Sheet, TopicId } from './types';

export interface ValidationIssue {
  code: string;
  message: string;
}

function validateSheet(sheet: Sheet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const topicIds = new Set(Object.keys(sheet.topicsById));

  for (const [id, topic] of Object.entries(sheet.topicsById)) {
    if (topic.id !== id) {
      issues.push({
        code: 'topic-id-mismatch',
        message: `Topic key ${id} does not match topic.id ${topic.id}`,
      });
    }

    if (topic.parentId !== null) {
      if (!topicIds.has(topic.parentId)) {
        issues.push({
          code: 'missing-parent',
          message: `Topic ${id} references missing parent ${topic.parentId}`,
        });
      } else {
        const parent = sheet.topicsById[topic.parentId];
        if (parent && !parent.childrenIds.includes(id)) {
          issues.push({
            code: 'parent-child-mismatch',
            message: `Topic ${id} has parentId ${topic.parentId}, but parent does not list it as a child`,
          });
        }
      }
    }

    for (const childId of topic.childrenIds) {
      if (!topicIds.has(childId)) {
        issues.push({
          code: 'missing-child',
          message: `Topic ${id} references missing child ${childId}`,
        });
        continue;
      }

      const child = sheet.topicsById[childId];
      if (child.parentId !== id) {
        issues.push({
          code: 'parent-child-mismatch',
          message: `Topic ${id} lists child ${childId}, but child's parentId is ${child.parentId}`,
        });
      }
    }
  }

  if (!topicIds.has(sheet.rootTopicId)) {
    issues.push({
      code: 'missing-root',
      message: `Root topic ${sheet.rootTopicId} is missing`,
    });
  }

  for (const floatingId of sheet.floatingTopicIds) {
    if (!topicIds.has(floatingId)) {
      issues.push({
        code: 'missing-floating',
        message: `Floating topic ${floatingId} is missing`,
      });
      continue;
    }

    const floating = sheet.topicsById[floatingId];
    if (floating.parentId !== null) {
      issues.push({
        code: 'floating-has-parent',
        message: `Floating topic ${floatingId} has parentId ${floating.parentId}`,
      });
    }
  }

  for (const rel of sheet.relationships) {
    if (!topicIds.has(rel.fromId) || !topicIds.has(rel.toId)) {
      issues.push({
        code: 'relationship-missing-topic',
        message: `Relationship ${rel.id} references missing topics`,
      });
    }
  }

  for (const boundary of sheet.boundaries) {
    const parent = sheet.topicsById[boundary.parentId];
    if (!parent) {
      issues.push({
        code: 'boundary-missing-parent',
        message: `Boundary ${boundary.id} references missing parent`,
      });
      continue;
    }

    const [start, end] = boundary.range;
    if (start < 0 || end >= parent.childrenIds.length || start > end) {
      issues.push({
        code: 'boundary-invalid-range',
        message: `Boundary ${boundary.id} has invalid range [${start}, ${end}]`,
      });
    }
  }

  for (const summary of sheet.summaries) {
    const parent = sheet.topicsById[summary.parentId];
    if (!parent) {
      issues.push({
        code: 'summary-missing-parent',
        message: `Summary ${summary.id} references missing parent`,
      });
      continue;
    }

    const [start, end] = summary.range;
    if (start < 0 || end >= parent.childrenIds.length || start > end) {
      issues.push({
        code: 'summary-invalid-range',
        message: `Summary ${summary.id} has invalid range [${start}, ${end}]`,
      });
    }

    if (!topicIds.has(summary.summaryTopicId)) {
      issues.push({
        code: 'summary-missing-topic',
        message: `Summary ${summary.id} references missing summary topic`,
      });
    }
  }

  const reachable = collectReachableTopics(sheet);
  for (const topicId of topicIds) {
    if (!reachable.has(topicId)) {
      issues.push({
        code: 'orphan-topic',
        message: `Topic ${topicId} is not reachable from root, floating, or summaries`,
      });
    }
  }

  if (hasCycle(sheet)) {
    issues.push({
      code: 'cycle-detected',
      message: 'Topic graph contains a cycle',
    });
  }

  return issues;
}

export function validate(doc: MindMapDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const sheetId of doc.sheets) {
    const sheet = doc.sheetsById[sheetId];
    if (!sheet) {
      issues.push({
        code: 'missing-sheet',
        message: `Sheet ${sheetId} is listed but missing`,
      });
      continue;
    }
    issues.push(...validateSheet(sheet));
  }

  return issues;
}

export function assertValid(doc: MindMapDocument): void {
  const issues = validate(doc);
  if (issues.length > 0) {
    const details = issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n');
    throw new Error(`Document validation failed:\n${details}`);
  }
}

function collectReachableTopics(sheet: Sheet): Set<TopicId> {
  const reachable = new Set<TopicId>();
  const queue: TopicId[] = [sheet.rootTopicId, ...sheet.floatingTopicIds];

  for (const summary of sheet.summaries) {
    queue.push(summary.summaryTopicId);
  }

  while (queue.length > 0) {
    const topicId = queue.pop()!;
    if (reachable.has(topicId)) continue;
    reachable.add(topicId);

    const topic = sheet.topicsById[topicId];
    if (!topic) continue;

    for (const childId of topic.childrenIds) {
      queue.push(childId);
    }
  }

  return reachable;
}

function hasCycle(sheet: Sheet): boolean {
  const visiting = new Set<TopicId>();
  const visited = new Set<TopicId>();

  function dfs(topicId: TopicId): boolean {
    if (visited.has(topicId)) return false;
    if (visiting.has(topicId)) return true;

    visiting.add(topicId);
    const topic = sheet.topicsById[topicId];
    if (topic) {
      for (const childId of topic.childrenIds) {
        if (dfs(childId)) return true;
      }
    }
    visiting.delete(topicId);
    visited.add(topicId);
    return false;
  }

  for (const topicId of Object.keys(sheet.topicsById)) {
    if (dfs(topicId)) return true;
  }

  return false;
}

import { createDocument, createTopic } from '@/core/model/factories';
import type { MindMapDocument, Sheet, Topic, TopicId } from '@/core/model/types';

function linkBranch(parent: Topic, children: Topic[]): void {
  parent.childrenIds = children.map((c) => c.id);
  for (const child of children) {
    child.parentId = parent.id;
  }
}

function buildClusteringSheet(): Sheet {
  const root = createTopic({ id: 'root', text: 'Clustering and Distance Metrics' });

  const rightBranches = [
    createTopic({ id: 'b1', text: 'Unsupervised Learning & Clustering', side: 'right' }),
    createTopic({ id: 'b2', text: 'Distance Metrics', side: 'right' }),
    createTopic({ id: 'b3', text: 'K-Means', side: 'right' }),
  ];

  const leftBranches = [
    createTopic({ id: 'b4', text: 'Evaluation Metrics', side: 'left' }),
    createTopic({ id: 'b5', text: 'Choosing K & Initialisation', side: 'left' }),
    createTopic({ id: 'b6', text: 'Other Clustering Methods', side: 'left' }),
  ];

  const distanceChildren = [
    'Why distance matters',
    'Metric properties',
    'Euclidean Distance',
    'Manhattan Distance',
    'Minkowski Distance',
    'Cosine Similarity',
    'When to use which metric',
  ].map((text, i) => createTopic({ id: `d-${i}`, text }));

  const kmeansChildren = [
    'Core goal',
    'Algorithm flow',
    'Strengths',
    'Limitations',
    'K-Means++',
  ].map((text, i) => createTopic({ id: `k-${i}`, text }));

  const evalChildren = [
    'Inertia (WCSS)',
    'Silhouette Score',
    'Davies-Bouldin Index',
    'Calinski-Harabasz Index',
  ].map((text, i) => createTopic({ id: `e-${i}`, text }));

  const chooseKChildren = [
    'Elbow Method',
    'Silhouette Method',
    'Domain knowledge',
  ].map((text, i) => createTopic({ id: `c-${i}`, text }));

  const otherChildren = [
    'Hierarchical Clustering',
    'DBSCAN',
    'Gaussian Mixture Models',
  ].map((text, i) => createTopic({ id: `o-${i}`, text }));

  const unsupervisedChildren = [
    'What is clustering?',
    'Types of clustering',
    'Use cases',
  ].map((text, i) => createTopic({ id: `u-${i}`, text }));

  root.childrenIds = [...rightBranches, ...leftBranches].map((b) => b.id);
  for (const branch of [...rightBranches, ...leftBranches]) {
    branch.parentId = root.id;
  }

  linkBranch(rightBranches[0]!, unsupervisedChildren);
  linkBranch(rightBranches[1]!, distanceChildren);
  linkBranch(rightBranches[2]!, kmeansChildren);
  linkBranch(leftBranches[0]!, evalChildren);
  linkBranch(leftBranches[1]!, chooseKChildren);
  linkBranch(leftBranches[2]!, otherChildren);

  const topicsById: Record<TopicId, Topic> = { [root.id]: root };
  for (const topic of [
    ...rightBranches,
    ...leftBranches,
    ...unsupervisedChildren,
    ...distanceChildren,
    ...kmeansChildren,
    ...evalChildren,
    ...chooseKChildren,
    ...otherChildren,
  ]) {
    topicsById[topic.id] = topic;
  }

  return {
    id: 'sheet-1',
    title: 'Clustering',
    rootTopicId: root.id,
    floatingTopicIds: [],
    topicsById,
    relationships: [],
    boundaries: [],
    summaries: [],
    theme: 'colorful',
    layout: {
      type: 'mindmap',
      hSpacing: 82,
      vSpacing: 30,
    },
  };
}

export function createSampleDocument(): MindMapDocument {
  const sheet = buildClusteringSheet();

  return createDocument({
    id: 'demo-doc',
    title: 'Clustering and Distance Metrics',
    sheets: [sheet.id],
    sheetsById: { [sheet.id]: sheet },
  });
}

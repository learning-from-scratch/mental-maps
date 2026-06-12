export type TopicLinkKind = 'webpage' | 'cloud';

export interface TopicLink {
  url: string;
  title?: string;
  kind?: TopicLinkKind;
}

export function topicLinkKind(link?: TopicLink): TopicLinkKind {
  return link?.kind === 'cloud' ? 'cloud' : 'webpage';
}

export function topicHasLink(link?: TopicLink): boolean {
  return Boolean(link?.url?.trim());
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

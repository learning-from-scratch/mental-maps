export interface OutlineNode {
  text: string;
  children: OutlineNode[];
}

interface OutlineLine {
  text: string;
  depth: number;
}

function buildOutlineTree(lines: OutlineLine[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: { node: OutlineNode; depth: number }[] = [];

  for (const line of lines) {
    const node: OutlineNode = { text: line.text, children: [] };

    while (stack.length > 0 && stack[stack.length - 1]!.depth >= line.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1]!.node.children.push(node);
    }

    stack.push({ node, depth: line.depth });
  }

  return roots;
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim().length > 0);
}

function parseMarkdownLines(lines: string[]): OutlineLine[] | null {
  const parsed: OutlineLine[] = [];

  for (const line of lines) {
    const match = line.trim().match(/^(#{1,6})\s+(.+)$/);
    if (!match) return null;
    parsed.push({
      depth: match[1]!.length - 1,
      text: match[2]!.trim(),
    });
  }

  if (parsed.length === 0) return null;

  const minDepth = Math.min(...parsed.map((entry) => entry.depth));
  return parsed.map((entry) => ({
    text: entry.text,
    depth: entry.depth - minDepth,
  }));
}

function countLeadingTabs(line: string): number {
  let depth = 0;
  for (const char of line) {
    if (char === '\t') depth += 1;
    else break;
  }
  return depth;
}

function countLeadingSpaces(line: string): number {
  let depth = 0;
  for (const char of line) {
    if (char === ' ') depth += 1;
    else break;
  }
  return depth;
}

function stripLeadingIndent(line: string): string {
  return line.replace(/^[\t ]+/, '').trim();
}

function parseIndentedLines(lines: string[]): OutlineLine[] {
  const usesTabs = lines.some((line) => line.startsWith('\t'));
  const indentUnit = usesTabs
    ? 1
    : (() => {
         const spaceDepths = lines
            .map(countLeadingSpaces)
            .filter((depth) => depth > 0);
         if (spaceDepths.length === 0) return 2;
         const min = Math.min(...spaceDepths);
         if (min % 4 === 0) return 4;
         if (min % 2 === 0) return 2;
         return min;
      })();

  const parsed = lines.map((line) => {
    const leading = usesTabs ? countLeadingTabs(line) : countLeadingSpaces(line);
    return {
      depth: Math.floor(leading / indentUnit),
      text: stripLeadingIndent(line),
    };
  });

  const minDepth = Math.min(...parsed.map((entry) => entry.depth));
  return parsed.map((entry) => ({
    text: entry.text,
    depth: entry.depth - minDepth,
  }));
}

function isMarkdownOutline(lines: string[]): boolean {
  return lines.some((line) => /^#{1,6}\s+\S/.test(line.trim()));
}

function hasIndentStructure(lines: OutlineLine[]): boolean {
  return lines.some((line) => line.depth > 0);
}

export function parseOutline(text: string): OutlineNode[] | null {
  const lines = normalizeLines(text);
  if (lines.length === 0) return null;

  if (isMarkdownOutline(lines)) {
    const markdownLines = parseMarkdownLines(lines);
    if (markdownLines) return buildOutlineTree(markdownLines);
  }

  const indentedLines = parseIndentedLines(lines);
  if (lines.length === 1 || hasIndentStructure(indentedLines)) {
    return buildOutlineTree(indentedLines);
  }

  return buildOutlineTree(
    indentedLines.map((line) => ({
      text: line.text,
      depth: 0,
    })),
  );
}

import katex from 'katex';

export type LatexRenderResult =
  | { ok: true; html: string }
  | { ok: false; error: true };

export function renderLatex(latex: string, displayMode = false): LatexRenderResult {
  const trimmed = latex.trim();
  if (!trimmed) return { ok: false, error: true };

  try {
    const html = katex.renderToString(trimmed, {
      throwOnError: true,
      displayMode,
      output: 'html',
    });
    return { ok: true, html };
  } catch {
    return { ok: false, error: true };
  }
}

export function isValidLatex(latex: string): boolean {
  return renderLatex(latex).ok;
}

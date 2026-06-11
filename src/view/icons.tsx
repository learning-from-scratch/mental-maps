import type { LucideProps } from 'lucide-react';

/** Shared defaults for toolbar and menu icons. */
export function appIcon(className?: string, strokeWidth = 1.75): LucideProps {
  return { className, strokeWidth, 'aria-hidden': true };
}

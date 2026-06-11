interface MindMapIconProps {
  className?: string;
}

export const MindMapIcons = {
  Topic: ({ className }: MindMapIconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="11.5" y="3.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
      <rect x="8" y="12" width="12" height="8" rx="2" />
      <path d="M 9 6 L 6 6 A 2 2 0 0 0 4 8 L 4 14 A 2 2 0 0 0 6 16 L 8 16" />
    </svg>
  ),

  Subtopic: ({ className }: MindMapIconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
      <path d="M 7.5 12 L 10.75 12" />
      <rect x="10.75" y="7.5" width="12.25" height="9" rx="2" />
    </svg>
  ),

  Relationship: ({ className }: MindMapIconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="15" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
      <path d="M 5.5 13 C 5.5 3, 19.5 3, 19.5 16" />
      <polyline points="17.5 16, 19.5 20, 21.5 16" />
    </svg>
  ),

  Summary: ({ className }: MindMapIconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M 3.5 4 Q 6.5 4 6.5 8 C 6.5 10 8.75 11 8.75 12 C 8.75 13 6.5 14 6.5 16 Q 6.5 20 3.5 20" />
      <rect x="13.5" y="8.625" width="9.19" height="6.75" rx="2" />
    </svg>
  ),

  Boundary: ({ className }: MindMapIconProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="5.25" width="18" height="13.5" rx="3" strokeDasharray="4 3" />
    </svg>
  ),
};

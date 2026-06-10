interface IconProps {
  className?: string;
}

const SW = 1.6;

/** 1 — Subtopic: square → line left, down, right → child topic */
export function AddSubtopicIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <path
        d="M7 6.75H5.25V13.25H9.25"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="9.25"
        y="11"
        width="11.5"
        height="6.5"
        rx="2"
        stroke="currentColor"
        strokeWidth={SW}
      />
    </svg>
  );
}

/** 2 — Sibling: square → line → topic */
export function AddSiblingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="9.25" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <path d="M7 11h2.75" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect
        x="9.75"
        y="7.75"
        width="11.25"
        height="6.5"
        rx="2"
        stroke="currentColor"
        strokeWidth={SW}
      />
    </svg>
  );
}

/** 3 — Relationship: square + arc looping up with downward arrow */
export function RelationshipIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="10.75" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <path
        d="M7.5 10.75C7.5 6 12.5 4.75 17 7.75"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <path
        d="M17 7.75v2.75M15.75 9.75 17 11.25 18.25 9.75"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 4 — Summary: } brace → line → topic */
export function SummaryIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 5.5C7 5.5 7 9 10.5 10C7 11 7 14.5 10.5 15.5C7 15.5 7 19 10.5 19"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.75 10.25h1.75" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <rect
        x="13.5"
        y="8.25"
        width="8"
        height="5.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth={SW}
      />
    </svg>
  );
}

/** 5 — Boundary: dashed rounded container */
export function BoundaryIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4.5"
        y="8"
        width="15"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth={SW}
        strokeDasharray="3.2 2.4"
      />
    </svg>
  );
}

/** 6 — Plus / add */
export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 7v10M7 12h10"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 7 — Insert menu chevron */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.5 9.5 12 14l4.5-4.5"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

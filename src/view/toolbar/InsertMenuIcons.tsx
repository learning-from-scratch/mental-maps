interface IconProps {
  className?: string;
}

export function ZoneIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="5" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6" y="8" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function NoteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function LabelIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 8l4-3h8v10H8l-4-3V8z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

export function TodoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 10l2 2 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function TaskIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 6h8M6 10h8M6 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="10" r="1" fill="currentColor" />
      <circle cx="4" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 14H4a2 2 0 01-2-2V8a2 2 0 012-2h2M14 6h2a2 2 0 012 2v4a2 2 0 01-2 2h-2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M8 12l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function AttachmentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M12.5 5.5l-5 5a2 2 0 102.8 2.8l5.5-5.5a3 3 0 00-4.2-4.2l-6 6a4.5 4.5 0 106.4 6.4l6.2-6.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StickerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M14 6l2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function IllustrationIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10 6v1M10 13v1M6 10h1M13 10h1M7.5 7.5l.7.7M11.8 11.8l.7.7M12.5 7.5l-.7.7M8.2 11.8l-.7.7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LocalImageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 13l4-3 3 2 3-4 4 5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function EquationIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 5l3 10M5 15h4M12 5c2 0 3 1.5 3 3.5S14 12 12 12H10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WebpageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="10" cy="10" rx="3" ry="6.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.5 10h13M5 6.5h10M5 13.5h10" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function TopicLinkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="6" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 9h3a2 2 0 012 2v0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="17" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

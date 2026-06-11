interface ZeonLogoProps {
  className?: string;
}

export function ZeonLogo({ className }: ZeonLogoProps) {
  return (
    <img
      className={className}
      src="/zeon-text.png"
      alt="Zeon"
      width={88}
      height={28}
      draggable={false}
    />
  );
}

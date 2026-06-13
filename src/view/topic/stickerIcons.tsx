import {
  Check,
  CircleAlert,
  CircleHelp,
  Flag,
  Gamepad2,
  Heart,
  Hourglass,
  Lightbulb,
  Music,
  Pencil,
  PersonStanding,
  Phone,
  Pin,
  Plane,
  Play,
  Star,
  ThumbsDown,
  ThumbsUp,
  User,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

export const STICKER_ICON_COMPONENTS: Record<string, LucideIcon> = {
  flag: Flag,
  star: Star,
  user: User,
  play: Play,
  check: Check,
  heart: Heart,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  pin: Pin,
  lightbulb: Lightbulb,
  zap: Zap,
  hourglass: Hourglass,
  phone: Phone,
  pencil: Pencil,
  music: Music,
  'gamepad-2': Gamepad2,
  plane: Plane,
  'person-standing': PersonStanding,
  'circle-alert': CircleAlert,
  'circle-help': CircleHelp,
};

/** Filled sticker glyphs — bold silhouettes on colored circles. */
export function stickerIconProps(className?: string): LucideProps {
  return {
    className,
    fill: 'currentColor',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true,
  };
}

interface StickerIconProps {
  name: string;
  className?: string;
}

export function StickerIcon({ name, className }: StickerIconProps) {
  if (name === 'circle') {
    return <span className={`${className ?? ''} sticker-icon__solid-circle`.trim()} aria-hidden />;
  }

  const Icon = STICKER_ICON_COMPONENTS[name];
  if (!Icon) return null;
  return <Icon {...stickerIconProps(className)} />;
}

import Image from "next/image";

export const AVATAR_SIZE = {
  SM: "sm",
  MD: "md",
} as const;

export type AvatarSize = (typeof AVATAR_SIZE)[keyof typeof AVATAR_SIZE];

export interface AvatarProps {
  src?: string;
  initials: string;
  alt: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
};

export function Avatar({
  src,
  initials,
  alt,
  size = AVATAR_SIZE.MD,
}: AvatarProps) {
  const classes = [
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-medium text-primary-foreground forced-colors-boundary",
    sizeClasses[size],
  ].join(" ");

  if (src) {
    const dimension = size === AVATAR_SIZE.SM ? 32 : 44;

    return (
      <Image
        className={classes}
        src={src}
        alt={alt}
        width={dimension}
        height={dimension}
        unoptimized
      />
    );
  }

  return (
    <span className={classes} role="img" aria-label={alt}>
      {initials}
    </span>
  );
}

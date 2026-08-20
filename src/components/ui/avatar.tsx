import Image from "next/image";

export const AVATAR_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
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
  lg: "size-[5.5rem] text-2xl",
};

const sizeDimensions: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 88,
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
    const dimension = sizeDimensions[size];

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

import type { ComponentPropsWithoutRef } from "react";

export const BUTTON_VARIANT = {
  PRIMARY: "primary",
  OUTLINE: "outline",
  GHOST: "ghost",
  ICON: "icon",
} as const;

export type ButtonVariant =
  (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

export const CONTROL_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
} as const;

export type ControlSize = (typeof CONTROL_SIZE)[keyof typeof CONTROL_SIZE];

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ControlSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-primary",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-secondary",
  ghost: "bg-transparent text-muted hover:bg-secondary hover:text-foreground",
  icon: "bg-transparent text-muted hover:bg-secondary hover:text-foreground",
};

const sizeClasses: Record<ControlSize, string> = {
  sm: "min-h-11 rounded-sm px-3 text-xs",
  md: "min-h-11 rounded-md px-4 text-sm",
  lg: "min-h-12 rounded-lg px-5 text-sm",
};

const iconSizeClasses: Record<ControlSize, string> = {
  sm: "size-11 rounded-sm p-0",
  md: "size-11 rounded-md p-0",
  lg: "size-12 rounded-lg p-0",
};

export function Button({
  className,
  variant = BUTTON_VARIANT.PRIMARY,
  size = CONTROL_SIZE.MD,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,transform] duration-fast ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 forced-colors-boundary",
    variantClasses[variant],
    variant === BUTTON_VARIANT.ICON ? iconSizeClasses[size] : sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} data-motion-transform type={type} {...props} />
  );
}

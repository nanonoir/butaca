import { useId, type ComponentPropsWithoutRef } from "react";

export interface InputProps extends ComponentPropsWithoutRef<"input"> {
  invalid?: boolean;
  label?: string;
  error?: string;
}

export function Input({
  id: providedId,
  label,
  error,
  invalid = false,
  className,
  "aria-describedby": describedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const describedByIds = [describedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");
  const classes = [
    "min-h-11 w-full rounded-lg border border-input bg-surface-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-fast ease-ui placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 forced-colors-boundary",
    invalid && "border-primary focus:border-primary",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex w-full flex-col gap-2">
      {label ? (
        <label className="text-sm font-medium text-foreground" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input
        {...props}
        id={id}
        className={classes}
        aria-describedby={describedByIds || undefined}
        aria-invalid={invalid || undefined}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}
    </div>
  );
}

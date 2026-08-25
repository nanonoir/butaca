import type { ReviewVerdict } from "@/contracts/reviews";

export function ThumbIcon({
  className,
  direction = "up",
}: {
  className?: string;
  direction?: "up" | "down";
}) {
  return (
    <svg
      aria-hidden="true"
      className={`${className ?? ""} ${direction === "down" ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7.7 10.1 11.4 4c.5-.8 1.7-.5 1.7.5v4.3h4.8c1.2 0 2.1 1.1 1.8 2.3l-1.4 6.1c-.2.8-.9 1.4-1.8 1.4H7.7m0-8.5v8.5H4.9a.9.9 0 0 1-.9-.9V11c0-.5.4-.9.9-.9h2.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/** Shared because the same verdict is read in two places now: under a movie,
 * beside everyone's name, and on the profile, beside the movie it was about. */
export function ReviewVerdictLabel({ verdict }: { verdict: ReviewVerdict }) {
  const recommended = verdict === "RECOMMENDED";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${recommended ? "text-primary" : "text-muted"}`}
    >
      <ThumbIcon className="size-3.5" direction={recommended ? "up" : "down"} />
      {recommended ? "Recomienda" : "No la recomienda"}
    </span>
  );
}

export const BUTI_MATCH = {
  HIGH: "high",
  LOW: "low",
  MEDIUM: "medium",
} as const;

export type ButiMatch = (typeof BUTI_MATCH)[keyof typeof BUTI_MATCH];

export const BUTI_ACTIVITY = {
  IDLE: "idle",
  JUMPING: "jumping",
  TALKING: "talking",
} as const;

export type ButiActivity = (typeof BUTI_ACTIVITY)[keyof typeof BUTI_ACTIVITY];

interface ButiMascotProps {
  activity?: ButiActivity;
  className?: string;
  match: ButiMatch;
}

const MATCH_LABELS: Readonly<Record<ButiMatch, string>> = {
  [BUTI_MATCH.HIGH]: "Buti feliz, match alto",
  [BUTI_MATCH.MEDIUM]: "Buti atento, match medio",
  [BUTI_MATCH.LOW]: "Buti dudoso, match bajo",
};

function ButiFace({
  activity,
  match,
}: {
  activity: ButiActivity;
  match: ButiMatch;
}) {
  const isTalking = activity === BUTI_ACTIVITY.TALKING;

  return (
    <>
      {match === BUTI_MATCH.LOW && !isTalking ? (
        <path
          d="m34 35 9-3"
          data-testid="buti-raised-eyebrow"
          fill="none"
          stroke="#292137"
          strokeLinecap="round"
          strokeWidth="3"
        />
      ) : null}

      <g className="buti-eyes">
        <ellipse cx="41" cy="43" fill="#292137" rx="4.2" ry="6" />
        <ellipse cx="61" cy="43" fill="#292137" rx="4.2" ry="6" />
        <circle cx="42.3" cy="41.2" fill="#f8f1d9" r="1.1" />
        <circle cx="62.3" cy="41.2" fill="#f8f1d9" r="1.1" />
      </g>

      {isTalking ? (
        <ellipse
          className="buti-mouth-talking"
          cx="51"
          cy="57"
          data-testid="buti-mouth-talking"
          fill="#292137"
          rx="6"
          ry="5"
        />
      ) : null}

      {!isTalking && match === BUTI_MATCH.HIGH ? (
        <>
          <g data-testid="buti-cheeks" fill="#ee9fa9" opacity="0.9">
            <ellipse cx="31.5" cy="53" rx="5" ry="3.2" />
            <ellipse cx="70.5" cy="53" rx="5" ry="3.2" />
          </g>
          <path
            d="M42.5 54.5c1.1 8.4 15.9 8.4 17 0Z"
            data-testid="buti-mouth-open"
            fill="#292137"
            stroke="#292137"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M47 61c2.5-1.7 5.5-1.7 8 0"
            fill="none"
            stroke="#ee9fa9"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      ) : null}

      {!isTalking && match === BUTI_MATCH.MEDIUM ? (
        <path
          d="M45 57h12"
          data-testid="buti-mouth-neutral"
          fill="none"
          stroke="#292137"
          strokeLinecap="round"
          strokeWidth="3"
        />
      ) : null}

      {!isTalking && match === BUTI_MATCH.LOW ? (
        <path
          d="M43 58c4-3 8 3 16-1"
          data-testid="buti-mouth-crooked"
          fill="none"
          stroke="#292137"
          strokeLinecap="round"
          strokeWidth="3"
        />
      ) : null}
    </>
  );
}

export function ButiMascot({
  activity = BUTI_ACTIVITY.IDLE,
  className,
  match,
}: ButiMascotProps) {
  const label =
    activity === BUTI_ACTIVITY.TALKING ? "Buti hablando" : MATCH_LABELS[match];

  return (
    <span
      aria-label={label}
      className={`buti-mascot relative inline-grid aspect-square shrink-0 place-items-center overflow-visible rounded-[1.35rem] bg-primary ${className ?? "size-16"}`}
      data-activity={activity}
      data-match={match}
      role="img"
    >
      <span aria-hidden="true" className="absolute inset-0">
        <span className="buti-grain buti-grain-one" data-testid="buti-grain" />
        <span className="buti-grain buti-grain-two" data-testid="buti-grain" />
        <span
          className="buti-grain buti-grain-three"
          data-testid="buti-grain"
        />
      </span>

      <svg
        aria-hidden="true"
        className="buti-character size-[92%] overflow-visible"
        viewBox="0 0 100 84"
      >
        <path
          d="M20 51c-6-8-2-18 7-21-2-10 7-18 17-15 5-8 18-8 23 1 10-2 18 7 15 17 9 4 10 16 2 22 3 11-8 19-18 15-7 8-20 7-25-2-10 5-21-5-18-15-2-1-3-2-3-4Z"
          fill="#f6edcf"
          stroke="#e8dcb9"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M28 31c3-5 8-7 14-6M67 23c5 2 8 6 8 11M23 52c4-3 8-4 12-2M69 65c4-2 7-5 8-9"
          fill="none"
          opacity="0.62"
          stroke="#fff8df"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <ButiFace activity={activity} match={match} />
      </svg>
    </span>
  );
}

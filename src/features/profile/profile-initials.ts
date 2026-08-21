const MAX_INITIALS = 2;
const FALLBACK_INITIAL = "?";

/** Derives the avatar initials from the stored display name. Kept pure and
 * separate from the screen so the empty and single-word cases stay covered. */
export function getProfileInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((word) => [...word][0]?.toUpperCase() ?? "")
    .join("");

  return initials || FALLBACK_INITIAL;
}

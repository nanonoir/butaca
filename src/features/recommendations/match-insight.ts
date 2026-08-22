import type { Genre, MatchInsight, MovieSummary } from "@/contracts";

import type { TasteProfile } from "./taste-profile";

export const MATCH_TIER = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const satisfies Record<string, MatchInsight["tier"]>;

/** Share of the batch that earns the enthusiastic face. Candidates are
 * generated from the viewer's own genres, so almost every one of them matches
 * two or more: counting matches alone made every card a high match and left
 * Buti with a single expression. Position in the ranking is what actually
 * separates them. */
const HIGH_TIER_SHARE = 1 / 3;

function weightOf(profile: TasteProfile, genreId: number): number {
  return profile.genreWeights[genreId] ?? 0;
}

function nameOf(genres: Genre[], genreId: number): string | null {
  return genres.find((genre) => genre.id === genreId)?.name ?? null;
}

/** Explains why the ranking put a movie where it did, using the same weights
 * that produced the order. Nothing here re-decides anything: it reads the
 * profile the recommender already built. */
export function buildMatchInsight(
  movie: MovieSummary,
  profile: TasteProfile,
  genres: Genre[],
  position: number,
  batchSize: number,
): MatchInsight {
  const scored = movie.genreIds
    .map((genreId) => ({ genreId, weight: weightOf(profile, genreId) }))
    .sort((left, right) => right.weight - left.weight);

  const matchedGenres = scored
    .filter(({ weight }) => weight > 0)
    .map(({ genreId }) => nameOf(genres, genreId))
    .filter((name): name is string => name !== null);

  const clashingGenres = scored
    .filter(({ weight }) => weight < 0)
    .map(({ genreId }) => nameOf(genres, genreId))
    .filter((name): name is string => name !== null);

  // A clash outranks a match: a movie carrying a genre the viewer rejected is
  // a doubtful pick even when something else about it lines up.
  if (clashingGenres.length > 0) {
    return { tier: MATCH_TIER.LOW, matchedGenres, clashingGenres };
  }

  if (matchedGenres.length === 0) {
    return { tier: MATCH_TIER.LOW, matchedGenres, clashingGenres };
  }

  // Relative enthusiasm, not a verdict: everything here matched the profile,
  // and the ranking is what says which ones matched hardest.
  const isTopOfBatch = position < Math.ceil(batchSize * HIGH_TIER_SHARE);

  return {
    tier: isTopOfBatch ? MATCH_TIER.HIGH : MATCH_TIER.MEDIUM,
    matchedGenres,
    clashingGenres,
  };
}

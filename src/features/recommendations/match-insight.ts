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

function sumWeights(
  scored: readonly { weight: number }[],
  keep: (weight: number) => boolean,
): number {
  return scored.reduce(
    (total, { weight }) => (keep(weight) ? total + weight : total),
    0,
  );
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

  if (matchedGenres.length === 0) {
    return { tier: MATCH_TIER.LOW, matchedGenres, clashingGenres };
  }

  // A clash used to veto outright, which read as a verdict the ranking never
  // reached. Against a real profile that rejects one popular genre it made
  // eight cards in ten doubtful, including the movie the ranking had put
  // first: two genres the viewer prefers, one they merely dislike.
  //
  // Weighed instead of vetoed. A rejection still sinks a movie when it carries
  // more of it than of anything the viewer likes -- which is the case the
  // veto was reaching for -- and a secondary genre no longer overrules two
  // matches.
  const matchedWeight = sumWeights(scored, (weight) => weight > 0);
  const clashWeight = Math.abs(sumWeights(scored, (weight) => weight < 0));

  if (clashWeight >= matchedWeight) {
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

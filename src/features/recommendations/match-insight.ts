import type { Genre, MatchInsight, MovieSummary } from "@/contracts";

import type { TasteProfile } from "./taste-profile";

export const MATCH_TIER = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const satisfies Record<string, MatchInsight["tier"]>;

/** The tier a card gets by where the ranking put it. Candidates are generated
 * from the viewer's own genres, so almost every one of them matches two or
 * more: counting matches alone made every card a high match and left Buti with
 * a single expression. Position is what actually separates them.
 *
 * Six, three and one over ten, but interleaved rather than blocked. Six happy
 * faces in a row followed by three flat ones reads as a mood that changes once,
 * halfway down; spreading them means the face changes as the viewer swipes,
 * which is the whole point of having three.
 *
 * The pattern cycles, so it holds its shape across a refill and degrades
 * sensibly on a short batch: five candidates get the first five entries rather
 * than a forced doubtful one at the end. */
const TIER_PATTERN = [
  MATCH_TIER.HIGH,
  MATCH_TIER.HIGH,
  MATCH_TIER.MEDIUM,
  MATCH_TIER.HIGH,
  MATCH_TIER.HIGH,
  MATCH_TIER.HIGH,
  MATCH_TIER.MEDIUM,
  MATCH_TIER.HIGH,
  MATCH_TIER.LOW,
  MATCH_TIER.MEDIUM,
] as const satisfies readonly MatchInsight["tier"][];

function weightOf(profile: TasteProfile, genreId: number): number {
  return profile.genreWeights[genreId] ?? 0;
}

function tierForPosition(position: number): MatchInsight["tier"] {
  return TIER_PATTERN[position % TIER_PATTERN.length]!;
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
  return {
    tier: tierForPosition(position),
    matchedGenres,
    clashingGenres,
  };
}

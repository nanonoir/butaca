import type { MovieDetail } from "@/contracts";

/** What the viewer picked during onboarding is a starting tendency, not a
 * verdict. It has to mean something on an empty profile and then get out of the
 * way, so it is worth two likes rather than three -- at three it stayed the
 * loudest single term in the profile forever. */
const PREFERRED_GENRE_WEIGHT = 2;

/** Symmetric on purpose. A dislike used to weigh 1.5 against a like's 1, so any
 * genre appearing in both drifted negative however often it was liked: this
 * project's own account ended up rejecting Drama while every one of its twenty
 * most recent likes was a drama. */
const LIKED_GENRE_WEIGHT = 1;
const DISLIKED_GENRE_WEIGHT = -1;

/** Exclusion is a pattern, not a sum. A genre has to have been turned down
 * repeatedly *and* clearly more often than it was chosen. A scalar threshold
 * buried genres the viewer kept liking, because a dislike sprays across every
 * genre a movie carries and most carry three. */
const MIN_DISLIKES_TO_EXCLUDE = 3;
const EXCLUSION_RATIO = 2;

const MAX_KEYWORDS = 12;
const MAX_PEOPLE = 8;

/** The name travels with the id because the id alone can only steer a query.
 * Telling the viewer a movie is here because they keep watching Nolan needs the
 * word "Nolan", and it is sitting right there in the credits the profile is
 * built from. */
export type TastePerson = { id: number; name: string };

/** The most recent thing the viewer liked. It seeds a candidate query of its
 * own, and it is the only signal in the profile that can be named back as a
 * movie rather than as a trait. */
export type TasteSeed = { movieId: number; title: string };

/** How many recent likes can seed a batch. One would pin every deck to the same
 * film until the viewer liked something new. */
const MAX_SEEDS = 6;

/** How often each genre was chosen and turned down. The weights order the
 * genres; these say why one of them ended up excluded, which is the only way
 * that decision can be shown to the person it affects. */
export type TasteGenreCounts = {
  liked: Record<number, number>;
  disliked: Record<number, number>;
};

export type TasteProfile = {
  genreWeights: Record<number, number>;
  genreCounts: TasteGenreCounts;
  preferredGenreIds: number[];
  excludedGenreIds: number[];
  keywordIds: number[];
  cast: TastePerson[];
  crew: TastePerson[];
  seeds: TasteSeed[];
};

export type TasteProfileInput = {
  preferredGenreIds: number[];
  liked: MovieDetail[];
  disliked: MovieDetail[];
};

/** `order` exists because integer-like object keys iterate in ascending numeric
 * order, which would silently drop the tie-break to "lowest genre id wins". The
 * viewer's own ordering is the meaningful one. */
function addWeight(
  weights: Record<number, number>,
  order: number[],
  id: number,
  weight: number,
): void {
  if (weights[id] === undefined) {
    order.push(id);
  }

  weights[id] = (weights[id] ?? 0) + weight;
}

function topByFrequency(ids: number[], limit: number): number[] {
  const counts = new Map<number, number>();

  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(
      ([leftId, left], [rightId, right]) => right - left || leftId - rightId,
    )
    .slice(0, limit)
    .map(([id]) => id);
}

function topPeopleByFrequency(
  people: TastePerson[],
  limit: number,
): TastePerson[] {
  const counts = new Map<number, { person: TastePerson; count: number }>();

  for (const person of people) {
    const entry = counts.get(person.id);

    if (entry) {
      entry.count += 1;
      continue;
    }

    counts.set(person.id, { person, count: 1 });
  }

  return [...counts.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.person.id - right.person.id,
    )
    .slice(0, limit)
    .map(({ person }) => person);
}

/** Content-based only: the profile is built from what this viewer stated and
 * reacted to, never from what other viewers did. */
export function buildTasteProfile(input: TasteProfileInput): TasteProfile {
  const genreWeights: Record<number, number> = {};
  const genreOrder: number[] = [];

  for (const genreId of input.preferredGenreIds) {
    addWeight(genreWeights, genreOrder, genreId, PREFERRED_GENRE_WEIGHT);
  }

  // Counted as well as weighed. The weight orders the genres; deciding one is
  // rejected needs to know how often it was chosen, which a sum cannot say.
  const likedCount: Record<number, number> = {};
  const dislikedCount: Record<number, number> = {};

  for (const movie of input.liked) {
    for (const genre of movie.genres) {
      addWeight(genreWeights, genreOrder, genre.id, LIKED_GENRE_WEIGHT);
      likedCount[genre.id] = (likedCount[genre.id] ?? 0) + 1;
    }
  }

  for (const movie of input.disliked) {
    for (const genre of movie.genres) {
      addWeight(genreWeights, genreOrder, genre.id, DISLIKED_GENRE_WEIGHT);
      dislikedCount[genre.id] = (dislikedCount[genre.id] ?? 0) + 1;
    }
  }

  /** Turned down repeatedly, and clearly more often than it was chosen. A genre
   * somebody keeps liking is a genre they like, whatever the arithmetic of a
   * dislike spraying across the three genres every movie carries. */
  const isRejected = (genreId: number) =>
    (dislikedCount[genreId] ?? 0) >= MIN_DISLIKES_TO_EXCLUDE &&
    (dislikedCount[genreId] ?? 0) >= (likedCount[genreId] ?? 0) * EXCLUSION_RATIO;

  const excludedGenreIds = genreOrder
    .filter(isRejected)
    .sort((left, right) => left - right);

  return {
    genreWeights,
    genreCounts: { liked: likedCount, disliked: dislikedCount },
    // Sort is stable, so genres of equal weight keep the order the viewer gave
    // them instead of collapsing to whichever id happens to be lowest.
    preferredGenreIds: genreOrder
      .filter((id) => (genreWeights[id] ?? 0) > 0)
      .sort(
        (left, right) => (genreWeights[right] ?? 0) - (genreWeights[left] ?? 0),
      ),
    excludedGenreIds,
    keywordIds: topByFrequency(
      input.liked.flatMap((movie) => movie.keywords.map(({ id }) => id)),
      MAX_KEYWORDS,
    ),
    cast: topPeopleByFrequency(
      input.liked.flatMap((movie) =>
        movie.cast.map(({ id, name }) => ({ id, name })),
      ),
      MAX_PEOPLE,
    ),
    crew: topPeopleByFrequency(
      input.liked.flatMap((movie) =>
        movie.director
          ? [{ id: movie.director.id, name: movie.director.name }]
          : [],
      ),
      MAX_PEOPLE,
    ),
    // Newest first, so the head is the most recent like and the tail is still
    // recent enough to be worth asking about.
    //
    // A like sitting in a genre the profile now rejects is skipped. Tastes
    // move, and asking what goes with a drama somebody liked months ago fills
    // the deck with more of a genre they have since turned against -- every one
    // of those cards arriving with an explanation of why it is not their thing.
    seeds: input.liked
      .filter(
        (movie) =>
          !movie.genres.some(({ id }) => excludedGenreIds.includes(id)),
      )
      .slice(0, MAX_SEEDS)
      .map((movie) => ({ movieId: movie.id, title: movie.title })),
  };
}

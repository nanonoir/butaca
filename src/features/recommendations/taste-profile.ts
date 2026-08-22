import type { MovieDetail } from "@/contracts";

/** Weight given to a genre the viewer chose during onboarding. Stated
 * preferences outrank a single like but not a consistent pattern of them. */
const PREFERRED_GENRE_WEIGHT = 3;
const LIKED_GENRE_WEIGHT = 1;
const DISLIKED_GENRE_WEIGHT = -1.5;

/** A genre is only excluded once dislikes outweigh everything positive about
 * it, so one bad science-fiction movie does not bury the whole genre. */
const EXCLUSION_THRESHOLD = -2;

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

export type TasteProfile = {
  genreWeights: Record<number, number>;
  preferredGenreIds: number[];
  excludedGenreIds: number[];
  keywordIds: number[];
  cast: TastePerson[];
  crew: TastePerson[];
  seed: TasteSeed | null;
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

  for (const movie of input.liked) {
    for (const genre of movie.genres) {
      addWeight(genreWeights, genreOrder, genre.id, LIKED_GENRE_WEIGHT);
    }
  }

  for (const movie of input.disliked) {
    for (const genre of movie.genres) {
      addWeight(genreWeights, genreOrder, genre.id, DISLIKED_GENRE_WEIGHT);
    }
  }

  return {
    genreWeights,
    // Sort is stable, so genres of equal weight keep the order the viewer gave
    // them instead of collapsing to whichever id happens to be lowest.
    preferredGenreIds: genreOrder
      .filter((id) => (genreWeights[id] ?? 0) > 0)
      .sort(
        (left, right) => (genreWeights[right] ?? 0) - (genreWeights[left] ?? 0),
      ),
    excludedGenreIds: genreOrder
      .filter((id) => (genreWeights[id] ?? 0) <= EXCLUSION_THRESHOLD)
      .sort((left, right) => left - right),
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
    // The list arrives newest first, so the head is the most recent like.
    seed: input.liked[0]
      ? { movieId: input.liked[0].id, title: input.liked[0].title }
      : null,
  };
}

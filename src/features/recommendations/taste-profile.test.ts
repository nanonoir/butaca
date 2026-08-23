import { describe, expect, it } from "vitest";

import type { MovieDetail } from "@/contracts";

import { buildTasteProfile } from "./taste-profile";

function createMovie(overrides: Partial<MovieDetail> = {}): MovieDetail {
  return {
    id: 1,
    title: "Película",
    originalTitle: "Película",
    overview: "",
    tagline: null,
    posterPath: null,
    backdropPath: null,
    releaseDate: "2020-01-01",
    runtime: 100,
    originalLanguage: "en",
    genres: [],
    tmdbRating: 7,
    tmdbVoteCount: 500,
    director: null,
    cast: [],
    keywords: [],
    trailer: null,
    ...overrides,
  };
}

const EMPTY = { preferredGenreIds: [], liked: [], disliked: [] };

describe("buildTasteProfile", () => {
  it("ranks a stated preference above a single like", () => {
    const profile = buildTasteProfile({
      ...EMPTY,
      preferredGenreIds: [878],
      liked: [createMovie({ genres: [{ id: 18, name: "Drama" }] })],
    });

    expect(profile.preferredGenreIds[0]).toBe(878);
    expect(profile.genreWeights[878]).toBeGreaterThan(
      profile.genreWeights[18] ?? 0,
    );
  });

  it("lets a repeated like overtake a stated preference", () => {
    const drama = [{ id: 18, name: "Drama" }];
    const profile = buildTasteProfile({
      ...EMPTY,
      preferredGenreIds: [878],
      liked: [
        createMovie({ id: 1, genres: drama }),
        createMovie({ id: 2, genres: drama }),
        createMovie({ id: 3, genres: drama }),
        createMovie({ id: 4, genres: drama }),
      ],
    });

    expect(profile.preferredGenreIds[0]).toBe(18);
  });

  it("does not exclude a genre after a single dislike", () => {
    const profile = buildTasteProfile({
      ...EMPTY,
      disliked: [createMovie({ genres: [{ id: 27, name: "Terror" }] })],
    });

    expect(profile.excludedGenreIds).toEqual([]);
  });

  it("excludes a genre once it has been turned down repeatedly", () => {
    const horror = [{ id: 27, name: "Terror" }];
    const profile = buildTasteProfile({
      ...EMPTY,
      disliked: [
        createMovie({ id: 1, genres: horror }),
        createMovie({ id: 2, genres: horror }),
        createMovie({ id: 3, genres: horror }),
      ],
    });

    expect(profile.excludedGenreIds).toEqual([27]);
    expect(profile.preferredGenreIds).not.toContain(27);
  });

  /** A dislike sprays across every genre a movie carries, and most carry three.
   * Two of them is a coincidence, not a pattern. */
  it("does not bury a genre on a couple of dislikes", () => {
    const horror = [{ id: 27, name: "Terror" }];
    const profile = buildTasteProfile({
      ...EMPTY,
      disliked: [
        createMovie({ id: 1, genres: horror }),
        createMovie({ id: 2, genres: horror }),
      ],
    });

    expect(profile.excludedGenreIds).toEqual([]);
  });

  /** The whole point: somebody handing out likes to drama likes drama. The old
   * arithmetic weighed a dislike at 1.5 against a like's 1, so this account
   * ended up rejecting the genre of every one of its recent likes. */
  it("never rejects a genre the viewer keeps liking", () => {
    const drama = [{ id: 18, name: "Drama" }];
    const profile = buildTasteProfile({
      ...EMPTY,
      liked: Array.from({ length: 8 }, (_unused, index) =>
        createMovie({ id: index + 1, genres: drama }),
      ),
      disliked: Array.from({ length: 7 }, (_unused, index) =>
        createMovie({ id: index + 100, genres: drama }),
      ),
    });

    expect(profile.excludedGenreIds).toEqual([]);
    expect(profile.preferredGenreIds).toContain(18);
  });

  /** Onboarding is a starting tendency, not a verdict. What the viewer does
   * afterwards has to be able to overtake it. */
  it("lets a pattern of likes outweigh what onboarding was told", () => {
    const drama = [{ id: 18, name: "Drama" }];
    const profile = buildTasteProfile({
      preferredGenreIds: [27],
      liked: Array.from({ length: 4 }, (_unused, index) =>
        createMovie({ id: index + 1, genres: drama }),
      ),
      disliked: [],
    });

    expect(profile.preferredGenreIds[0]).toBe(18);
  });

  it("keeps a genre the viewer both likes and dislikes out of the exclusions", () => {
    const horror = [{ id: 27, name: "Terror" }];
    const profile = buildTasteProfile({
      preferredGenreIds: [27],
      liked: [createMovie({ id: 1, genres: horror })],
      disliked: [
        createMovie({ id: 2, genres: horror }),
        createMovie({ id: 3, genres: horror }),
      ],
    });

    expect(profile.excludedGenreIds).toEqual([]);
    expect(profile.preferredGenreIds).toContain(27);
  });

  it("collects keywords, cast and directors only from liked movies", () => {
    const profile = buildTasteProfile({
      ...EMPTY,
      liked: [
        createMovie({
          id: 1,
          keywords: [{ id: 100, name: "espacio" }],
          cast: [
            {
              id: 200,
              name: "Actriz",
              character: "Ella",
              profilePath: null,
              order: 0,
            },
          ],
          director: { id: 300, name: "Directora", profilePath: null },
        }),
      ],
      disliked: [
        createMovie({
          id: 2,
          keywords: [{ id: 999, name: "no" }],
          director: { id: 998, name: "Otro", profilePath: null },
        }),
      ],
    });

    expect(profile.keywordIds).toEqual([100]);
    expect(profile.cast.map(({ id }) => id)).toEqual([200]);
    expect(profile.crew.map(({ id }) => id)).toEqual([300]);
  });

  it("orders keywords by how often they appear across likes", () => {
    const profile = buildTasteProfile({
      ...EMPTY,
      liked: [
        createMovie({ id: 1, keywords: [{ id: 10, name: "a" }] }),
        createMovie({
          id: 2,
          keywords: [
            { id: 20, name: "b" },
            { id: 10, name: "a" },
          ],
        }),
      ],
    });

    expect(profile.keywordIds[0]).toBe(10);
  });

  it("returns an empty profile for a viewer with nothing recorded", () => {
    expect(buildTasteProfile(EMPTY)).toEqual({
      genreWeights: {},
      preferredGenreIds: [],
      excludedGenreIds: [],
      keywordIds: [],
      cast: [],
      crew: [],
      seeds: [],
    });
  });
});

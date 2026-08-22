import { describe, expect, it } from "vitest";

import type { MovieSummary } from "@/contracts";

import { excludeMovies, rankMovies, scoreMovie } from "./ranking";
import type { TasteProfile } from "./taste-profile";

function createMovie(overrides: Partial<MovieSummary> = {}): MovieSummary {
  return {
    id: 1,
    title: "Película",
    originalTitle: "Película",
    overview: "",
    posterPath: null,
    backdropPath: null,
    genreIds: [],
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating: 7,
    tmdbVoteCount: 2_000,
    ...overrides,
  };
}

function createProfile(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return {
    genreWeights: {},
    preferredGenreIds: [],
    excludedGenreIds: [],
    keywordIds: [],
    castIds: [],
    crewIds: [],
    ...overrides,
  };
}

describe("scoreMovie", () => {
  it("rewards a movie that matches a weighted genre", () => {
    const profile = createProfile({ genreWeights: { 878: 3 } });

    expect(
      scoreMovie(createMovie({ genreIds: [878] }), profile),
    ).toBeGreaterThan(scoreMovie(createMovie({ genreIds: [99] }), profile));
  });

  it("penalises a movie carrying a negatively weighted genre", () => {
    const profile = createProfile({ genreWeights: { 878: 3, 27: -3 } });

    expect(
      scoreMovie(createMovie({ genreIds: [878, 27] }), profile),
    ).toBeLessThan(scoreMovie(createMovie({ genreIds: [878] }), profile));
  });

  it("lets the rating separate two equally matching movies", () => {
    const profile = createProfile({ genreWeights: { 18: 2 } });
    const better = createMovie({ id: 1, genreIds: [18], tmdbRating: 9 });
    const worse = createMovie({ id: 2, genreIds: [18], tmdbRating: 5 });

    expect(scoreMovie(better, profile)).toBeGreaterThan(
      scoreMovie(worse, profile),
    );
  });

  it("does not let a thinly voted rating beat a genre match", () => {
    const profile = createProfile({ genreWeights: { 18: 2 } });
    const match = createMovie({ id: 1, genreIds: [18], tmdbRating: 5 });
    const unrelatedHit = createMovie({
      id: 2,
      genreIds: [99],
      tmdbRating: 10,
      tmdbVoteCount: 3,
    });

    expect(scoreMovie(match, profile)).toBeGreaterThan(
      scoreMovie(unrelatedHit, profile),
    );
  });
});

describe("rankMovies", () => {
  it("orders by taste match and honours the limit", () => {
    const profile = createProfile({ genreWeights: { 878: 5, 18: 2 } });
    const ranked = rankMovies(
      [
        createMovie({ id: 1, genreIds: [18] }),
        createMovie({ id: 2, genreIds: [878] }),
        createMovie({ id: 3, genreIds: [99] }),
      ],
      profile,
      2,
    );

    expect(ranked.map((movie) => movie.id)).toEqual([2, 1]);
  });

  it("breaks ties deterministically so the batch is stable", () => {
    const profile = createProfile({ genreWeights: { 18: 2 } });
    const movies = [
      createMovie({ id: 7, genreIds: [18] }),
      createMovie({ id: 3, genreIds: [18] }),
    ];

    expect(rankMovies(movies, profile, 2).map((movie) => movie.id)).toEqual([
      3, 7,
    ]);
    expect(
      rankMovies([...movies].reverse(), profile, 2).map((m) => m.id),
    ).toEqual([3, 7]);
  });
});

describe("excludeMovies", () => {
  it("removes movies the viewer already reacted to", () => {
    const result = excludeMovies(
      [createMovie({ id: 1 }), createMovie({ id: 2 })],
      [2],
    );

    expect(result.map((movie) => movie.id)).toEqual([1]);
  });

  it("drops duplicates coming from overlapping candidate pages", () => {
    const result = excludeMovies(
      [createMovie({ id: 1 }), createMovie({ id: 1 }), createMovie({ id: 2 })],
      [],
    );

    expect(result.map((movie) => movie.id)).toEqual([1, 2]);
  });
});

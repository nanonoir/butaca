import { describe, expect, it } from "vitest";

import type { Genre, MovieSummary } from "@/contracts";

import { buildMatchInsight, MATCH_TIER } from "./match-insight";
import type { TasteProfile } from "./taste-profile";

const GENRES: Genre[] = [
  { id: 878, name: "Ciencia ficción" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Terror" },
  { id: 35, name: "Comedia" },
];

const BATCH_SIZE = 10;
const TOP_POSITION = 0;
const LOWER_POSITION = 7;

function createMovie(genreIds: number[]): MovieSummary {
  return {
    id: 1,
    title: "Película",
    originalTitle: "Película",
    overview: "",
    posterPath: null,
    backdropPath: null,
    genreIds,
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating: 8,
    tmdbVoteCount: 2_000,
  };
}

function createProfile(genreWeights: Record<number, number>): TasteProfile {
  return {
    genreWeights,
    preferredGenreIds: [],
    excludedGenreIds: [],
    keywordIds: [],
    castIds: [],
    crewIds: [],
  };
}

function insightAt(
  genreIds: number[],
  genreWeights: Record<number, number>,
  position: number,
) {
  return buildMatchInsight(
    createMovie(genreIds),
    createProfile(genreWeights),
    GENRES,
    position,
    BATCH_SIZE,
  );
}

describe("buildMatchInsight", () => {
  it("names the genres the movie shares with the profile", () => {
    const insight = insightAt([878, 18], { 878: 3, 18: 2 }, TOP_POSITION);

    expect(insight.matchedGenres).toEqual(["Ciencia ficción", "Drama"]);
  });

  it("orders the matched genres by how much the viewer likes them", () => {
    const insight = insightAt([18, 878], { 878: 5, 18: 1 }, TOP_POSITION);

    expect(insight.matchedGenres).toEqual(["Ciencia ficción", "Drama"]);
  });

  it("keeps the enthusiastic face for the top of the batch", () => {
    expect(insightAt([878, 18], { 878: 3, 18: 2 }, TOP_POSITION).tier).toBe(
      MATCH_TIER.HIGH,
    );
  });

  /** Candidates are generated from the viewer's own genres, so counting matches
   * alone made every card a high match. */
  it("cools down further along the batch even when the genres still match", () => {
    expect(insightAt([878, 18], { 878: 3, 18: 2 }, LOWER_POSITION).tier).toBe(
      MATCH_TIER.MEDIUM,
    );
  });

  it("treats a rejected genre as doubtful when it outweighs the match", () => {
    const insight = insightAt([878, 27], { 878: 3, 27: -3 }, TOP_POSITION);

    expect(insight.tier).toBe(MATCH_TIER.LOW);
    expect(insight.clashingGenres).toEqual(["Terror"]);
    expect(insight.matchedGenres).toEqual(["Ciencia ficción"]);
  });

  /** Vetoing on any clash made eight cards in ten doubtful against a real
   * profile, the movie the ranking had put first among them. */
  it("does not let a secondary dislike overrule two preferred genres", () => {
    const insight = insightAt(
      [878, 27, 35],
      { 878: 3, 27: 3, 35: -1.5 },
      TOP_POSITION,
    );

    expect(insight.tier).toBe(MATCH_TIER.HIGH);
    expect(insight.matchedGenres).toEqual(["Ciencia ficción", "Terror"]);
    expect(insight.clashingGenres).toEqual(["Comedia"]);
  });

  it("still cools a mild match carrying a firm dislike", () => {
    expect(
      insightAt([878, 35], { 878: 1, 35: -1.5 }, TOP_POSITION).tier,
    ).toBe(MATCH_TIER.LOW);
  });

  it("keeps a clash off the top when it exactly cancels the match", () => {
    expect(
      insightAt([878, 35], { 878: 1.5, 35: -1.5 }, TOP_POSITION).tier,
    ).toBe(MATCH_TIER.LOW);
  });

  it("calls a movie with nothing in common a low match", () => {
    const insight = insightAt([35], { 878: 3 }, TOP_POSITION);

    expect(insight.tier).toBe(MATCH_TIER.LOW);
    expect(insight.matchedGenres).toEqual([]);
  });

  it("skips a genre the catalog cannot name", () => {
    const insight = insightAt([878, 9_999], { 878: 3, 9_999: 2 }, TOP_POSITION);

    expect(insight.matchedGenres).toEqual(["Ciencia ficción"]);
  });

  /** These are ranked, already-filtered recommendations, so most of a batch
   * ought to read as a good pick rather than as a shrug -- while still leaving
   * room for the doubtful face, which a well ranked deck would never show. */
  it("splits a ten card batch six, three and one", () => {
    const tiers = Array.from({ length: BATCH_SIZE }, (_unused, position) =>
      insightAt([878, 18], { 878: 3, 18: 2 }, position),
    ).map(({ tier }) => tier);

    expect(tiers).toEqual([
      MATCH_TIER.HIGH,
      MATCH_TIER.HIGH,
      MATCH_TIER.HIGH,
      MATCH_TIER.HIGH,
      MATCH_TIER.HIGH,
      MATCH_TIER.HIGH,
      MATCH_TIER.MEDIUM,
      MATCH_TIER.MEDIUM,
      MATCH_TIER.MEDIUM,
      MATCH_TIER.LOW,
    ]);
  });

  it("closes the batch on a doubtful note even when the genres match well", () => {
    const insight = insightAt([878, 18], { 878: 3, 18: 2 }, BATCH_SIZE - 1);

    expect(insight.tier).toBe(MATCH_TIER.LOW);
    expect(insight.matchedGenres).toEqual(["Ciencia ficción", "Drama"]);
    expect(insight.clashingGenres).toEqual([]);
  });
});

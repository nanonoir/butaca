import { describe, expect, it } from "vitest";

import { BUTI_MATCH } from "@/components/shared/buti-mascot";
import type { MatchInsight, MatchTier } from "@/contracts/discover";
import type { MovieSummary } from "@/contracts/movies";

import { getButiInsight } from "./buti-recommendation";

/** Three phrasings per tier, so three ids that land on a different one each. */
const IDS_PER_TIER = [300, 301, 302];

function createMovie(id: number, tmdbRating = 7.4): MovieSummary {
  return {
    id,
    title: "Película",
    originalTitle: "Película",
    overview: "",
    posterPath: null,
    backdropPath: null,
    genreIds: [878, 18],
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating,
    tmdbVoteCount: 2_000,
  };
}

function createInsight(
  tier: MatchTier,
  matchedGenres: string[],
  clashingGenres: string[] = [],
): MatchInsight {
  return { tier, matchedGenres, clashingGenres };
}

function opinionsFor(insight: MatchInsight): string[] {
  return IDS_PER_TIER.map(
    (id) => getButiInsight(createMovie(id), insight).opinion,
  );
}

describe("getButiInsight", () => {
  it("carries three distinct lines for a strong match", () => {
    const opinions = opinionsFor(
      createInsight("high", ["Ciencia ficción", "Drama"]),
    );

    expect(new Set(opinions).size).toBe(3);
    for (const opinion of opinions) {
      expect(opinion).toContain("Ciencia ficción y Drama");
    }
  });

  it("carries three distinct lines for a middling match", () => {
    const opinions = opinionsFor(
      createInsight("medium", ["Ciencia ficción", "Drama"]),
    );

    expect(new Set(opinions).size).toBe(3);
  });

  it("carries three distinct lines for a doubtful pick", () => {
    const opinions = opinionsFor(
      createInsight("low", ["Ciencia ficción"], ["Terror"]),
    );

    expect(new Set(opinions).size).toBe(3);
    for (const opinion of opinions) {
      expect(opinion).toContain("terror, que venís descartando");
      expect(opinion).toContain("7.4");
    }
  });

  it("keeps a strong line and a middling one from reading alike", () => {
    const genres = ["Ciencia ficción", "Drama"];
    const high = opinionsFor(createInsight("high", genres));
    const medium = opinionsFor(createInsight("medium", genres));

    expect(high.filter((line) => medium.includes(line))).toEqual([]);
  });

  /** The line used to say "tus dos fuertes", which turned into nonsense on a
   * movie that only shared one genre with the viewer. */
  it("reads correctly whether one genre matched or two", () => {
    for (const tier of ["high", "medium"] as const) {
      for (const opinion of opinionsFor(createInsight(tier, ["Drama"]))) {
        expect(opinion).toContain("Drama");
        expect(opinion).not.toMatch(/\bdos\b/);
        expect(opinion).not.toContain(" y .");
      }
    }
  });

  it("says the viewer has nothing in common with it when nothing matched", () => {
    const opinions = opinionsFor(createInsight("low", []));

    expect(new Set(opinions).size).toBe(3);
    for (const opinion of opinions) {
      expect(opinion).toMatch(/no toca ninguno de tus géneros/i);
    }
  });

  /** The last card of a batch reads as doubtful by position alone. Telling the
   * viewer it touches none of their genres would be a plain lie about a movie
   * that matched two of them. */
  it("does not claim a movie missed when it closed a batch that matched", () => {
    const opinions = opinionsFor(
      createInsight("low", ["Ciencia ficción", "Drama"]),
    );

    expect(new Set(opinions).size).toBe(3);
    for (const opinion of opinions) {
      expect(opinion).toContain("Ciencia ficción y Drama");
      expect(opinion).not.toMatch(/no toca ninguno/i);
      expect(opinion).not.toContain("descartando");
    }
  });

  it("starts its sentence with a capital letter whichever reason it carries", () => {
    for (const insight of [
      createInsight("low", []),
      createInsight("low", ["Drama"]),
      createInsight("low", ["Drama"], ["Terror"]),
    ]) {
      for (const opinion of opinionsFor(insight)) {
        expect(opinion.charAt(0)).toBe(opinion.charAt(0).toUpperCase());
      }
    }
  });

  it("never leaves a slot unfilled", () => {
    const cases: MatchInsight[] = [
      createInsight("high", ["Drama"]),
      createInsight("high", ["Drama", "Acción"]),
      createInsight("medium", ["Drama"]),
      createInsight("medium", ["Drama", "Acción"]),
      createInsight("low", [], ["Terror"]),
      createInsight("low", ["Drama"], ["Terror"]),
      createInsight("low", []),
    ];

    for (const insight of cases) {
      for (const opinion of opinionsFor(insight)) {
        expect(opinion).not.toMatch(/\{(genres|reason|rating)\}/);
        expect(opinion.trim()).not.toBe("");
      }
    }
  });

  it("gives a movie the same line every time it is asked", () => {
    const insight = createInsight("high", ["Drama"]);
    const movie = createMovie(4_242);

    expect(getButiInsight(movie, insight).opinion).toBe(
      getButiInsight(movie, insight).opinion,
    );
  });

  it("matches the face to the tier", () => {
    expect(
      getButiInsight(createMovie(1), createInsight("high", ["Drama"])).match,
    ).toBe(BUTI_MATCH.HIGH);
    expect(
      getButiInsight(createMovie(1), createInsight("medium", ["Drama"])).match,
    ).toBe(BUTI_MATCH.MEDIUM);
    expect(
      getButiInsight(createMovie(1), createInsight("low", [], ["Terror"]))
        .match,
    ).toBe(BUTI_MATCH.LOW);
  });

  /** A tier with no genre to name would render a phrase around an empty slot. */
  it("falls to the doubtful lines when there is no genre to name", () => {
    const insight = getButiInsight(
      createMovie(1),
      createInsight("high", []),
    );

    expect(insight.match).toBe(BUTI_MATCH.LOW);
    expect(insight.opinion).toMatch(/no toca ninguno de tus géneros/i);
  });
});

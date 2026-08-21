import { describe, expect, it, vi } from "vitest";

import { MovieDetailPageDataSchema, type MovieDetail } from "@/contracts";

import { MovieDetailService } from "./movie-detail-service";

const MOVIE_ID = 157_336;
const VIEWER = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Sofía",
  avatarUrl: null,
};

function createDetail(): MovieDetail {
  return {
    id: MOVIE_ID,
    title: "Interstellar",
    originalTitle: "Interstellar",
    overview: "Un viaje más allá del sistema solar.",
    tagline: null,
    posterPath: "/poster.jpg",
    backdropPath: null,
    releaseDate: "2014-11-05",
    runtime: 169,
    originalLanguage: "en",
    genres: [{ id: 18, name: "Drama" }],
    tmdbRating: 8.4,
    tmdbVoteCount: 30_000,
    director: null,
    cast: [],
    keywords: [],
    trailer: null,
  };
}

const EMPTY_SUMMARY = {
  recommended: 0,
  notWorthIt: 0,
  total: 0,
  recommendationRate: null,
};

function createDependencies() {
  return {
    catalog: { getMovieDetail: vi.fn().mockResolvedValue(createDetail()) },
    interactions: { getViewerState: vi.fn() },
    reviews: {
      getSummary: vi.fn().mockResolvedValue(EMPTY_SUMMARY),
      getMyReview: vi.fn(),
    },
  };
}

describe("getPageData", () => {
  it("composes the four parts of the detail contract for a viewer", async () => {
    const { catalog, interactions, reviews } = createDependencies();
    interactions.getViewerState.mockResolvedValue({
      reaction: "LIKE",
      watchedAt: null,
    });
    reviews.getMyReview.mockResolvedValue(null);

    const pageData = await new MovieDetailService(
      catalog,
      interactions,
      reviews,
    ).getPageData(MOVIE_ID, VIEWER);

    expect(pageData.movie.id).toBe(MOVIE_ID);
    expect(pageData.viewerState).toEqual({ reaction: "LIKE", watchedAt: null });
    expect(MovieDetailPageDataSchema.safeParse(pageData).success).toBe(true);
  });

  it("does not query owner-scoped data for a guest", async () => {
    const { catalog, interactions, reviews } = createDependencies();

    const pageData = await new MovieDetailService(
      catalog,
      interactions,
      reviews,
    ).getPageData(MOVIE_ID, null);

    expect(pageData.viewerState).toEqual({ reaction: null, watchedAt: null });
    expect(pageData.myReview).toBeNull();
    expect(interactions.getViewerState).not.toHaveBeenCalled();
    expect(reviews.getMyReview).not.toHaveBeenCalled();
    expect(MovieDetailPageDataSchema.safeParse(pageData).success).toBe(true);
  });

  it("scopes both owner reads by the viewer", async () => {
    const { catalog, interactions, reviews } = createDependencies();
    interactions.getViewerState.mockResolvedValue({
      reaction: null,
      watchedAt: null,
    });
    reviews.getMyReview.mockResolvedValue(null);

    await new MovieDetailService(catalog, interactions, reviews).getPageData(
      MOVIE_ID,
      VIEWER,
    );

    expect(interactions.getViewerState).toHaveBeenCalledWith(
      VIEWER.id,
      MOVIE_ID,
    );
    expect(reviews.getMyReview).toHaveBeenCalledWith(VIEWER, MOVIE_ID);
  });

  it("propagates a catalog failure instead of returning a partial page", async () => {
    const { catalog, interactions, reviews } = createDependencies();
    catalog.getMovieDetail.mockRejectedValue(new Error("catalog down"));
    interactions.getViewerState.mockResolvedValue({
      reaction: null,
      watchedAt: null,
    });
    reviews.getMyReview.mockResolvedValue(null);

    await expect(
      new MovieDetailService(catalog, interactions, reviews).getPageData(
        MOVIE_ID,
        VIEWER,
      ),
    ).rejects.toThrow("catalog down");
  });
});

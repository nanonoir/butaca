import { describe, expect, it, vi } from "vitest";

import { ReviewSchema, ReviewSummarySchema } from "@/contracts";

import type { ReviewRecord } from "../../db/schema/reviews";

import { ReviewService } from "./review-service";

const VIEWER = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Sofía",
  avatarUrl: null,
};
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const MOVIE_ID = 157_336;
const CREATED_AT = new Date("2026-08-20T12:00:00.000Z");

function createRepository() {
  return {
    findByMovie: vi.fn(),
    findByUserAndMovie: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    countByVerdict: vi.fn(),
  };
}

function createReviewRecord(
  overrides: Partial<ReviewRecord> = {},
): ReviewRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    userId: VIEWER.id,
    movieId: MOVIE_ID,
    verdict: "RECOMMENDED",
    title: "Una obra maestra",
    description: "Vale completamente las tres horas que dura.",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

describe("getSummary", () => {
  it("aggregates both verdicts and the recommendation rate", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 3,
      notWorthIt: 1,
    });

    const summary = await new ReviewService(repository).getSummary(MOVIE_ID);

    expect(summary).toEqual({
      recommended: 3,
      notWorthIt: 1,
      total: 4,
      recommendationRate: 75,
    });
    expect(ReviewSummarySchema.safeParse(summary).success).toBe(true);
  });

  it("reports a null rate for a movie without reviews", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 0,
      notWorthIt: 0,
    });

    const summary = await new ReviewService(repository).getSummary(MOVIE_ID);

    expect(summary).toMatchObject({ total: 0, recommendationRate: null });
    expect(ReviewSummarySchema.safeParse(summary).success).toBe(true);
  });

  it("does not round a single detractor away", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 199,
      notWorthIt: 1,
    });

    await expect(
      new ReviewService(repository).getSummary(MOVIE_ID),
    ).resolves.toMatchObject({ recommendationRate: 99.5 });
  });
});

describe("getMovieReviews", () => {
  it("marks only the viewer's own review as mine", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 2,
      notWorthIt: 0,
    });
    repository.findByMovie.mockResolvedValue([
      {
        review: createReviewRecord(),
        author: { displayName: "Sofía", avatarUrl: null },
      },
      {
        review: createReviewRecord({
          id: "44444444-4444-4444-8444-444444444444",
          userId: OTHER_USER_ID,
        }),
        author: { displayName: "Otro", avatarUrl: null },
      },
    ]);

    const result = await new ReviewService(repository).getMovieReviews(
      MOVIE_ID,
      1,
      VIEWER.id,
    );

    expect(result.data.map((review) => review.isMine)).toEqual([true, false]);
    expect(ReviewSchema.array().safeParse(result.data).success).toBe(true);
  });

  it("marks nothing as mine for a guest", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 1,
      notWorthIt: 0,
    });
    repository.findByMovie.mockResolvedValue([
      {
        review: createReviewRecord(),
        author: { displayName: "Sofía", avatarUrl: null },
      },
    ]);

    const result = await new ReviewService(repository).getMovieReviews(
      MOVIE_ID,
      1,
      null,
    );

    expect(result.data[0]?.isMine).toBe(false);
  });

  it("derives pagination from the verdict totals", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 20,
      notWorthIt: 5,
    });
    repository.findByMovie.mockResolvedValue([]);

    const result = await new ReviewService(repository).getMovieReviews(
      MOVIE_ID,
      1,
      null,
    );

    expect(result.meta).toEqual({
      page: 1,
      pageSize: 20,
      totalPages: 2,
      totalResults: 25,
      hasNextPage: true,
    });
  });

  it("reports no next page on the last one", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 25,
      notWorthIt: 0,
    });
    repository.findByMovie.mockResolvedValue([]);

    await expect(
      new ReviewService(repository).getMovieReviews(MOVIE_ID, 2, null),
    ).resolves.toMatchObject({ meta: { hasNextPage: false, totalPages: 2 } });
  });

  it("falls back to no avatar when the stored value is not a URL", async () => {
    const repository = createRepository();
    repository.countByVerdict.mockResolvedValue({
      recommended: 1,
      notWorthIt: 0,
    });
    repository.findByMovie.mockResolvedValue([
      {
        review: createReviewRecord(),
        author: { displayName: "Sofía", avatarUrl: "lilac" },
      },
    ]);

    const result = await new ReviewService(repository).getMovieReviews(
      MOVIE_ID,
      1,
      null,
    );

    expect(result.data[0]?.author).toEqual({
      displayName: "Sofía",
      avatarUrl: null,
    });
    expect(ReviewSchema.array().safeParse(result.data).success).toBe(true);
  });
});

describe("getMyReview", () => {
  it("uses the session profile as the author", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(createReviewRecord());

    const review = await new ReviewService(repository).getMyReview(
      VIEWER,
      MOVIE_ID,
    );

    expect(review).toMatchObject({
      isMine: true,
      author: { displayName: "Sofía", avatarUrl: null },
    });
    expect(ReviewSchema.safeParse(review).success).toBe(true);
  });

  it("returns null when the viewer has not reviewed the movie", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(null);

    await expect(
      new ReviewService(repository).getMyReview(VIEWER, MOVIE_ID),
    ).resolves.toBeNull();
  });
});

describe("deleteReview", () => {
  it("deletes scoped by the owner", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(createReviewRecord());
    repository.delete.mockResolvedValue(true);

    await expect(
      new ReviewService(repository).deleteReview(VIEWER.id, MOVIE_ID),
    ).resolves.toEqual({ movieId: MOVIE_ID, deleted: true });
    expect(repository.delete).toHaveBeenCalledWith(
      VIEWER.id,
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("rejects deleting a review the viewer does not have", async () => {
    const repository = createRepository();
    repository.findByUserAndMovie.mockResolvedValue(null);

    await expect(
      new ReviewService(repository).deleteReview(VIEWER.id, MOVIE_ID),
    ).rejects.toMatchObject({ code: "REVIEW_NOT_FOUND" });
    expect(repository.delete).not.toHaveBeenCalled();
  });
});

describe("upsertReview", () => {
  it("returns the stored review as the viewer's own", async () => {
    const repository = createRepository();
    repository.upsert.mockResolvedValue(createReviewRecord());

    const review = await new ReviewService(repository).upsertReview(
      VIEWER,
      MOVIE_ID,
      {
        verdict: "RECOMMENDED",
        title: "Una obra maestra",
        description: "Vale completamente las tres horas que dura.",
      },
    );

    expect(review.isMine).toBe(true);
    expect(ReviewSchema.safeParse(review).success).toBe(true);
  });
});

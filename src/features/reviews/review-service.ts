import "server-only";

import {
  PAGE_SIZE,
  ReviewAuthorSchema,
  type Review,
  type ReviewSummary,
  type UpsertReviewRequest,
} from "@/contracts";
import { ApiRouteError } from "@/lib/api/route";

import type { ReviewRepository } from "../../db/repositories";
import type { ReviewRecord } from "../../db/schema/reviews";
import type { UserRecord } from "../../db/schema/users";

type ReviewPort = Pick<
  ReviewRepository,
  "findByMovie" | "findByUserAndMovie" | "upsert" | "delete" | "countByVerdict"
>;

type ReviewAuthor = Pick<UserRecord, "displayName" | "avatarUrl">;

export type PaginatedReviews = {
  data: Review[];
  meta: {
    page: number;
    pageSize: typeof PAGE_SIZE;
    totalPages: number;
    totalResults: number;
    hasNextPage: boolean;
  };
};

/** `users.avatar_url` is plain text while the contract demands a URL. Anything
 * that is not one is reported as "no avatar" instead of failing the response. */
function toAuthor(author: ReviewAuthor) {
  const parsed = ReviewAuthorSchema.safeParse(author);

  return parsed.success
    ? parsed.data
    : { displayName: author.displayName, avatarUrl: null };
}

function toReview(
  review: ReviewRecord,
  author: ReviewAuthor,
  viewerId: string | null,
): Review {
  return {
    id: review.id,
    movieId: review.movieId,
    author: toAuthor(author),
    verdict: review.verdict,
    title: review.title,
    description: review.description,
    isMine: viewerId !== null && review.userId === viewerId,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

/** Kept to one decimal: rounding to an integer would show 100% for a movie
 * that still has a detractor. */
function toRecommendationRate(
  recommended: number,
  total: number,
): number | null {
  if (total === 0) {
    return null;
  }

  return Math.round((recommended / total) * 1000) / 10;
}

export class ReviewService {
  constructor(private readonly reviews: ReviewPort) {}

  async getSummary(movieId: number): Promise<ReviewSummary> {
    const { recommended, notWorthIt } =
      await this.reviews.countByVerdict(movieId);
    const total = recommended + notWorthIt;

    return {
      recommended,
      notWorthIt,
      total,
      recommendationRate: toRecommendationRate(recommended, total),
    };
  }

  /** `viewerId` marks ownership only. Community reviews are public, so a guest
   * gets the same list with every `isMine` false. */
  async getMovieReviews(
    movieId: number,
    page: number,
    viewerId: string | null,
  ): Promise<PaginatedReviews> {
    const [entries, summary] = await Promise.all([
      this.reviews.findByMovie(movieId, page),
      this.getSummary(movieId),
    ]);
    const totalPages = Math.ceil(summary.total / PAGE_SIZE);

    return {
      data: entries.map(({ review, author }) =>
        toReview(review, author, viewerId),
      ),
      meta: {
        page,
        pageSize: PAGE_SIZE,
        totalPages,
        totalResults: summary.total,
        hasNextPage: page < totalPages,
      },
    };
  }

  /** The author of "my review" is the viewer, so the profile comes from the
   * session rather than from a second query. */
  async getMyReview(
    viewer: Pick<UserRecord, "id" | "displayName" | "avatarUrl">,
    movieId: number,
  ): Promise<Review | null> {
    const review = await this.reviews.findByUserAndMovie(viewer.id, movieId);

    return review ? toReview(review, viewer, viewer.id) : null;
  }

  async upsertReview(
    viewer: Pick<UserRecord, "id" | "displayName" | "avatarUrl">,
    movieId: number,
    input: UpsertReviewRequest,
  ): Promise<Review> {
    const review = await this.reviews.upsert(viewer.id, movieId, input);

    return toReview(review, viewer, viewer.id);
  }

  async deleteReview(
    userId: string,
    movieId: number,
  ): Promise<{ movieId: number; deleted: true }> {
    const review = await this.reviews.findByUserAndMovie(userId, movieId);

    if (!review) {
      throw new ApiRouteError("REVIEW_NOT_FOUND");
    }

    // Scoped by userId as well as review id: ownership is enforced in SQL, not
    // by having looked the review up first.
    const deleted = await this.reviews.delete(userId, review.id);

    if (!deleted) {
      throw new ApiRouteError("REVIEW_NOT_FOUND");
    }

    return { movieId, deleted: true };
  }
}

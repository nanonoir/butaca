import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import { PAGE_SIZE } from "../../contracts/common";
import type { Database } from "../client";
import {
  type NewReviewRecord,
  type ReviewRecord,
  reviews,
} from "../schema/reviews";
import { type UserRecord, users } from "../schema/users";

export type ReviewWriteInput = Pick<
  NewReviewRecord,
  "verdict" | "title" | "description"
>;

export type ReviewWithAuthor = {
  review: ReviewRecord;
  author: Pick<UserRecord, "displayName" | "avatarUrl">;
};

export class ReviewRepository {
  constructor(private readonly db: Database) {}

  async findById(reviewId: string): Promise<ReviewRecord | null> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    return review ?? null;
  }

  async findByUserAndMovie(
    userId: string,
    movieId: number,
  ): Promise<ReviewRecord | null> {
    const [review] = await this.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.movieId, movieId)))
      .limit(1);

    return review ?? null;
  }

  async findByMovie(movieId: number, page = 1): Promise<ReviewWithAuthor[]> {
    return this.db
      .select({
        review: reviews,
        author: {
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.movieId, movieId))
      .orderBy(desc(reviews.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
  }

  async create(
    userId: string,
    movieId: number,
    input: ReviewWriteInput,
  ): Promise<ReviewRecord> {
    const [review] = await this.db
      .insert(reviews)
      .values({ userId, movieId, ...input })
      .returning();

    if (!review) {
      throw new Error("Could not create review");
    }

    return review;
  }

  async update(
    userId: string,
    reviewId: string,
    input: ReviewWriteInput,
  ): Promise<ReviewRecord | null> {
    const [review] = await this.db
      .update(reviews)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(reviews.userId, userId), eq(reviews.id, reviewId)))
      .returning();

    return review ?? null;
  }

  async upsert(
    userId: string,
    movieId: number,
    input: ReviewWriteInput,
  ): Promise<ReviewRecord> {
    const [review] = await this.db
      .insert(reviews)
      .values({ userId, movieId, ...input })
      .onConflictDoUpdate({
        target: [reviews.userId, reviews.movieId],
        set: { ...input, updatedAt: new Date() },
      })
      .returning();

    if (!review) {
      throw new Error("Could not upsert review");
    }

    return review;
  }

  async delete(userId: string, reviewId: string): Promise<boolean> {
    const [review] = await this.db
      .delete(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.id, reviewId)))
      .returning({ id: reviews.id });

    return review !== undefined;
  }

  async countByVerdict(
    movieId: number,
  ): Promise<{ recommended: number; notWorthIt: number }> {
    const verdictCounts = await this.db
      .select({ verdict: reviews.verdict, total: count() })
      .from(reviews)
      .where(eq(reviews.movieId, movieId))
      .groupBy(reviews.verdict);
    const totals = { recommended: 0, notWorthIt: 0 };

    for (const { verdict, total } of verdictCounts) {
      if (verdict === "RECOMMENDED") {
        totals.recommended = total;
      } else {
        totals.notWorthIt = total;
      }
    }

    return totals;
  }

  /** Review total for the profile screen, scoped to the owner. */
  async countByUser(userId: string): Promise<number> {
    const [total] = await this.db
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.userId, userId));

    return total?.total ?? 0;
  }
}

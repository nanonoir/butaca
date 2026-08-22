import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { type NewUserRecord, type UserRecord, users } from "../schema/users";

export type UserProfileInput = Pick<
  NewUserRecord,
  "id" | "displayName" | "avatarUrl"
>;

export type UserProfileUpdate = Partial<
  Pick<UserRecord, "displayName" | "avatarUrl" | "onboardingCompletedAt">
>;

export class UserRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(userId: string): Promise<UserRecord | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }

  async create(input: UserProfileInput): Promise<UserRecord> {
    const [user] = await this.db.insert(users).values(input).returning();

    if (!user) {
      throw new Error("Could not create user profile");
    }

    return user;
  }

  async update(
    userId: string,
    input: UserProfileUpdate,
  ): Promise<UserRecord | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(userId);
    }

    const [user] = await this.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return user ?? null;
  }

  /** Claims first-time onboarding exactly once. A losing concurrent request can
   * read the persisted timestamp and return without changing preferences. */
  async claimOnboardingCompletion(
    userId: string,
    completedAt: Date,
  ): Promise<UserRecord | null> {
    const [user] = await this.db
      .update(users)
      .set({ onboardingCompletedAt: completedAt, updatedAt: new Date() })
      .where(
        and(eq(users.id, userId), isNull(users.onboardingCompletedAt)),
      )
      .returning();

    return user ?? null;
  }

  async upsertFromAuthUser(input: UserProfileInput): Promise<UserRecord> {
    const [user] = await this.db
      .insert(users)
      .values(input)
      .onConflictDoNothing({ target: users.id })
      .returning();

    if (user) {
      return user;
    }

    const existingUser = await this.findById(input.id);

    if (!existingUser) {
      throw new Error("Could not find user profile after upsert");
    }

    return existingUser;
  }
}

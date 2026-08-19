import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  type UserPreferenceRecord,
  userPreferences,
} from "../schema/user-preferences";

export class UserPreferencesRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<UserPreferenceRecord | null> {
    const [preferences] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    return preferences ?? null;
  }

  async create(
    userId: string,
    preferredGenreIds: number[],
  ): Promise<UserPreferenceRecord> {
    const [preferences] = await this.db
      .insert(userPreferences)
      .values({ userId, preferredGenreIds })
      .returning();

    if (!preferences) {
      throw new Error("Could not create user preferences");
    }

    return preferences;
  }

  async update(
    userId: string,
    preferredGenreIds: number[],
  ): Promise<UserPreferenceRecord | null> {
    const [preferences] = await this.db
      .update(userPreferences)
      .set({ preferredGenreIds, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();

    return preferences ?? null;
  }

  async upsert(
    userId: string,
    preferredGenreIds: number[],
  ): Promise<UserPreferenceRecord> {
    const [preferences] = await this.db
      .insert(userPreferences)
      .values({ userId, preferredGenreIds })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { preferredGenreIds, updatedAt: new Date() },
      })
      .returning();

    if (!preferences) {
      throw new Error("Could not upsert user preferences");
    }

    return preferences;
  }
}

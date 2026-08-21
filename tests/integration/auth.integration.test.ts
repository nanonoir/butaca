import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";

import { UuidSchema } from "../../src/contracts/common";
import { UserRepository } from "../../src/db/repositories/user-repository";
import { AuthService } from "../../src/features/auth/auth-service";
import { createIntegrationDatabase } from "./support/database";
import { getIntegrationEnv } from "./support/env";
import { deleteTestAuthUserByEmail } from "./support/supabase";

const publicClientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

it("completes the public Auth flow and cleans up the Auth identity", async () => {
  const environment = getIntegrationEnv();
  const database = createIntegrationDatabase();
  const email = `filmmatch-auth-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}`;
  const displayName = "Auth integration profile";

  try {
    const client = createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      publicClientOptions,
    );
    const users = new UserRepository(database.db);
    const authService = new AuthService(client.auth, users);
    let createdUserId: string | undefined;

    try {
      const created = await authService.signUp({
        email,
        password,
        displayName,
      });
      createdUserId = created.id;
      const storedProfile = await users.findById(created.id);

      expect(UuidSchema.safeParse(created.id).success).toBe(true);
      expect(storedProfile).not.toBeNull();
      expect(storedProfile?.displayName).toBe(displayName);
      expect(storedProfile?.avatarUrl).toBeNull();

      await authService.signOut();
      await expect(authService.getCurrentUser()).resolves.toBeNull();

      const signedIn = await authService.signIn({ email, password });

      expect(signedIn.id === created.id).toBe(true);
      expect((await authService.getCurrentUser())?.id === created.id).toBe(
        true,
      );
    } finally {
      const cleanup = await deleteTestAuthUserByEmail(email);

      expect(cleanup.authUserPresentAfterCleanup).toBe(false);

      if (createdUserId) {
        expect(cleanup.deleted).toBe(true);
        expect(await users.findById(createdUserId)).toBeNull();
      }
    }
  } finally {
    await database.close();
  }
});

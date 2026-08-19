import { createClient } from "@supabase/supabase-js";

import { getIntegrationEnv } from "./env";

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

export async function createTestAuthUser() {
  const environment = getIntegrationEnv();
  const client = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    clientOptions,
  );
  const { data, error } = await client.auth.signUp({
    email: `filmmatch-integration-${crypto.randomUUID()}@example.test`,
    password: `Test-${crypto.randomUUID()}`,
  });
  const authUserId = data.user?.id;

  if (error || !authUserId) {
    if (error && authUserId) {
      await deleteTestAuthUser(authUserId);
    }

    throw new Error("Could not create test auth user");
  }

  return { id: authUserId };
}

export async function deleteTestAuthUser(userId: string) {
  const environment = getIntegrationEnv();
  const client = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_TEST_SECRET_KEY,
    clientOptions,
  );
  const { error } = await client.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error("Could not delete test auth user");
  }
}

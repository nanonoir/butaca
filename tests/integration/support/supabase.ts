import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getIntegrationEnv } from "./env";

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

function createTestAdminClient() {
  try {
    const environment = getIntegrationEnv();

    return createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.SUPABASE_TEST_SECRET_KEY,
      clientOptions,
    );
  } catch {
    throw new Error("Could not initialize test Auth administration");
  }
}

async function findTestAuthUserIdByEmail(
  client: SupabaseClient,
  email: string,
): Promise<string | null> {
  let page: number | null = 1;

  while (page !== null) {
    let response: Awaited<ReturnType<typeof client.auth.admin.listUsers>>;

    try {
      response = await client.auth.admin.listUsers({ page, perPage: 1_000 });
    } catch {
      throw new Error("Could not inspect test Auth users");
    }

    if (response.error) {
      throw new Error("Could not inspect test Auth users");
    }

    const matchingUser = response.data.users.find(
      (user) => user.email === email,
    );

    if (matchingUser) {
      return matchingUser.id;
    }

    page = response.data.nextPage;
  }

  return null;
}

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

export async function deleteTestAuthUserByEmail(email: string) {
  const client = createTestAdminClient();
  const userId = await findTestAuthUserIdByEmail(client, email);

  if (!userId) {
    return { deleted: false, authUserPresentAfterCleanup: false };
  }

  let response: Awaited<ReturnType<typeof client.auth.admin.deleteUser>>;

  try {
    response = await client.auth.admin.deleteUser(userId);
  } catch {
    throw new Error("Could not delete test Auth user");
  }

  if (response.error) {
    throw new Error("Could not delete test Auth user");
  }

  const remainingUserId = await findTestAuthUserIdByEmail(client, email);

  return {
    deleted: true,
    authUserPresentAfterCleanup: remainingUserId !== null,
  };
}

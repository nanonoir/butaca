import "server-only";

import { getDatabase } from "../../db";
import { UserRepository } from "../../db/repositories/user-repository";
import { createServerSupabaseClient } from "../../integrations/supabase/server";

import { ServerAuthService } from "./server-auth-service";

/** Built per request: the Supabase client is bound to the current cookie jar,
 * so it must never be cached across requests the way the database is. */
export async function getServerAuthService(): Promise<ServerAuthService> {
  const supabase = await createServerSupabaseClient();

  return new ServerAuthService(
    supabase.auth,
    new UserRepository(getDatabase()),
  );
}

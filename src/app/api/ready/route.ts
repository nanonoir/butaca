import { sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { apiData, apiError } from "@/lib/api/route";

/** What a deployment waits on before routing traffic: unlike `/api/health`, it
 * proves the database answers. It is not meant for restart decisions. */
export const dynamic = "force-dynamic";

const READINESS_TIMEOUT_MS = 3_000;

function timeoutAfter(ms: number): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("readiness timeout")), ms);
  });

  return { promise, cancel: () => clearTimeout(timer) };
}

export async function GET(): Promise<Response> {
  const timeout = timeoutAfter(READINESS_TIMEOUT_MS);

  try {
    await Promise.race([getDatabase().execute(sql`select 1`), timeout.promise]);

    return apiData({ status: "ready" });
  } catch {
    // Not ready for any reason (unreachable, refusing, slow, misconfigured);
    // the cause is deliberately not echoed.
    return apiError("SERVICE_UNAVAILABLE");
  } finally {
    timeout.cancel();
  }
}

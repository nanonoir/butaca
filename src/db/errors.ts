/** The database is unreachable or refusing work (as opposed to a query or data
 * bug). Callers map it to a 503 instead of an opaque 500. */
export class ServiceUnavailableError extends Error {
  constructor() {
    super("Service temporarily unavailable");
    this.name = "ServiceUnavailableError";
  }
}

/** postgres.js reports connection-level failures with these codes. */
const CONNECTION_ERROR_CODES = new Set([
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "CONNECTION_ENDED",
  "CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EPIPE",
]);

/** SQLSTATE classes that mean "the server cannot serve right now": 08 connection
 * exception, 53 insufficient resources, 57 operator intervention (shutdown,
 * cancel), 58 system error. */
const OPERATIONAL_SQLSTATE_CLASSES = new Set(["08", "53", "57", "58"]);

const MAX_CAUSE_DEPTH = 5;

/** Drizzle wraps driver failures in an error whose `cause` is the real one, so
 * the whole chain is inspected. */
export function isOperationalDatabaseError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return false;
    }

    const { code, cause } = current as { code?: unknown; cause?: unknown };

    if (typeof code === "string") {
      if (
        CONNECTION_ERROR_CODES.has(code) ||
        OPERATIONAL_SQLSTATE_CLASSES.has(code.slice(0, 2))
      ) {
        return true;
      }
    }

    current = cause;
  }

  return false;
}

/** Runs a database operation, turning operational failures into
 * `ServiceUnavailableError` and leaving every other error untouched. */
export async function withDatabaseAvailability<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isOperationalDatabaseError(error)) {
      throw new ServiceUnavailableError();
    }

    throw error;
  }
}

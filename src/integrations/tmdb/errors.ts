export type TmdbErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

export class TmdbError extends Error {
  constructor(
    public readonly code: TmdbErrorCode,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(`TMDB request failed: ${code}`, options);
    this.name = "TmdbError";
  }
}

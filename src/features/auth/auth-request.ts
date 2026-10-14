export type AuthRequestRejection = "origin" | "fetch-metadata" | "content-type";

/** CSRF gate for every state-changing auth POST. Better Auth only enforces
 * origin checks on requests that reach its own handler, and our routes call
 * `auth.api` server-side, so the check has to live here.
 *
 * Policy (conservative): `Origin` is mandatory and must equal the canonical
 * origin exactly. A missing, `null` or malformed `Origin` is rejected, and
 * `Host`/`Referer` are never trusted. `Sec-Fetch-Site`, when sent, must be
 * `same-origin`. Routes that read a body also require `application/json`, which
 * a cross-site form cannot send without a preflight. */
export function rejectUntrustedAuthRequest(
  request: Request,
  canonicalBaseUrl: string,
  options: { json: boolean },
): AuthRequestRejection | null {
  const origin = request.headers.get("origin");

  if (origin === null || origin !== new URL(canonicalBaseUrl).origin) {
    return "origin";
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite !== null && fetchSite !== "same-origin") {
    return "fetch-metadata";
  }

  if (options.json) {
    const mediaType = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (mediaType !== "application/json") {
      return "content-type";
    }
  }

  return null;
}

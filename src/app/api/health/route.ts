/** What a container orchestrator asks to decide whether this instance is worth
 * routing traffic to. Deliberately answers from the process alone: it touches
 * no database, no session and no provider, so a TMDB outage cannot convince
 * Docker to restart a server that is running perfectly well.
 *
 * It is also the only route safe to poll every thirty seconds forever. */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ data: { status: "ok" } });
}

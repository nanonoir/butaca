import { RecommendationRequestSchema } from "@/contracts/discover";
import { getRecommendationService } from "@/features/recommendations/recommendation-factory";
import {
  apiData,
  readJsonBody,
  requireViewer,
  runApiRoute,
} from "@/lib/api/route";

/** POST rather than GET because the request carries the ids already on screen,
 * and a deck the viewer has worked through would not survive a query string.
 * Private: the batch comes from this viewer's taste profile. */
export async function POST(request: Request): Promise<Response> {
  return runApiRoute(async () => {
    const { excludeMovieIds, limit, filters } = await readJsonBody(
      request,
      RecommendationRequestSchema,
    );
    const viewer = await requireViewer();

    return apiData(
      await getRecommendationService().getDiscoverBatch(viewer.id, {
        excludeMovieIds,
        limit,
        filters,
      }),
    );
  });
}

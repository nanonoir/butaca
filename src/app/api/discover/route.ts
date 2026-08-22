import { getRecommendationService } from "@/features/recommendations/recommendation-factory";
import { apiData, requireViewer, runApiRoute } from "@/lib/api/route";

/** Private: the batch is built from this viewer's taste profile, so there is
 * nothing meaningful to serve a guest. */
export async function GET(): Promise<Response> {
  return runApiRoute(async () => {
    const viewer = await requireViewer();

    return apiData(
      await getRecommendationService().getDiscoverBatch(viewer.id),
    );
  });
}

import { MovieRouteParamsSchema } from "@/contracts/common";
import { SetWatchedRequestSchema } from "@/contracts/interactions";
import { getInteractionService } from "@/features/interactions/interaction-factory";
import {
  apiData,
  readJsonBody,
  requireViewer,
  runApiRoute,
} from "@/lib/api/route";

type RouteContext = { params: Promise<{ movieId: string }> };

export async function PUT(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const { watched } = await readJsonBody(request, SetWatchedRequestSchema);
    const viewer = await requireViewer();

    return apiData(
      await getInteractionService().setWatched(viewer.id, movieId, watched),
    );
  });
}

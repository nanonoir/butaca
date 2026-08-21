import { MovieRouteParamsSchema } from "@/contracts/common";
import { SetMovieReactionRequestSchema } from "@/contracts/interactions";
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
    const { reaction } = await readJsonBody(
      request,
      SetMovieReactionRequestSchema,
    );
    const viewer = await requireViewer();

    return apiData(
      await getInteractionService().setReaction(viewer.id, movieId, reaction),
    );
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const viewer = await requireViewer();

    return apiData(
      await getInteractionService().removeReaction(viewer.id, movieId),
    );
  });
}

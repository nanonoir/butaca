import { LikesQuerySchema } from "@/contracts/likes";
import { getLikesService } from "@/features/likes/likes-factory";
import { requireViewer, runApiRoute } from "@/lib/api/route";

export async function GET(request: Request): Promise<Response> {
  return runApiRoute(async () => {
    const query = LikesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const viewer = await requireViewer();

    return Response.json(
      await getLikesService().listLikedMovies(viewer.id, query),
    );
  });
}

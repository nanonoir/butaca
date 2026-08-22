import { MovieRouteParamsSchema } from "@/contracts/common";
import { getMovieDetailService } from "@/features/movie-detail/movie-detail-factory";
import { apiData, getOptionalViewer, runApiRoute } from "@/lib/api/route";

type RouteContext = { params: Promise<{ movieId: string }> };

/** Public: a guest sees the movie and the community verdicts, with an empty
 * viewer state instead of an error. */
export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const viewer = await getOptionalViewer();

    return apiData(await getMovieDetailService().getPageData(movieId, viewer));
  });
}

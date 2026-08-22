import { MovieRouteParamsSchema, PageQuerySchema } from "@/contracts/common";
import { getMovieCatalogService } from "@/features/movies/movie-catalog-service";
import { apiData, runApiRoute } from "@/lib/api/route";

type RouteContext = { params: Promise<{ movieId: string }> };

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  return runApiRoute(async () => {
    const { movieId } = MovieRouteParamsSchema.parse(await params);
    const { page } = PageQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return apiData(
      await getMovieCatalogService().getSimilarMovies(movieId, page),
    );
  });
}

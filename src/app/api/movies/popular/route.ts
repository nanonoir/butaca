import { PageQuerySchema } from "@/contracts/common";
import { getMovieCatalogService } from "@/features/movies/movie-catalog-service";
import { apiData, runApiRoute } from "@/lib/api/route";

export async function GET(request: Request): Promise<Response> {
  return runApiRoute(async () => {
    const { page } = PageQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return apiData(await getMovieCatalogService().getPopularMovies(page));
  });
}

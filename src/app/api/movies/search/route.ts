import { SearchMoviesQuerySchema } from "@/contracts/search";
import { getMovieCatalogService } from "@/features/movies/movie-catalog-service";
import { apiData, runApiRoute } from "@/lib/api/route";

export async function GET(request: Request): Promise<Response> {
  return runApiRoute(async () => {
    const input = SearchMoviesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return apiData(await getMovieCatalogService().searchMovies(input));
  });
}

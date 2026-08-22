import { getMovieCatalogService } from "@/features/movies/movie-catalog-service";
import { apiData, runApiRoute } from "@/lib/api/route";

export async function GET(): Promise<Response> {
  return runApiRoute(async () => apiData(await getMovieCatalogService().getGenres()));
}

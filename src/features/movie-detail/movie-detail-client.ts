import { MovieDetailResponseSchema } from "@/contracts/movie-detail";
import { apiRequest } from "@/lib/api/client";

export async function fetchMovieDetail(movieId: number) {
  const { data } = await apiRequest(
    `/api/movies/${movieId}`,
    MovieDetailResponseSchema,
  );

  return data;
}

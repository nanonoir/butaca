import {
  apiDataResponseSchema,
  GenreSchema,
  MovieSummarySchema,
  paginatedResponseSchema,
} from "@/contracts";
import { SearchMoviesResponseSchema } from "@/contracts/search";
import { apiRequest } from "@/lib/api/client";

const SimilarMoviesResponseSchema = apiDataResponseSchema(
  paginatedResponseSchema(MovieSummarySchema),
);
const SearchMoviesApiResponseSchema = apiDataResponseSchema(
  SearchMoviesResponseSchema,
);
const GenresApiResponseSchema = apiDataResponseSchema(
  GenreSchema.array(),
);

export async function fetchMovieGenres() {
  const { data } = await apiRequest("/api/movies/genres", GenresApiResponseSchema);

  return data;
}

export async function fetchSearchMovies(query: string, page: number) {
  const searchParams = new URLSearchParams({ query, page: String(page) });
  const { data } = await apiRequest(
    `/api/movies/search?${searchParams}`,
    SearchMoviesApiResponseSchema,
  );

  return data;
}

export async function fetchSimilarMovies(movieId: number, page: number) {
  const { data } = await apiRequest(
    `/api/movies/${movieId}/similar?page=${page}`,
    SimilarMoviesResponseSchema,
  );

  return data;
}

import {
  DeleteReviewResponseSchema,
  ReviewsResponseSchema,
  UpsertReviewResponseSchema,
  type UpsertReviewRequest,
} from "@/contracts/reviews";
import { apiRequest } from "@/lib/api/client";

const reviewsPath = (movieId: number) => `/api/movies/${movieId}/reviews`;

export function fetchMovieReviews(movieId: number, page = 1) {
  return apiRequest(
    `${reviewsPath(movieId)}?page=${page}`,
    ReviewsResponseSchema,
  );
}

export async function upsertMovieReview(
  movieId: number,
  input: UpsertReviewRequest,
) {
  const { data } = await apiRequest(
    reviewsPath(movieId),
    UpsertReviewResponseSchema,
    { method: "PUT", body: JSON.stringify(input) },
  );

  return data;
}

export async function deleteMovieReview(movieId: number) {
  const { data } = await apiRequest(
    reviewsPath(movieId),
    DeleteReviewResponseSchema,
    { method: "DELETE" },
  );

  return data;
}

import {
  DeleteMovieReactionResponseSchema,
  SetMovieReactionResponseSchema,
  SetWatchedResponseSchema,
  type MovieReaction,
} from "@/contracts/interactions";
import { apiRequest } from "@/lib/api/client";

const reactionPath = (movieId: number) => `/api/movies/${movieId}/reaction`;
const watchedPath = (movieId: number) => `/api/movies/${movieId}/watched`;

export async function setMovieReaction(
  movieId: number,
  reaction: MovieReaction,
) {
  const { data } = await apiRequest(
    reactionPath(movieId),
    SetMovieReactionResponseSchema,
    { method: "PUT", body: JSON.stringify({ reaction }) },
  );

  return data;
}

export async function removeMovieReaction(movieId: number) {
  const { data } = await apiRequest(
    reactionPath(movieId),
    DeleteMovieReactionResponseSchema,
    { method: "DELETE" },
  );

  return data;
}

export async function setMovieWatched(movieId: number, watched: boolean) {
  const { data } = await apiRequest(
    watchedPath(movieId),
    SetWatchedResponseSchema,
    { method: "PUT", body: JSON.stringify({ watched }) },
  );

  return data;
}

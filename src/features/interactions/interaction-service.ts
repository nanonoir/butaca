import "server-only";

import type {
  MovieInteractionState,
  MovieReaction,
  ViewerMovieState,
} from "@/contracts";
import { ApiRouteError } from "@/lib/api/route";

import type { UserMovieInteractionRepository } from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";

type InteractionPort = Pick<
  UserMovieInteractionRepository,
  "findByUserAndMovie" | "upsertReaction" | "setWatched" | "delete"
>;

function toState(
  movieId: number,
  interaction: Pick<
    UserMovieInteractionRecord,
    "reaction" | "watchedAt"
  > | null,
): MovieInteractionState {
  return {
    movieId,
    reaction: interaction?.reaction ?? null,
    watchedAt: interaction?.watchedAt?.toISOString() ?? null,
  };
}

/** Every method takes the viewer id from the caller, which resolves it from the
 * session. No method accepts a user id coming from a request payload. */
export class InteractionService {
  constructor(private readonly interactions: InteractionPort) {}

  async getViewerState(
    userId: string,
    movieId: number,
  ): Promise<ViewerMovieState> {
    const interaction = await this.interactions.findByUserAndMovie(
      userId,
      movieId,
    );
    const { reaction, watchedAt } = toState(movieId, interaction);

    return { reaction, watchedAt };
  }

  async setReaction(
    userId: string,
    movieId: number,
    reaction: MovieReaction,
  ): Promise<MovieInteractionState & { reaction: MovieReaction }> {
    const interaction = await this.interactions.upsertReaction(
      userId,
      movieId,
      reaction,
    );

    return {
      ...toState(movieId, interaction),
      // upsertReaction always writes a reaction; the contract narrows the
      // response so the client never has to handle a null here.
      reaction,
    };
  }

  /** Removing a reaction preserves `watchedAt`: the two are independent, so the
   * row survives when the movie was already marked as watched. */
  async removeReaction(
    userId: string,
    movieId: number,
  ): Promise<{ movieId: number; reaction: null; watchedAt: string | null }> {
    const removed = await this.interactions.delete(userId, movieId);

    if (!removed) {
      throw new ApiRouteError("REACTION_NOT_FOUND");
    }

    const remaining = await this.interactions.findByUserAndMovie(
      userId,
      movieId,
    );

    return {
      movieId,
      reaction: null,
      watchedAt: remaining?.watchedAt?.toISOString() ?? null,
    };
  }

  async setWatched(
    userId: string,
    movieId: number,
    watched: boolean,
  ): Promise<MovieInteractionState> {
    const interaction = await this.interactions.setWatched(
      userId,
      movieId,
      watched ? new Date() : null,
    );

    // A null result means the row held nothing but the watched mark and was
    // removed, which leaves the movie in its untouched state.
    return toState(movieId, interaction);
  }
}

import "server-only";

import { getDatabase } from "../../db";
import { UserMovieInteractionRepository } from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";

import { LikesService } from "./likes-service";

export function getLikesService(): LikesService {
  return new LikesService(
    new UserMovieInteractionRepository(getDatabase()),
    getTmdb(),
  );
}

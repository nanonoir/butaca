import "server-only";

import { getDatabase } from "../../db";
import { UserMovieInteractionRepository } from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";

import { ProfileLikesService } from "./profile-likes-service";

export function getProfileLikesService(): ProfileLikesService {
  return new ProfileLikesService(
    new UserMovieInteractionRepository(getDatabase()),
    getTmdb(),
  );
}

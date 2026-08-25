import "server-only";

import { getDatabase } from "../../db";
import {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";

import { ProfileTasteService } from "./profile-taste-service";

export function getProfileTasteService(): ProfileTasteService {
  const database = getDatabase();

  return new ProfileTasteService(
    new UserMovieInteractionRepository(database),
    new UserPreferencesRepository(database),
    getTmdb(),
  );
}

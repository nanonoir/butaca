import "server-only";

import { getDatabase } from "../../db";
import {
  ReviewRepository,
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";

import { ProfileTasteService } from "./profile-taste-service";

export function getProfileTasteService(): ProfileTasteService {
  const database = getDatabase();
  const catalog = getTmdb();

  return new ProfileTasteService(
    {
      interactions: new UserMovieInteractionRepository(database),
      preferences: new UserPreferencesRepository(database),
      reviews: new ReviewRepository(database),
      catalog,
    },
    catalog,
  );
}

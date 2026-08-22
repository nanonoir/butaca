import "server-only";

import { getDatabase } from "../../db";
import {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";

import { RecommendationService } from "./recommendation-service";

export function getRecommendationService(): RecommendationService {
  const database = getDatabase();

  return new RecommendationService(
    new UserPreferencesRepository(database),
    new UserMovieInteractionRepository(database),
    getTmdb(),
  );
}

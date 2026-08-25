import "server-only";

import { getDatabase } from "../../db";
import { ReviewRepository } from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";

import { ProfileReviewsService } from "./profile-reviews-service";

export function getProfileReviewsService(): ProfileReviewsService {
  return new ProfileReviewsService(
    new ReviewRepository(getDatabase()),
    getTmdb(),
  );
}

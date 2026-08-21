import "server-only";

import { getDatabase } from "../../db";
import {
  ReviewRepository,
  UserMovieInteractionRepository,
} from "../../db/repositories";
import { getTmdb } from "../../integrations/tmdb";
import { InteractionService } from "../interactions/interaction-service";
import { ReviewService } from "../reviews/review-service";

import { MovieDetailService } from "./movie-detail-service";

export function getMovieDetailService(): MovieDetailService {
  const database = getDatabase();

  return new MovieDetailService(
    getTmdb(),
    new InteractionService(new UserMovieInteractionRepository(database)),
    new ReviewService(new ReviewRepository(database)),
  );
}

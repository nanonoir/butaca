import "server-only";

import { getDatabase } from "../../db";
import { ReviewRepository } from "../../db/repositories";

import { ReviewService } from "./review-service";

export function getReviewService(): ReviewService {
  return new ReviewService(new ReviewRepository(getDatabase()));
}

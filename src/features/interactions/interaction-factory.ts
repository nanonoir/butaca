import "server-only";

import { getDatabase } from "../../db";
import { UserMovieInteractionRepository } from "../../db/repositories";

import { InteractionService } from "./interaction-service";

export function getInteractionService(): InteractionService {
  return new InteractionService(
    new UserMovieInteractionRepository(getDatabase()),
  );
}

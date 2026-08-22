import { ChatMovieRecommendationsPayloadSchema } from "@/contracts/chat";

import { DISCOVER_MOVIES_FIXTURE } from "./discover-movies";

export const CHAT_RECOMMENDATIONS_FIXTURE =
  ChatMovieRecommendationsPayloadSchema.parse({
    movies: DISCOVER_MOVIES_FIXTURE.data.movies.slice(1, 4),
  });

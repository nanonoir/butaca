import { z } from "zod";

import {
  IsoDateTimeSchema,
  TmdbMovieIdSchema,
  apiDataResponseSchema,
} from "./common";

export const MovieReactionSchema = z.enum(["LIKE", "DISLIKE"]);

export const ViewerMovieStateSchema = z.object({
  reaction: MovieReactionSchema.nullable(),
  watchedAt: IsoDateTimeSchema.nullable(),
});

export const SetMovieReactionRequestSchema = z.object({
  reaction: MovieReactionSchema,
});

export const MovieInteractionStateSchema = z.object({
  movieId: TmdbMovieIdSchema,
  reaction: MovieReactionSchema.nullable(),
  watchedAt: IsoDateTimeSchema.nullable(),
});

export const SetMovieReactionResponseSchema = apiDataResponseSchema(
  MovieInteractionStateSchema.extend({
    reaction: MovieReactionSchema,
  }),
);

export const SetWatchedRequestSchema = z.object({
  watched: z.boolean(),
});

export const SetWatchedResponseSchema = apiDataResponseSchema(
  MovieInteractionStateSchema,
);

export const DeleteMovieReactionResponseSchema = apiDataResponseSchema(
  z.object({
    movieId: TmdbMovieIdSchema,
    reaction: z.null(),
    watchedAt: IsoDateTimeSchema.nullable(),
  }),
);

export type MovieReaction = z.infer<typeof MovieReactionSchema>;
export type ViewerMovieState = z.infer<typeof ViewerMovieStateSchema>;
export type MovieInteractionState = z.infer<typeof MovieInteractionStateSchema>;
